/**
 * Логика расчёта калькулятора видеонаблюдения и домофонии.
 * Уличные/внутренние камеры, битрейт-хранение, кабель по трассам, домофония по квартирам, монтаж по статьям.
 */

import {
  cameraTypes,
  elevatorCameras,
  cableMetersPerCamera,
  powerWattsPerCamera,
  radioBridgeConfig,
  cableConfig,
  patchCordConfig,
  REEL_LENGTH_METERS,
  CABLE_RESERVE_FACTOR,
  FLOOR_HEIGHT_METERS,
  INTERCOM_CABLE_METERS_PER_FLOOR,
  INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL,
  hddConfig,
  jbodConfig,
  nvrConfigs,
  switchConfigs,
  uplinkSwitchConfig,
  rackConfigs,
  upsConfigs,
  accessoriesConfig,
  intercomConfig,
  floorPoeSwitchConfig,
  entrancePanelConfig,
  consumablesIntercomPercent,
  installationConfig,
  INTERCOM_READERS_PER_CONTROLLER,
  intercomSwitches,
  consumablesCablePercent,
  powerWattsServer,
} from '@/shared/content/calculatorConfig';

/** Камеры: уличные 2MP, внутренние 2MP/4MP, АНПР */
export interface CameraCounts {
  outdoor2mp: number;
  indoor2mp: number;
  indoor4mp: number;
  anpr3mp: number;
}

export interface ArchiveSettings {
  months: 1 | 2 | 3;
  recordingType: 'continuous' | 'motion';
}

export interface CableSettings {
  useManualLength: boolean;
  manualLengthPerCamera?: number;
  buildingFloors: number;
  buildingRisers: number;
}

export interface CarEntranceSettings {
  enabled: boolean;
  gates: number;
  parking: number;
  /** Количество входов (ТЗ п.4): панель + считыватель на каждый вход */
  entranceCount: number;
}

export interface IntercomSettings {
  entrances: number;
  floorsPerEntrance: number;
  flatsPerFloor: number;
  /** Доп. интерком панели для квартир, прибавляются к расчётному количеству */
  extraCardReaders: number;
  carEntrance: CarEntranceSettings;
  hasConcierge: boolean;
}

export interface CalculatorInputs {
  cameraTypes: CameraCounts;
  elevatorCount: number;
  elevatorCameraType: '2mp' | '4mp';
  archiveSettings: ArchiveSettings;
  cableSettings: CableSettings;
  intercom: IntercomSettings;
  videoAnalytics: boolean;
}

export interface LineItem {
  name: string;
  qty: number;
  unitPrice: number | null;
  sum: number;
  note?: string;
}

/** @deprecated Use LineItem */
export type ResultRow = LineItem;

export interface ResultGroup {
  title: string;
  rows: LineItem[];
  subtotal: number;
  /** Для раздельных итогов по ТЗ п.4 */
  system?: 'cctv' | 'intercom';
}

export interface InstallationBreakdown {
  name: string;
  sum: number;
}

export interface CalculatorResult {
  groups: ResultGroup[];
  warnings: string[];
  /** Стоимость оборудования (без расходников для отображения в итоге по ТЗ п.9) */
  equipment: number;
  /** Расходные материалы: 25% кабель CCTV + 25% кабель домофония (ТЗ п.9) */
  consumables: number;
  installation: {
    work: number;
    commissioning: number;
    cableInstall: number;
    total: number;
    breakdown: InstallationBreakdown[];
    /** По системам для раздельных итогов (ТЗ п.4) */
    workCctv?: number;
    workIntercom?: number;
    commissioningCctv?: number;
    commissioningIntercom?: number;
    cableInstallCctv?: number;
    cableInstallIntercom?: number;
  };
  grandTotal: number;
  /** Итого по видеонаблюдению (оборудование + расходники + монтаж своей части) */
  totalCctv?: number;
  /** Итого по домофонии */
  totalIntercom?: number;
  /** Для совместимости и PDF */
  totalCameras: number;
  totalCableMeters: number;
  /** Метраж кабеля CCTV / домофония (для пересчёта по аудиту) */
  totalMetersCctv?: number;
  totalMetersIntercom?: number;
  totalNvrCount: number;
  totalSwitchCount: number;
  hddCount: number;
  /** Количество квартир (для блока финансовых условий) */
  totalFlats: number;
  /** Абонентская модель: ставка домофония ₸/кв/мес */
  monthlyIntercomPerFlat: number;
  /** Абонентская модель: ставка CCTV ₸/кв/мес */
  monthlyCctvPerFlat: number;
  /** Домофония: totalFlats × ставка */
  monthlyIntercomTotal: number;
  /** CCTV: totalFlats × ставка */
  monthlyCctvTotal: number;
  /** Сумма абонентской платы с дома в месяц */
  monthlyTotal: number;
  /** Срок окупаемости (мес.) */
  paybackMonths: number;
}

const CAMERA_KEYS = ['outdoor2mp', 'indoor2mp', 'indoor4mp', 'anpr3mp'] as const;

/** 1. Камеры видеонаблюдения */
function calculateCameras(input: CalculatorInputs): { rows: LineItem[]; sum: number } {
  const rows: LineItem[] = [];
  let sum = 0;
  const { cameraTypes: ct } = input;
  for (const key of CAMERA_KEYS) {
    const qty = ct[key];
    if (qty <= 0) continue;
    const config = cameraTypes[key];
    const rowSum = qty * config.priceKzt;
    rows.push({ name: config.label, qty, unitPrice: config.priceKzt, sum: rowSum });
    sum += rowSum;
  }
  return { rows, sum };
}

/** 2. Лифтовое оборудование (цены из elevatorCameras — антивандальный SKU) */
function calculateLifts(input: CalculatorInputs): { rows: LineItem[]; sum: number; liftCount: number } {
  const rows: LineItem[] = [];
  const n = input.elevatorCount;
  if (n <= 0) return { rows, sum: 0, liftCount: 0 };
  const liftCam = elevatorCameras[input.elevatorCameraType];
  rows.push({
    name: liftCam.label,
    qty: n,
    unitPrice: liftCam.priceKzt,
    sum: n * liftCam.priceKzt,
  });
  rows.push({ name: radioBridgeConfig.name, qty: n, unitPrice: radioBridgeConfig.priceKzt, sum: n * radioBridgeConfig.priceKzt });
  const switch8Count = Math.ceil(n / 4);
  rows.push({
    name: switchConfigs.poe_8port.name + ' для лифтов',
    qty: switch8Count,
    unitPrice: switchConfigs.poe_8port.priceKzt,
    sum: switch8Count * switchConfigs.poe_8port.priceKzt,
  });
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, liftCount: n };
}

/** 3. Кабель: бухты по количеству POE-коммутаторов на этаже (по ЖК); вертикаль и метры из параметров здания (при отсутствии — из домофонии) */
function calculateCable(
  input: CalculatorInputs,
  liftCount: number,
): {
  rows: LineItem[];
  sum: number;
  totalMeters: number;
  totalMetersCctv: number;
  totalMetersIntercom: number;
  rowsCctv: LineItem[];
  sumCctv: number;
  rowsIntercom: LineItem[];
  sumIntercom: number;
  consumablesCctv: number;
  consumablesIntercom: number;
} {
  const rows: LineItem[] = [];
  const ct = input.cameraTypes;
  const buildingFloors = input.cableSettings.buildingFloors > 0
    ? input.cableSettings.buildingFloors
    : (input.intercom.entrances * input.intercom.floorsPerEntrance) || 1;
  const buildingRisers = input.cableSettings.buildingRisers > 0
    ? input.cableSettings.buildingRisers
    : input.intercom.entrances || 1;

  let totalMeters: number;
  let totalMetersCctv: number;
  let totalMetersIntercom: number;
  if (input.cableSettings.useManualLength && input.cableSettings.manualLengthPerCamera != null && input.cableSettings.manualLengthPerCamera > 0) {
    const totalCameras = ct.outdoor2mp + ct.indoor2mp + ct.indoor4mp + ct.anpr3mp + liftCount;
    totalMetersCctv = Math.ceil(totalCameras * input.cableSettings.manualLengthPerCamera * CABLE_RESERVE_FACTOR);
    totalMetersIntercom = 0;
    totalMeters = totalMetersCctv;
  } else {
    const horizontalCameras =
      ct.outdoor2mp * cableMetersPerCamera.outdoor2mp +
      ct.indoor2mp * cableMetersPerCamera.indoor2mp +
      ct.indoor4mp * cableMetersPerCamera.indoor4mp +
      ct.anpr3mp * cableMetersPerCamera.anpr3mp;
    const horizontalLift = liftCount * cableMetersPerCamera.lift;
    const verticalLength = buildingFloors * FLOOR_HEIGHT_METERS * buildingRisers;
    const carEntranceCableMeters = input.intercom.carEntrance.enabled
      ? (1 + input.intercom.carEntrance.gates + input.intercom.carEntrance.parking) * INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL
      : 0;
    const intercomLength =
      input.intercom.entrances * input.intercom.floorsPerEntrance * INTERCOM_CABLE_METERS_PER_FLOOR + carEntranceCableMeters;
    totalMetersCctv = Math.ceil((horizontalCameras + horizontalLift + verticalLength) * CABLE_RESERVE_FACTOR);
    totalMetersIntercom = Math.ceil(intercomLength * CABLE_RESERVE_FACTOR);
    totalMeters = totalMetersCctv + totalMetersIntercom;
  }
  if (totalMeters <= 0) {
    return {
      rows,
      sum: 0,
      totalMeters: 0,
      totalMetersCctv: 0,
      totalMetersIntercom: 0,
      rowsCctv: [],
      sumCctv: 0,
      rowsIntercom: [],
      sumIntercom: 0,
      consumablesCctv: 0,
      consumablesIntercom: 0,
    };
  }
  /** Бухты по метражу: запас 15% на повороты и провисы (не по числу этажей) */
  const CABLE_MARGIN_REELS = 1.15;
  const reelCctv =
    totalMetersCctv > 0
      ? Math.max(1, Math.ceil((totalMetersCctv * CABLE_MARGIN_REELS) / REEL_LENGTH_METERS))
      : 0;
  const reelIntercom =
    totalMetersIntercom > 0
      ? Math.max(1, Math.ceil((totalMetersIntercom * CABLE_MARGIN_REELS) / REEL_LENGTH_METERS))
      : 0;
  const cableCostCctv = reelCctv * cableConfig.indoor.priceKzt;
  const cableCostIntercom = reelIntercom * cableConfig.indoor.priceKzt;
  const consumablesCctv = Math.round(cableCostCctv * consumablesCablePercent);
  const consumablesIntercom = Math.round(cableCostIntercom * consumablesCablePercent);
  const rowsCctv: LineItem[] = [];
  const rowsIntercom: LineItem[] = [];
  if (totalMetersCctv > 0) {
    rowsCctv.push({
      name: cableConfig.indoor.name,
      qty: reelCctv,
      unitPrice: cableConfig.indoor.priceKzt,
      sum: cableCostCctv,
      note: `≈ ${totalMetersCctv} м`,
    });
    rowsCctv.push({ name: 'Расходные материалы', qty: 0, unitPrice: null, sum: consumablesCctv });
  }
  if (totalMetersIntercom > 0) {
    rowsIntercom.push({
      name: cableConfig.indoor.name,
      qty: reelIntercom,
      unitPrice: cableConfig.indoor.priceKzt,
      sum: cableCostIntercom,
      note: `≈ ${totalMetersIntercom} м`,
    });
    rowsIntercom.push({ name: 'Расходные материалы', qty: 0, unitPrice: null, sum: consumablesIntercom });
  }
  const sumCctv = cableCostCctv + consumablesCctv;
  const sumIntercom = cableCostIntercom + consumablesIntercom;
  rows.push(
    ...rowsCctv,
    ...rowsIntercom,
  );
  return {
    rows,
    sum: sumCctv + sumIntercom,
    totalMeters,
    totalMetersCctv,
    totalMetersIntercom,
    rowsCctv,
    sumCctv,
    rowsIntercom,
    sumIntercom,
    consumablesCctv,
    consumablesIntercom,
  };
}

/** 4. Хранение: 1 HDD 10TB на каждые 10 камер (ТЗ п.7). */
function calculateStorage(totalCamerasAll: number): { rows: LineItem[]; sum: number; hddCount: number } {
  if (totalCamerasAll <= 0) return { rows: [], sum: 0, hddCount: 0 };
  const hddCount = Math.ceil(totalCamerasAll / 10);
  const sum = hddCount * hddConfig.priceKzt;
  const rows: LineItem[] = [
    {
      name: hddConfig.name,
      qty: hddCount,
      unitPrice: hddConfig.priceKzt,
      sum,
      note: `1 диск на 10 камер (всего ${totalCamerasAll} камер)`,
    },
  ];
  return { rows, sum, hddCount };
}

/** 5. NVR: жадный подбор по каналам из доступных размеров (с учётом analyticsOnly). */
function pickNVRs(
  channels: number,
  availableSizes: number[],
): { channelCount: number; items: { channels: number; count: number }[] } {
  const sizes = [...availableSizes].sort((a, b) => b - a);
  let remaining = channels;
  const items: { channels: number; count: number }[] = [];
  for (const size of sizes) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / size);
    if (count > 0) {
      items.push({ channels: size, count });
      remaining -= count * size;
    }
  }
  if (remaining > 0) {
    const smallest = sizes.find((s) => s >= remaining) ?? sizes[sizes.length - 1];
    items.push({ channels: smallest, count: 1 });
  }
  const channelCount = items.reduce((a, i) => a + i.channels * i.count, 0);
  return { channelCount, items };
}

function calculateNVR(
  totalChannels: number,
  videoAnalytics: boolean,
): { rows: LineItem[]; sum: number; totalNvrCount: number } {
  const rows: LineItem[] = [];
  let channelsToCover = totalChannels;
  const availableNvrs = videoAnalytics
    ? nvrConfigs
    : nvrConfigs.filter((n) => !n.analyticsOnly);

  if (videoAnalytics) {
    const nvr256 = nvrConfigs.find((n) => n.key === 'nvr_256ch')!;
    rows.push({
      name: nvr256.name + ' 256 кан. видеоаналитика',
      qty: 1,
      unitPrice: nvr256.priceKzt,
      sum: nvr256.priceKzt,
    });
    channelsToCover = Math.max(0, channelsToCover - 256);
  }

  const availableSizes = [...new Set(availableNvrs.map((n) => n.channels))];
  const { items } = pickNVRs(channelsToCover, availableSizes);
  for (const { channels: ch, count } of items) {
    const nvr = availableNvrs.find((n) => n.channels === ch)!;
    if (nvr && count > 0) {
      rows.push({
        name: `${nvr.name} ${nvr.channels} кан.`,
        qty: count,
        unitPrice: nvr.priceKzt,
        sum: count * nvr.priceKzt,
      });
    }
  }
  const totalNvrCount = rows.reduce((a, r) => a + r.qty, 0);
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, totalNvrCount };
}

/** 6. Коммутаторы: уличные, внутренние, АНПР/паркинг — отдельно; аплинк при >2 с учётом лифтовых. */
function calculateSwitches(
  outdoor2mp: number,
  indoorCameras: number,
  anpr3mp: number,
  liftSwitchCount: number,
): { rows: LineItem[]; sum: number; totalSwitchCount: number; needUplink: boolean } {
  const rows: LineItem[] = [];
  const EFFECTIVE = switchConfigs.poe_24port.effectivePorts ?? 22;
  const switchOutdoor = Math.ceil(outdoor2mp / EFFECTIVE);
  const switchIndoor = Math.ceil(indoorCameras / EFFECTIVE);
  const switchAnpr = anpr3mp > 0 ? Math.ceil(anpr3mp / EFFECTIVE) : 0;
  if (switchOutdoor > 0) {
    rows.push({
      name: switchConfigs.poe_24port.name + ' (уличные)',
      qty: switchOutdoor,
      unitPrice: switchConfigs.poe_24port.priceKzt,
      sum: switchOutdoor * switchConfigs.poe_24port.priceKzt,
    });
  }
  if (switchIndoor > 0) {
    rows.push({
      name: switchConfigs.poe_24port.name + ' (внутренние)',
      qty: switchIndoor,
      unitPrice: switchConfigs.poe_24port.priceKzt,
      sum: switchIndoor * switchConfigs.poe_24port.priceKzt,
    });
  }
  if (switchAnpr > 0) {
    rows.push({
      name: switchConfigs.poe_24port.name + ' (паркинг/АНПР)',
      qty: switchAnpr,
      unitPrice: switchConfigs.poe_24port.priceKzt,
      sum: switchAnpr * switchConfigs.poe_24port.priceKzt,
    });
  }
  const totalSwitchCount = switchOutdoor + switchIndoor + switchAnpr;
  const allAccessSwitches = totalSwitchCount + liftSwitchCount;
  const needUplink = allAccessSwitches > 2;
  if (needUplink) {
    rows.push({
      name: uplinkSwitchConfig.name,
      qty: 1,
      unitPrice: uplinkSwitchConfig.priceKzt,
      sum: uplinkSwitchConfig.priceKzt,
    });
  }
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, totalSwitchCount, needUplink };
}

/** 7. Шкаф + аксессуары: NVR×2U, коммутаторы×1U, патч-панели×1U, PDU 1U, вентиляция 1U, органайзер 1U */
function calculateRack(
  nvrCount: number,
  switchCount: number,
  totalCameras: number,
): { rows: LineItem[]; sum: number } {
  const rows: LineItem[] = [];
  const patchPanelCount = Math.ceil(totalCameras / 24);
  const totalUnits = nvrCount * 2 + switchCount * 1 + patchPanelCount * 1 + 1 + 1 + 1;
  let rack: (typeof rackConfigs)[keyof typeof rackConfigs] = rackConfigs.rack_18u;
  if (totalUnits > 24) rack = rackConfigs.rack_42u;
  else if (totalUnits > 15) rack = rackConfigs.rack_27u;
  rows.push({ name: rack.name, qty: 1, unitPrice: rack.priceKzt, sum: rack.priceKzt });
  rows.push({
    name: accessoriesConfig.fanPanel.name,
    qty: 1,
    unitPrice: accessoriesConfig.fanPanel.priceKzt,
    sum: accessoriesConfig.fanPanel.priceKzt,
  });
  const organizerCount = Math.max(Math.ceil(switchCount / 2), 2);
  rows.push({
    name: accessoriesConfig.cableOrganizer.name,
    qty: organizerCount,
    unitPrice: accessoriesConfig.cableOrganizer.priceKzt,
    sum: organizerCount * accessoriesConfig.cableOrganizer.priceKzt,
  });
  const pduCount = Math.max(Math.ceil((nvrCount + switchCount) / 4), 2);
  rows.push({
    name: accessoriesConfig.pdu.name,
    qty: pduCount,
    unitPrice: accessoriesConfig.pdu.priceKzt,
    sum: pduCount * accessoriesConfig.pdu.priceKzt,
  });
  const patchCount = Math.ceil(totalCameras / 24);
  rows.push({
    name: accessoriesConfig.patchPanel_24.name,
    qty: patchCount,
    unitPrice: accessoriesConfig.patchPanel_24.priceKzt,
    sum: patchCount * accessoriesConfig.patchPanel_24.priceKzt,
  });
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum };
}

/** 8. ИБП по уточнённой мощности (в т.ч. JBOD при нехватке слотов NVR) */
function calculateUPS(
  ct: CameraCounts,
  liftCount: number,
  nvrCount: number,
  switchCount: number,
  controllerCount: number,
  jbodUnits: number,
): { rows: LineItem[]; sum: number; totalWatts: number } {
  const Pcam =
    ct.outdoor2mp * powerWattsPerCamera.outdoor2mp +
    ct.indoor2mp * powerWattsPerCamera.indoor2mp +
    ct.indoor4mp * powerWattsPerCamera.indoor4mp +
    ct.anpr3mp * powerWattsPerCamera.anpr3mp;
  const Plift = liftCount * powerWattsPerCamera.lift;
  const Pnvr = nvrCount * powerWattsServer.nvr;
  const Psw = switchCount * powerWattsServer.switch;
  const Pctrl = controllerCount * powerWattsServer.controller;
  const Pjbod = jbodUnits * jbodConfig.powerW;
  const totalWatts = Math.ceil((Pcam + Plift + Pnvr + Psw + Pctrl + Pjbod) * 1.3);
  const units = [
    { va: 1000, w: 600, config: upsConfigs.ups_1kva },
    { va: 2000, w: 1200, config: upsConfigs.ups_2kva },
    { va: 3000, w: 1800, config: upsConfigs.ups_3kva },
  ];
  let remainingW = totalWatts;
  const rows: LineItem[] = [];
  let sum = 0;
  for (let i = units.length - 1; i >= 0 && remainingW > 0; i--) {
    const need = Math.ceil(remainingW / units[i].w);
    if (need > 0) {
      const count = need;
      rows.push({
        name: units[i].config.name,
        qty: count,
        unitPrice: units[i].config.priceKzt,
        sum: count * units[i].config.priceKzt,
      });
      sum += count * units[i].config.priceKzt;
      remainingW -= count * units[i].w;
    }
  }
  if (rows.length === 0 && totalWatts > 0) {
    const u = units[0];
    rows.push({ name: u.config.name, qty: 1, unitPrice: u.config.priceKzt, sum: u.config.priceKzt });
    sum = u.config.priceKzt;
  }
  return { rows, sum, totalWatts };
}

/** Подъездный коммутатор домофонии по этажам в подъезде: до 7 → 8п, 8–15 → 16п, 16–22 → 24п, >22 → каскад 24п */
function getEntranceSwitch(
  floorsPerEntrance: number,
): { name: string; priceKzt: number; countPerEntrance: number } | null {
  if (floorsPerEntrance <= 0) return null;
  if (floorsPerEntrance <= 7) {
    const m = intercomSwitches.find((s) => s.ports === 8)!;
    return { name: m.name, priceKzt: m.priceKzt, countPerEntrance: 1 };
  }
  if (floorsPerEntrance <= 15) {
    const m = intercomSwitches.find((s) => s.ports === 16)!;
    return { name: m.name, priceKzt: m.priceKzt, countPerEntrance: 1 };
  }
  const countPerEntrance = Math.ceil(floorsPerEntrance / 22);
  return {
    name: switchConfigs.poe_24port.name,
    priceKzt: switchConfigs.poe_24port.priceKzt,
    countPerEntrance,
  };
}

/** Магистральный коммутатор домофонии по количеству подъездов (только при entrances >= 2) */
function getMagistrationSwitch(
  entrances: number,
): { name: string; priceKzt: number; count: number }[] {
  if (entrances < 2) return [];
  const rows: { name: string; priceKzt: number; count: number }[] = [];
  if (entrances <= 7) {
    const m = intercomSwitches.find((s) => s.ports === 8)!;
    rows.push({ name: m.name, priceKzt: m.priceKzt, count: 1 });
  } else if (entrances <= 15) {
    const m = intercomSwitches.find((s) => s.ports === 16)!;
    rows.push({ name: m.name, priceKzt: m.priceKzt, count: 1 });
  } else {
    const count = Math.ceil(entrances / 22);
    rows.push({
      name: switchConfigs.poe_24port.name,
      priceKzt: switchConfigs.poe_24port.priceKzt,
      count,
    });
  }
  return rows;
}

/** 9. Домофония: панели, считыватели, контроллеры, этажные PoE (ТЗ п.3), коммутаторы, входы (ТЗ п.4), расходники (ТЗ п.2) */
function calculateIntercom(
  input: CalculatorInputs,
  cableGroupSubtotal: number,
): {
  rows: LineItem[];
  sum: number;
  panels: number;
  readers: number;
  controllers: number;
  switchCount: number;
  intercomDevices: number;
} {
  const { entrances, floorsPerEntrance, flatsPerFloor, extraCardReaders, carEntrance, hasConcierge } = input.intercom;
  const carEntrancePanels = carEntrance.enabled ? 1 + carEntrance.gates + carEntrance.parking : 0;
  const entranceCount = carEntrance.enabled ? carEntrance.entranceCount ?? 0 : 0;
  const panels = entrances * 1 + carEntrancePanels + entranceCount * 1;
  const totalFlats = entrances * floorsPerEntrance * flatsPerFloor;
  const readersFromFlats = totalFlats + entrances * floorsPerEntrance + (hasConcierge ? 2 : 0);
  const readers = readersFromFlats + (extraCardReaders ?? 0) + entranceCount;
  const controllers = Math.ceil(readers / INTERCOM_READERS_PER_CONTROLLER);
  const totalFloors = entrances * floorsPerEntrance;
  const floorSwitch = flatsPerFloor <= 4 ? floorPoeSwitchConfig.small : floorPoeSwitchConfig.large;
  const entranceSwitch = getEntranceSwitch(floorsPerEntrance);
  const magistrationRows = getMagistrationSwitch(entrances);
  let switchCount = totalFloors;
  if (entranceSwitch) switchCount += entrances * entranceSwitch.countPerEntrance;
  switchCount += magistrationRows.reduce((a, r) => a + r.count, 0);
  const intercomDevices = panels + readers + controllers + totalFloors;

  const rows: LineItem[] = [];
  if (entranceCount > 0) {
    rows.push({
      name: entrancePanelConfig.label,
      qty: entranceCount,
      unitPrice: entrancePanelConfig.priceKzt,
      sum: entranceCount * entrancePanelConfig.priceKzt,
    });
  }
  const panelsSubstairs = entrances + (carEntrance.enabled ? 1 : 0);
  if (panelsSubstairs > 0) {
    rows.push({
      name: intercomConfig.panel.name,
      qty: panelsSubstairs,
      unitPrice: intercomConfig.panel.priceKzt,
      sum: panelsSubstairs * intercomConfig.panel.priceKzt,
      note: entrances > 0 ? `подъезды ${entrances}` : undefined,
    });
  }
  if (carEntrance.gates > 0) {
    rows.push({
      name: 'Вызывная панель IP (калитка)',
      qty: carEntrance.gates,
      unitPrice: intercomConfig.panel.priceKzt,
      sum: carEntrance.gates * intercomConfig.panel.priceKzt,
    });
  }
  if (carEntrance.parking > 0) {
    rows.push({
      name: 'Вызывная панель IP (паркинг/въезд)',
      qty: carEntrance.parking,
      unitPrice: intercomConfig.panel.priceKzt,
      sum: carEntrance.parking * intercomConfig.panel.priceKzt,
    });
  }
  // Интерком панели для квартир и контроллер доступа — по запросу убраны из списка сметы (учёт в switchCount/мощности сохранён)
  if (totalFloors > 0) {
    rows.push({
      name: floorSwitch.label,
      qty: totalFloors,
      unitPrice: floorSwitch.priceKzt,
      sum: totalFloors * floorSwitch.priceKzt,
    });
  }
  if (entranceSwitch && entrances > 0) {
    const qty = entrances * entranceSwitch.countPerEntrance;
    rows.push({
      name: entranceSwitch.name + ' (подъезд)',
      qty,
      unitPrice: entranceSwitch.priceKzt,
      sum: qty * entranceSwitch.priceKzt,
    });
  }
  for (const s of magistrationRows) {
    rows.push({
      name: s.name + ' (магистраль домофония)',
      qty: s.count,
      unitPrice: s.priceKzt,
      sum: s.count * s.priceKzt,
    });
  }
  const consumablesIntercomSum = Math.round(cableGroupSubtotal * consumablesIntercomPercent);
  if (consumablesIntercomSum > 0) {
    rows.push({
      name: 'Расходные материалы',
      qty: 1,
      unitPrice: consumablesIntercomSum,
      sum: consumablesIntercomSum,
    });
  }
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, panels, readers, controllers, switchCount, intercomDevices };
}

/** 10. Монтаж по ТЗ п.8: 30% от оборудования по системе, пусконаладка 25% от монтажа, кабель 300 тг/м — раздельно CCTV/домофония (ТЗ п.4) */
function calculateInstallationTZ(
  equipmentCctv: number,
  equipmentIntercom: number,
  totalMetersCctv: number,
  totalMetersIntercom: number,
): {
  work: number;
  commissioning: number;
  cableInstall: number;
  total: number;
  breakdown: InstallationBreakdown[];
  workCctv: number;
  workIntercom: number;
  commissioningCctv: number;
  commissioningIntercom: number;
  cableInstallCctv: number;
  cableInstallIntercom: number;
} {
  const workCctv = Math.round(equipmentCctv * installationConfig.installationRate);
  const workIntercom = Math.round(equipmentIntercom * installationConfig.installationRate);
  const work = workCctv + workIntercom;
  const commissioningCctv = Math.round(workCctv * installationConfig.commissioningRate);
  const commissioningIntercom = Math.round(workIntercom * installationConfig.commissioningRate);
  const commissioning = commissioningCctv + commissioningIntercom;
  const cableInstallCctv = totalMetersCctv * installationConfig.cableInstallPerMeter;
  const cableInstallIntercom = totalMetersIntercom * installationConfig.cableInstallPerMeter;
  const cableInstall = cableInstallCctv + cableInstallIntercom;
  const total = work + commissioning + cableInstall;
  const breakdown: InstallationBreakdown[] = [
    { name: 'Монтажные работы', sum: work },
    { name: 'Пусконаладочные работы', sum: commissioning },
    { name: 'Монтаж кабеля', sum: cableInstall },
  ];
  return {
    work,
    commissioning,
    cableInstall,
    total,
    breakdown,
    workCctv,
    workIntercom,
    commissioningCctv,
    commissioningIntercom,
    cableInstallCctv,
    cableInstallIntercom,
  };
}

export function calculateResult(input: CalculatorInputs): CalculatorResult | null {
  const ct = input.cameraTypes;
  const totalCamerasMain = ct.outdoor2mp + ct.indoor2mp + ct.indoor4mp + ct.anpr3mp;
  const indoorCameras = ct.indoor2mp + ct.indoor4mp;
  const liftResult = calculateLifts(input);
  const totalCamerasAll = totalCamerasMain + liftResult.liftCount;
  const hasCameras = totalCamerasAll > 0;
  const hasIntercom = input.intercom.entrances > 0 || input.intercom.carEntrance.enabled;
  if (!hasCameras && !hasIntercom) return null;

  const warnings: string[] = [];
  const groups: ResultGroup[] = [];

  const cameraResult = calculateCameras(input);
  if (cameraResult.rows.length > 0) {
    groups.push({ title: 'Камеры видеонаблюдения', rows: cameraResult.rows, subtotal: cameraResult.sum, system: 'cctv' });
  }

  if (liftResult.rows.length > 0) {
    const liftRows = [...liftResult.rows];
    let liftSubtotal = liftResult.sum;
    const liftChannels = liftResult.liftCount;
    if (liftChannels > 0) {
      const nvrLift = calculateNVR(liftChannels, false);
      liftRows.push(...nvrLift.rows);
      liftSubtotal += nvrLift.sum;
    }
    groups.push({ title: 'Лифтовое оборудование', rows: liftRows, subtotal: liftSubtotal, system: 'cctv' });
  }

  const cableResult = calculateCable(input, liftResult.liftCount);
  if (cableResult.rowsCctv.length > 0 || cableResult.rowsIntercom.length > 0) {
    if (cableResult.rowsCctv.length > 0) {
      groups.push({
        title: 'Кабельная продукция (видеонаблюдение)',
        rows: [...cableResult.rowsCctv],
        subtotal: cableResult.sumCctv,
        system: 'cctv',
      });
    }
    if (cableResult.rowsIntercom.length > 0) {
      groups.push({
        title: 'Кабельная продукция (домофония)',
        rows: [...cableResult.rowsIntercom],
        subtotal: cableResult.sumIntercom,
        system: 'intercom',
      });
    }
  }

  const intercomResult = calculateIntercom(input, 0);
  if (intercomResult.rows.length > 0) {
    groups.push({ title: 'Домофония', rows: intercomResult.rows, subtotal: intercomResult.sum, system: 'intercom' });
    if (intercomResult.intercomDevices > 500) {
      warnings.push(`Домофония: ${intercomResult.intercomDevices} устройств — рекомендуется разбить на подсети`);
    }
  }

  const storageResult = calculateStorage(totalCamerasAll);
  if (storageResult.rows.length > 0) {
    groups.push({ title: 'Хранение данных', rows: storageResult.rows, subtotal: storageResult.sum, system: 'cctv' });
  }

  const totalCctvChannels = totalCamerasMain;
  const liftChannels = liftResult.liftCount;
  const nvrResult =
    totalCctvChannels > 0 ? calculateNVR(totalCctvChannels, input.videoAnalytics) : { rows: [] as LineItem[], sum: 0, totalNvrCount: 0 };
  const nvrLiftResult =
    liftChannels > 0 ? calculateNVR(liftChannels, false) : { totalNvrCount: 0 };
  if (totalCctvChannels > 256 && !input.videoAnalytics) {
    warnings.push('Более 256 каналов — рекомендуется включить видеоаналитику для единой точки управления');
  }
  if (cableResult.totalMeters > 0) {
    const reels = Math.ceil(cableResult.totalMeters / REEL_LENGTH_METERS);
    if (reels > 20) warnings.push('Большой объём кабельных работ — рекомендуется выезд замерщика');
  }

  const liftSwitchCount = Math.ceil(liftResult.liftCount / 4);
  const switchResult = calculateSwitches(ct.outdoor2mp, indoorCameras, ct.anpr3mp, liftSwitchCount);

  const totalNvrCount = nvrResult.totalNvrCount + nvrLiftResult.totalNvrCount;
  if (nvrResult.rows.length > 0 || switchResult.rows.length > 0) {
    const serverRows: LineItem[] = [...nvrResult.rows, ...switchResult.rows];
    const rackResult = calculateRack(totalNvrCount, switchResult.totalSwitchCount, totalCamerasAll);
    serverRows.push(...rackResult.rows);
    const upsResult = calculateUPS(
      ct,
      liftResult.liftCount,
      totalNvrCount,
      switchResult.totalSwitchCount + liftSwitchCount,
      intercomResult.controllers,
      0,
    );
    serverRows.push(...upsResult.rows);
    if (upsResult.totalWatts > 5400) {
      warnings.push('Высокая нагрузка — рекомендуется резервное питание от дизель-генератора');
    }
    const serverSubtotal =
      nvrResult.sum + switchResult.sum + rackResult.sum + upsResult.sum;
    groups.push({ title: 'Серверное оборудование', rows: serverRows, subtotal: serverSubtotal, system: 'cctv' });
  }

  const patchCordCount = totalCamerasAll + totalNvrCount * 4;
  const patchCordCost = patchCordCount * patchCordConfig.priceKzt;
  const cableCctvGroup = groups.find((g) => g.title === 'Кабельная продукция (видеонаблюдение)');
  if (cableCctvGroup && patchCordCount > 0) {
    cableCctvGroup.rows.push({
      name: patchCordConfig.label,
      qty: patchCordCount,
      unitPrice: patchCordConfig.priceKzt,
      sum: patchCordCost,
    });
    cableCctvGroup.subtotal += patchCordCost;
  }

  const equipmentTotal = groups.reduce((a, g) => a + g.subtotal, 0);
  const consumables = cableResult.consumablesCctv + cableResult.consumablesIntercom;
  const equipment = equipmentTotal - consumables;

  const equipmentCctv = groups.filter((g) => g.system === 'cctv').reduce((a, g) => a + g.subtotal, 0);
  const equipmentIntercom = groups.filter((g) => g.system === 'intercom').reduce((a, g) => a + g.subtotal, 0);
  const installation = calculateInstallationTZ(
    equipmentCctv,
    equipmentIntercom,
    cableResult.totalMetersCctv,
    cableResult.totalMetersIntercom,
  );
  const totalCctv = equipmentCctv + installation.workCctv + installation.commissioningCctv + installation.cableInstallCctv;
  const totalIntercom = equipmentIntercom + installation.workIntercom + installation.commissioningIntercom + installation.cableInstallIntercom;
  const grandTotal = equipment + consumables + installation.total;

  const totalFlats =
    input.intercom.entrances * input.intercom.floorsPerEntrance * input.intercom.flatsPerFloor || 0;
  const INTERCOM_RATE = 700;
  const CCTV_RATE = 900;
  const monthlyIntercomTotal = totalFlats * INTERCOM_RATE;
  const monthlyCctvTotal = totalFlats * CCTV_RATE;
  const monthlyTotal = monthlyIntercomTotal + monthlyCctvTotal;
  const paybackMonths =
    monthlyTotal > 0 ? Math.ceil(grandTotal / monthlyTotal) : 0;

  return {
    groups,
    warnings,
    equipment,
    consumables,
    installation: {
      work: installation.work,
      commissioning: installation.commissioning,
      cableInstall: installation.cableInstall,
      total: installation.total,
      breakdown: installation.breakdown,
      workCctv: installation.workCctv,
      workIntercom: installation.workIntercom,
      commissioningCctv: installation.commissioningCctv,
      commissioningIntercom: installation.commissioningIntercom,
      cableInstallCctv: installation.cableInstallCctv,
      cableInstallIntercom: installation.cableInstallIntercom,
    },
    grandTotal,
    totalCctv,
    totalIntercom,
    totalCameras: totalCamerasAll,
    totalCableMeters: cableResult.totalMeters,
    totalMetersCctv: cableResult.totalMetersCctv,
    totalMetersIntercom: cableResult.totalMetersIntercom,
    totalNvrCount,
    totalSwitchCount: switchResult.totalSwitchCount,
    hddCount: storageResult.hddCount,
    totalFlats,
    monthlyIntercomPerFlat: INTERCOM_RATE,
    monthlyCctvPerFlat: CCTV_RATE,
    monthlyIntercomTotal,
    monthlyCctvTotal,
    monthlyTotal,
    paybackMonths,
  };
}
