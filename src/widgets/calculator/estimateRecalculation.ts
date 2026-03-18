/**
 * Пересчёт сметы по результатам технического аудита.
 * Исправления: хранение по битрейту, кабель по метражу, L3/VLAN, абонентские устройства, лицензии, PoE-бюджет.
 */

import type { CalculatorResult, LineItem, ResultGroup } from './calculatorLogic';

/** Форма входных данных для пересчёта (совместима со старой логикой калькулятора). */
export interface RecalcInput {
  cameraTypes: { outdoor2mp: number; indoor2mp: number; indoor4mp: number; anpr3mp: number };
  elevatorCount?: number;
  elevatorCameraType?: '2mp' | '4mp';
  intercom: {
    entrances: number;
    floorsPerEntrance: number;
    flatsPerFloor: number;
    extraCardReaders?: number;
    carEntrance: { enabled: boolean; entranceCount?: number; gates: number; parking: number };
    hasConcierge?: boolean;
  };
}
import {
  hddConfig,
  cableConfig,
  REEL_LENGTH_METERS,
  consumablesCablePercent,
  installationConfig,
  storageBitrateMbpsFor30d,
  CABLE_RESERVE_RECALC,
  INTERCOM_DEVICES_L3_THRESHOLD,
  auditRecalcConfig,
  switchPoEBudgetWatts,
  switchConfigs,
  floorPoeSwitchConfig,
} from '@/shared/content/calculatorConfig';

const HDD_CAPACITY_TB = 10;
const ARCHIVE_DAYS = 30;
/** Формула: ТБ = камеры × битрейт (Мбит/с) × 3600 × 24 × дни / 8 / 1_000_000 */
const TB_PER_CAMERA_MBIT_DAY = (3600 * 24) / 8 / 1_000_000;

export interface RecalcOptions {
  /** Вариант абонентских устройств: 'flats' = по квартирам, 'concierge' = монитор на пост, 'customer' = заказчик, 'none' = не добавлять */
  subscriberVariant?: 'flats' | 'concierge' | 'customer' | 'none';
  /** Количество квартир (для варианта 'flats') */
  flatCount?: number;
  /** Добавить раздел лицензий (NVR/ANPR/СКУД) */
  addLicenses?: boolean;
  /** Каналы NVR сверх базовых для лицензий */
  nvrChannelsExtra?: number;
}

export interface SectionChange {
  section: string;
  wasKzt: number;
  becameKzt: number;
  diffKzt: number;
  details?: string;
}

export interface RecalcResult {
  /** Таблица изменений по разделам */
  tableChanges: SectionChange[];
  /** Новая полная смета (группы с пересчитанными строками) */
  newGroups: ResultGroup[];
  /** Новые итоги */
  newEquipment: number;
  newConsumables: number;
  newInstallationWork: number;
  newInstallationCommissioning: number;
  newInstallationCable: number;
  newGrandTotal: number;
  /** Исправление 1: хранение */
  storageFix: { requiredTb: number; requiredHdd: number; wasHdd: number; diffHdd: number; diffKzt: number };
  /** Исправление 2: кабель */
  cableFix: { reelCctvWas: number; reelCctvNeed: number; reelIntercomWas: number; reelIntercomNeed: number; diffKzt: number };
  /** Исправление 3: L3/VLAN добавлено? */
  l3VlanAdded: boolean;
  l3VlanSum: number;
  /** Исправление 4: абонентские устройства */
  subscriberAdded: boolean;
  subscriberSum: number;
  /** Исправление 5: лицензии */
  licensesAdded: boolean;
  licensesSum: number;
  /** Исправление 6: таблица PoE-бюджета */
  poeBudgetTable: { name: string; budgetW: number; loadW: number; status: string }[];
  /** Позиции на уточнение у заказчика */
  clarificationList: string[];
}

/** Требуемый объём хранилища (ТБ) за 30 дней по битрейту по типам камер */
function requiredStorageTb(input: RecalcInput): number {
  const ct = input.cameraTypes;
  const outdoor = ct.outdoor2mp * storageBitrateMbpsFor30d.outdoor2mp;
  const ind2 = ct.indoor2mp * storageBitrateMbpsFor30d.indoor2mp;
  const ind4 = ct.indoor4mp * storageBitrateMbpsFor30d.indoor4mp;
  const anpr = ct.anpr3mp * storageBitrateMbpsFor30d.anpr3mp;
  const liftCount = input.elevatorCount ?? 0;
  const lift = liftCount * (input.elevatorCameraType === '4mp' ? storageBitrateMbpsFor30d.lift4mp : storageBitrateMbpsFor30d.lift2mp);
  const totalMbitSec = outdoor + ind2 + ind4 + anpr + lift;
  return totalMbitSec * ARCHIVE_DAYS * TB_PER_CAMERA_MBIT_DAY;
}

/** Количество устройств домофонии: вызывные (подъезды + калитки) + интерком-панели (квартиры) + доп. считыватели. Паркинг не входит. */
function intercomDevicesCount(input: RecalcInput): number {
  const { entrances, floorsPerEntrance, flatsPerFloor, extraCardReaders, carEntrance } = input.intercom;
  const gates = carEntrance.enabled ? carEntrance.gates : 0;
  const panels = entrances + gates;
  const apartments = entrances * floorsPerEntrance * flatsPerFloor;
  const extraReaders = extraCardReaders ?? 0;
  return panels + apartments + extraReaders;
}

/** Извлечь текущее кол-во бухт из группы кабеля по названию строки */
function getReelCountFromGroup(groups: ResultGroup[], groupTitleContains: string): number {
  const group = groups.find((g) => g.title.includes(groupTitleContains));
  if (!group) return 0;
  const cableRow = group.rows.find((r) => r.name.includes('CAB-LC') || r.name.includes('305'));
  return cableRow ? cableRow.qty : 0;
}

/** Извлечь текущую сумму раздела по заголовку */
export function getGroupSubtotal(groups: ResultGroup[], titleContains: string): number {
  const g = groups.find((gr) => gr.title.includes(titleContains));
  return g ? g.subtotal : 0;
}

export function recalculateEstimate(
  input: RecalcInput,
  result: CalculatorResult,
  options: RecalcOptions = {}
): RecalcResult {
  const {
    subscriberVariant = 'none',
    flatCount = 0,
    addLicenses = false,
    nvrChannelsExtra = 0,
  } = options;

  const tableChanges: SectionChange[] = [];
  const clarificationList: string[] = [];
  let deltaEquipment = 0;
  let deltaConsumables = 0;

  const totalMetersCctv = result.totalMetersCctv ?? 0;
  const totalMetersIntercom = result.totalMetersIntercom ?? 0;

  // ——— ИСПРАВЛЕНИЕ 1: Хранение по битрейту 30 дней ———
  const requiredTb = requiredStorageTb(input);
  const requiredHdd = Math.ceil(requiredTb / HDD_CAPACITY_TB);
  const wasHdd = result.hddCount ?? 0;
  const diffHdd = requiredHdd - wasHdd;
  const storageDiffKzt = diffHdd * hddConfig.priceKzt;
  if (diffHdd !== 0) {
    deltaEquipment += storageDiffKzt;
    tableChanges.push({
      section: 'Хранение данных',
      wasKzt: wasHdd * hddConfig.priceKzt,
      becameKzt: requiredHdd * hddConfig.priceKzt,
      diffKzt: storageDiffKzt,
      details: `Было ${wasHdd} дисков → нужно ${requiredHdd} (30 дней, по битрейту). Разница ${diffHdd > 0 ? '+' : ''}${diffHdd} × 220 000 ₸`,
    });
  }

  const storageFix = {
    requiredTb,
    requiredHdd,
    wasHdd,
    diffHdd,
    diffKzt: storageDiffKzt,
  };

  // ——— ИСПРАВЛЕНИЕ 2: Кабель — бухты по метражу + 15% ———
  const metersCctvReserve = Math.ceil(totalMetersCctv * CABLE_RESERVE_RECALC);
  const metersIntercomReserve = Math.ceil(totalMetersIntercom * CABLE_RESERVE_RECALC);
  const reelCctvNeed = totalMetersCctv > 0 ? Math.max(1, Math.ceil(metersCctvReserve / REEL_LENGTH_METERS)) : 0;
  const reelIntercomNeed = totalMetersIntercom > 0 ? Math.max(1, Math.ceil(metersIntercomReserve / REEL_LENGTH_METERS)) : 0;

  const reelCctvWas = getReelCountFromGroup(result.groups, 'видеонаблюдение');
  const reelIntercomWas = getReelCountFromGroup(result.groups, 'домофония');

  const cableCostWasCctv = reelCctvWas * cableConfig.indoor.priceKzt;
  const cableCostWasIntercom = reelIntercomWas * cableConfig.indoor.priceKzt;
  const cableCostNeedCctv = reelCctvNeed * cableConfig.indoor.priceKzt;
  const cableCostNeedIntercom = reelIntercomNeed * cableConfig.indoor.priceKzt;
  const consumablesWasCable = Math.round((cableCostWasCctv + cableCostWasIntercom) * consumablesCablePercent);
  const consumablesNeedCable = Math.round((cableCostNeedCctv + cableCostNeedIntercom) * consumablesCablePercent);
  const cableDiffKzt = (cableCostNeedCctv + cableCostNeedIntercom - cableCostWasCctv - cableCostWasIntercom) + (consumablesNeedCable - consumablesWasCable);

  if (reelCctvNeed !== reelCctvWas || reelIntercomNeed !== reelIntercomWas) {
    deltaEquipment += (cableCostNeedCctv + cableCostNeedIntercom) - (cableCostWasCctv + cableCostWasIntercom);
    deltaConsumables += consumablesNeedCable - consumablesWasCable;
    tableChanges.push({
      section: 'Кабельная продукция',
      wasKzt: cableCostWasCctv + cableCostWasIntercom + consumablesWasCable,
      becameKzt: cableCostNeedCctv + cableCostNeedIntercom + consumablesNeedCable,
      diffKzt: cableDiffKzt,
      details: `CCTV: было ${reelCctvWas} бухт → нужно ${reelCctvNeed}. Домофония: было ${reelIntercomWas} → нужно ${reelIntercomNeed}. Расходники 25% пересчитаны.`,
    });
  }

  const cableFix = {
    reelCctvWas,
    reelCctvNeed,
    reelIntercomWas,
    reelIntercomNeed,
    diffKzt: cableDiffKzt,
  };

  // ——— ИСПРАВЛЕНИЕ 3: L3/VLAN при > 250 устройств домофонии ———
  const intercomDevices = intercomDevicesCount(input);
  let l3VlanSum = 0;
  if (intercomDevices > INTERCOM_DEVICES_L3_THRESHOLD) {
    l3VlanSum = auditRecalcConfig.l3Switch24.priceKzt + auditRecalcConfig.vlanSetup.priceKzt;
    deltaEquipment += l3VlanSum;
    tableChanges.push({
      section: 'Сетевая архитектура (L3, VLAN)',
      wasKzt: 0,
      becameKzt: l3VlanSum,
      diffKzt: l3VlanSum,
      details: `Устройств домофонии ${intercomDevices} > 250. Добавлены: L3 24п, настройка VLAN.`,
    });
  }

  // ——— ИСПРАВЛЕНИЕ 4: Абонентские устройства ———
  let subscriberSum = 0;
  if (subscriberVariant === 'flats' && flatCount > 0) {
    subscriberSum = flatCount * auditRecalcConfig.subscriberPanel.priceKzt;
    deltaEquipment += subscriberSum;
    tableChanges.push({
      section: 'Абонентские устройства (квартиры)',
      wasKzt: 0,
      becameKzt: subscriberSum,
      diffKzt: subscriberSum,
      details: `${flatCount} шт. × ${auditRecalcConfig.subscriberPanel.priceKzt.toLocaleString('ru-RU')} ₸`,
    });
    clarificationList.push('Уточнить модель видеодомофона в квартиру (7"/10", Android).');
  } else if (subscriberVariant === 'concierge') {
    subscriberSum = auditRecalcConfig.conciergeMonitor.priceKzt * 2;
    deltaEquipment += subscriberSum;
    tableChanges.push({
      section: 'Абонентские устройства (пост консьержа)',
      wasKzt: 0,
      becameKzt: subscriberSum,
      diffKzt: subscriberSum,
      details: '2 монитора 55" 4K на пост',
    });
  } else if (subscriberVariant === 'customer') {
    clarificationList.push('Абонентские устройства — поставка заказчика, в смету 0 ₸.');
  }

  // ——— ИСПРАВЛЕНИЕ 5: Лицензии ПО ———
  let licensesSum = 0;
  if (addLicenses) {
    if (nvrChannelsExtra > 0) {
      licensesSum += nvrChannelsExtra * auditRecalcConfig.licenseNvrPerChannel.priceKzt;
    }
    if (input.cameraTypes.anpr3mp > 0) {
      licensesSum += input.cameraTypes.anpr3mp * auditRecalcConfig.licenseAnprPerCamera.priceKzt;
    }
    if (licensesSum > 0) {
      deltaEquipment += licensesSum;
      tableChanges.push({
        section: 'Лицензии и ПО',
        wasKzt: 0,
        becameKzt: licensesSum,
        diffKzt: licensesSum,
        details: `NVR каналы: ${nvrChannelsExtra}, ANPR: ${input.cameraTypes.anpr3mp} камер.`,
      });
      clarificationList.push('Уточнить производителя NVR/ANPR (Uniview/Dahua/Hikvision) для лицензий.');
    }
  }

  // ——— ИСПРАВЛЕНИЕ 6: PoE-бюджет (только таблица, без изменения сумм) ———
  const poeBudgetTable: RecalcResult['poeBudgetTable'] = [];
  // Типовые нагрузки: камеры 10–15 Вт, панели ~10 Вт
  const wattsPerCamera = 12;
  const wattsPerPanel = 10;
  poeBudgetTable.push({
    name: switchConfigs.poe_24port.name,
    budgetW: switchPoEBudgetWatts.poe_24port,
    loadW: 22 * wattsPerCamera,
    status: 22 * wattsPerCamera <= switchPoEBudgetWatts.poe_24port * 0.8 ? 'OK' : 'Проверить нагрузку',
  });
  poeBudgetTable.push({
    name: switchConfigs.poe_24port.name + ' (лифты)',
    budgetW: switchPoEBudgetWatts.poe_24port,
    loadW: 24 * wattsPerCamera,
    status: 24 * wattsPerCamera <= switchPoEBudgetWatts.poe_24port * 0.8 ? 'OK' : 'Проверить нагрузку',
  });
  poeBudgetTable.push({
    name: floorPoeSwitchConfig.large.label,
    budgetW: switchPoEBudgetWatts.floor8port,
    loadW: 7 * wattsPerPanel,
    status: 7 * wattsPerPanel <= switchPoEBudgetWatts.floor8port * 0.8 ? 'OK' : 'Проверить нагрузку',
  });

  // ——— Новые итоги ———
  const equipmentDelta = deltaEquipment;
  const consumablesDelta = deltaConsumables;
  const newEquipmentBase = result.equipment + equipmentDelta;
  const newConsumablesBase = result.consumables + consumablesDelta;
  const newEquipmentTotal = newEquipmentBase + newConsumablesBase; // для расчёта монтажа
  const installationWork = Math.round(newEquipmentTotal * installationConfig.installationRate);
  const installationCommissioning = Math.round(installationWork * installationConfig.commissioningRate);
  const newMetersCctv = totalMetersCctv;
  const newMetersIntercom = totalMetersIntercom;
  const installationCable = (newMetersCctv + newMetersIntercom) * installationConfig.cableInstallPerMeter;
  const newInstallationWork = installationWork;
  const newInstallationCommissioning = installationCommissioning;
  const newInstallationCable = installationCable;
  const newGrandTotal = newEquipmentBase + newConsumablesBase + installationWork + installationCommissioning + installationCable;

  const newGroups: ResultGroup[] = result.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r })) }));

  // Подставить пересчитанное хранение (HDD)
  const storageGroup = newGroups.find((g) => g.title.includes('Хранение'));
  if (storageGroup && requiredHdd !== wasHdd) {
    const hddRow = storageGroup.rows.find((r) => r.name.includes('SkyHawk') || r.name.includes('HDD'));
    if (hddRow) {
      hddRow.qty = requiredHdd;
      hddRow.sum = requiredHdd * hddConfig.priceKzt;
    }
    storageGroup.subtotal = storageGroup.rows.reduce((a, r) => a + r.sum, 0);
  }

  // Подставить пересчитанный кабель (бухты + расходники)
  const cableCctvGroup = newGroups.find((g) => g.title.includes('видеонаблюдение') && g.title.includes('Кабельная'));
  if (cableCctvGroup && totalMetersCctv > 0 && (reelCctvNeed !== reelCctvWas || consumablesNeedCable !== consumablesWasCable)) {
    const cableRow = cableCctvGroup.rows.find((r) => r.name.includes('CAB-LC') || r.name.includes('305'));
    const consumablesRow = cableCctvGroup.rows.find((r) => r.name === 'Расходные материалы');
    if (cableRow) {
      cableRow.qty = reelCctvNeed;
      cableRow.sum = reelCctvNeed * cableConfig.indoor.priceKzt;
      cableRow.note = `≈ ${totalMetersCctv} м`;
    }
    if (consumablesRow) consumablesRow.sum = Math.round(cableCostNeedCctv * consumablesCablePercent);
    cableCctvGroup.subtotal = cableCctvGroup.rows.reduce((a, r) => a + r.sum, 0);
  }
  const cableIntercomGroup = newGroups.find((g) => g.title.includes('домофония') && g.title.includes('Кабельная'));
  if (cableIntercomGroup && totalMetersIntercom > 0 && (reelIntercomNeed !== reelIntercomWas || consumablesNeedCable !== consumablesWasCable)) {
    const cableRow = cableIntercomGroup.rows.find((r) => r.name.includes('CAB-LC') || r.name.includes('305'));
    const consumablesRow = cableIntercomGroup.rows.find((r) => r.name === 'Расходные материалы');
    if (cableRow) {
      cableRow.qty = reelIntercomNeed;
      cableRow.sum = reelIntercomNeed * cableConfig.indoor.priceKzt;
      cableRow.note = `≈ ${totalMetersIntercom} м`;
    }
    if (consumablesRow) consumablesRow.sum = Math.round(cableCostNeedIntercom * consumablesCablePercent);
    cableIntercomGroup.subtotal = cableIntercomGroup.rows.reduce((a, r) => a + r.sum, 0);
  }

  // Добавить группы L3/VLAN, абонент, лицензии при наличии
  if (l3VlanSum > 0) {
    newGroups.push({
      title: 'Сетевая архитектура',
      rows: [
        { name: auditRecalcConfig.l3Switch24.name, qty: 1, unitPrice: auditRecalcConfig.l3Switch24.priceKzt, sum: auditRecalcConfig.l3Switch24.priceKzt },
        { name: auditRecalcConfig.vlanSetup.name, qty: 1, unitPrice: auditRecalcConfig.vlanSetup.priceKzt, sum: auditRecalcConfig.vlanSetup.priceKzt },
      ],
      subtotal: l3VlanSum,
    });
  }
  if (subscriberSum > 0) {
    newGroups.push({
      title: 'Абонентские устройства',
      rows: subscriberVariant === 'flats'
        ? [{ name: auditRecalcConfig.subscriberPanel.name, qty: flatCount, unitPrice: auditRecalcConfig.subscriberPanel.priceKzt, sum: subscriberSum }]
        : [{ name: auditRecalcConfig.conciergeMonitor.name, qty: 2, unitPrice: auditRecalcConfig.conciergeMonitor.priceKzt, sum: subscriberSum }],
      subtotal: subscriberSum,
    });
  }
  if (licensesSum > 0) {
    const licenseRows: LineItem[] = [];
    if (nvrChannelsExtra > 0) {
      licenseRows.push({
        name: auditRecalcConfig.licenseNvrPerChannel.name,
        qty: nvrChannelsExtra,
        unitPrice: auditRecalcConfig.licenseNvrPerChannel.priceKzt,
        sum: nvrChannelsExtra * auditRecalcConfig.licenseNvrPerChannel.priceKzt,
      });
    }
    if (input.cameraTypes.anpr3mp > 0) {
      licenseRows.push({
        name: auditRecalcConfig.licenseAnprPerCamera.name,
        qty: input.cameraTypes.anpr3mp,
        unitPrice: auditRecalcConfig.licenseAnprPerCamera.priceKzt,
        sum: input.cameraTypes.anpr3mp * auditRecalcConfig.licenseAnprPerCamera.priceKzt,
      });
    }
    newGroups.push({ title: 'Лицензии и ПО', rows: licenseRows, subtotal: licensesSum });
  }

  if ((result.hddCount ?? 0) !== requiredHdd) {
    clarificationList.push(`Хранение: пересчитано на 30 дней по битрейту. Было ${result.hddCount ?? 0} HDD → требуется ${requiredHdd}.`);
  }
  if (reelCctvNeed !== reelCctvWas || reelIntercomNeed !== reelIntercomWas) {
    clarificationList.push('Кабель: бухты пересчитаны по метражу трасс + 15% запас.');
  }
  if (intercomDevices > INTERCOM_DEVICES_L3_THRESHOLD) {
    clarificationList.push('Сеть: добавлены L3 и настройка VLAN (устройств домофонии > 250).');
  }

  return {
    tableChanges,
    newGroups,
    newEquipment: newEquipmentBase,
    newConsumables: newConsumablesBase,
    newInstallationWork,
    newInstallationCommissioning,
    newInstallationCable,
    newGrandTotal,
    storageFix,
    cableFix,
    l3VlanAdded: l3VlanSum > 0,
    l3VlanSum,
    subscriberAdded: subscriberSum > 0,
    subscriberSum,
    licensesAdded: licensesSum > 0,
    licensesSum,
    poeBudgetTable,
    clarificationList,
  };
}

/** Форматирование итогов для отчёта */
export function formatRecalcReport(recalc: RecalcResult, _result: CalculatorResult): string {
  const lines: string[] = [];
  lines.push('=== ТАБЛИЦА ИЗМЕНЕНИЙ ===');
  lines.push('| Раздел | Было ₸ | Стало ₸ | Разница ₸ |');
  lines.push('|--------|--------|--------|-----------|');
  for (const c of recalc.tableChanges) {
    lines.push(`| ${c.section} | ${c.wasKzt.toLocaleString('ru-RU')} | ${c.becameKzt.toLocaleString('ru-RU')} | ${c.diffKzt >= 0 ? '+' : ''}${c.diffKzt.toLocaleString('ru-RU')} |`);
  }
  lines.push('');
  lines.push('=== ИТОГО ПО ПРОЕКТУ (НОВОЕ) ===');
  lines.push(`Оборудование: ${recalc.newEquipment.toLocaleString('ru-RU')} ₸`);
  lines.push(`Расходные материалы: ${recalc.newConsumables.toLocaleString('ru-RU')} ₸`);
  lines.push(`Монтажные работы: ${recalc.newInstallationWork.toLocaleString('ru-RU')} ₸`);
  lines.push(`Пусконаладка: ${recalc.newInstallationCommissioning.toLocaleString('ru-RU')} ₸`);
  lines.push(`Монтаж кабеля: ${recalc.newInstallationCable.toLocaleString('ru-RU')} ₸`);
  lines.push(`ИТОГО: ${recalc.newGrandTotal.toLocaleString('ru-RU')} ₸`);
  lines.push('');
  lines.push('=== POE-БЮДЖЕТ ===');
  lines.push('| Коммутатор | Бюджет Вт | Нагрузка Вт | Статус |');
  for (const row of recalc.poeBudgetTable) {
    lines.push(`| ${row.name} | ${row.budgetW} | ${row.loadW} | ${row.status} |`);
  }
  lines.push('');
  lines.push('=== ПОЗИЦИИ НА УТОЧНЕНИЕ У ЗАКАЗЧИКА ===');
  recalc.clarificationList.forEach((s) => lines.push('- ' + s));
  return lines.join('\n');
}
