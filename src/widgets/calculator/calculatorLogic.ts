/**
 * Логика расчёта калькулятора видеонаблюдения и домофонии.
 * Уличные/внутренние камеры, битрейт-хранение, кабель по трассам, домофония по квартирам, монтаж по статьям.
 */

import {
  cameraTypes,
  elevatorCameras,
  cableMetersPerCamera,
  radioBridgeConfig,
  cableConfig,
  patchCordConfig,
  patchPanelConfig,
  REEL_LENGTH_METERS,
  CABLE_RESERVE_FACTOR,
  FLOOR_HEIGHT_METERS,
  INTERCOM_CABLE_METERS_PER_FLOOR,
  INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL,
  hddConfig,
  jbodConfig,
  nvr256,
  nvrTiers,
  switchConfigs,
  rackConfig,
  upsConfig,
  accessoriesConfig,
  monitorConfig,
  serverRoomTier1,
  serverRoomTier2,
  intercomConfig,
  floorPoeSwitchConfig,
  entrancePanelConfig,
  consumablesIntercomPercent,
  installationConfig,
  INTERCOM_READERS_PER_CONTROLLER,
  intercomSwitches,
  consumablesCablePercent,
  NVR_MAX_HDD_SLOTS,
  STORAGE_BITRATE_MBPS_DEFAULT,
} from '@/shared/content/calculatorConfig';

/** Камеры: уличные 2MP, внутренние 2MP/4MP, камера опознавания номерного знака */
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

/** Тип объекта для карточки «Параметры объекта» */
export type ObjectType = 'ЖК' | 'Офис' | 'Паркинг' | '';

/** Срок хранения архива в днях: 30 (1 мес), 60 (2 мес), 90 (3 мес) */
export type StorageDays = 30 | 60 | 90;

export interface CalculatorInputs {
  /** Тип объекта (ЖК / Офис / Паркинг) */
  objectType?: ObjectType;
  /** Адрес или название объекта */
  objectNameOrAddress?: string;
  cameraTypes: CameraCounts;
  elevatorCount: number;
  elevatorCameraType: '2mp' | '4mp';
  archiveSettings: ArchiveSettings;
  /** Срок хранения архива в днях (ТЗ п.2): 30 / 60 / 90 */
  storageDays?: StorageDays;
  cableSettings: CableSettings;
  intercom: IntercomSettings;
  videoAnalytics: boolean;
  /** Патч-панель в стойке: true — камера×1 + NVR×4 + панели в BOM; false — только межоборудовательные (ТЗ п.1) */
  hasPatchPanel?: boolean;
  /** Есть пост охраны — добавляет монитор в смету на уровне 3 (крупный объект) */
  hasSecurityPost?: boolean;
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
  /** Объём архива в ТБ (для UI «X ТБ → Y дисков») */
  storageTotalTb?: number;
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

/** 2. Лифтовое оборудование (КП №14-26): камера, радиомост. Коммутаторы не добавляются — все камеры (в т.ч. лифтовые) считаются одним пулом в calculateSwitches. */
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
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, liftCount: n };
}

/** 3. Кабель: бухты по количеству POE-коммутаторов на этаже (по ЖК); вертикаль и метры из параметров здания (при отсутствии — из домофонии). CCTV-кабель только при наличии камер или лифтов. */
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
  const totalCctvDevices = ct.outdoor2mp + ct.indoor2mp + ct.indoor4mp + ct.anpr3mp + liftCount;
  const buildingFloors = input.cableSettings.buildingFloors > 0
    ? input.cableSettings.buildingFloors
    : (input.intercom.entrances * input.intercom.floorsPerEntrance) || 1;
  const buildingRisers = input.cableSettings.buildingRisers > 0
    ? input.cableSettings.buildingRisers
    : input.intercom.entrances || 1;

  let totalMeters: number;
  let totalMetersCctv: number;
  let totalMetersIntercom: number;
  let metersOutdoorCctv = 0;
  let metersIndoorCctv = 0;
  if (input.cableSettings.useManualLength && input.cableSettings.manualLengthPerCamera != null && input.cableSettings.manualLengthPerCamera > 0) {
    const totalRaw = totalCctvDevices * input.cableSettings.manualLengthPerCamera * CABLE_RESERVE_FACTOR;
    totalMetersCctv = Math.ceil(totalRaw);
    metersOutdoorCctv = 0;
    metersIndoorCctv = totalMetersCctv;
    totalMetersIntercom = 0;
    totalMeters = totalMetersCctv;
  } else {
    const verticalLength = totalCctvDevices > 0 ? buildingFloors * FLOOR_HEIGHT_METERS * buildingRisers : 0;
    metersOutdoorCctv = ct.outdoor2mp * cableMetersPerCamera.outdoor2mp + ct.anpr3mp * cableMetersPerCamera.anpr3mp;
    metersIndoorCctv =
      ct.indoor2mp * cableMetersPerCamera.indoor2mp +
      ct.indoor4mp * cableMetersPerCamera.indoor4mp +
      liftCount * cableMetersPerCamera.lift +
      verticalLength;
    totalMetersCctv = Math.ceil((metersOutdoorCctv + metersIndoorCctv) * CABLE_RESERVE_FACTOR);
    const carEntranceCableMeters = input.intercom.carEntrance.enabled
      ? (1 + input.intercom.carEntrance.gates + input.intercom.carEntrance.parking) * INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL
      : 0;
    const intercomLength =
      input.intercom.entrances * input.intercom.floorsPerEntrance * INTERCOM_CABLE_METERS_PER_FLOOR + carEntranceCableMeters;
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
  const reelOutdoorCctv =
    metersOutdoorCctv > 0 ? Math.max(1, Math.ceil((metersOutdoorCctv * CABLE_RESERVE_FACTOR) / REEL_LENGTH_METERS)) : 0;
  const reelIndoorCctv =
    metersIndoorCctv > 0 ? Math.max(1, Math.ceil((metersIndoorCctv * CABLE_RESERVE_FACTOR) / REEL_LENGTH_METERS)) : 0;
  const reelIntercom =
    totalMetersIntercom > 0
      ? Math.max(1, Math.ceil((totalMetersIntercom * CABLE_RESERVE_FACTOR) / REEL_LENGTH_METERS))
      : 0;
  const cableCostOutdoor = reelOutdoorCctv * cableConfig.outdoor.priceKzt;
  const cableCostIndoorCctv = reelIndoorCctv * cableConfig.indoor.priceKzt;
  const cableCostCctv = cableCostOutdoor + cableCostIndoorCctv;
  const cableCostIntercom = reelIntercom * cableConfig.indoor.priceKzt;
  const consumablesCctv = Math.round(cableCostCctv * consumablesCablePercent);
  const consumablesIntercom = Math.round(cableCostIntercom * consumablesCablePercent);
  const rowsCctv: LineItem[] = [];
  const rowsIntercom: LineItem[] = [];
  if (reelOutdoorCctv > 0) {
    rowsCctv.push({
      name: cableConfig.outdoor.name,
      qty: reelOutdoorCctv,
      unitPrice: cableConfig.outdoor.priceKzt,
      sum: cableCostOutdoor,
      note: `≈ ${Math.ceil(metersOutdoorCctv * CABLE_RESERVE_FACTOR)} м`,
    });
  }
  if (reelIndoorCctv > 0) {
    rowsCctv.push({
      name: cableConfig.indoor.name,
      qty: reelIndoorCctv,
      unitPrice: cableConfig.indoor.priceKzt,
      sum: cableCostIndoorCctv,
      note: `≈ ${Math.ceil(metersIndoorCctv * CABLE_RESERVE_FACTOR)} м`,
    });
  }
  if (rowsCctv.length > 0) {
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
  rows.push(...rowsCctv, ...rowsIntercom);
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

/**
 * 4. Хранение (ТЗ п.2): объём по формуле totalGB = cameras × bitrate × 3600 × 24 × storageDays / 8 / 1024,
 * hddCount = ceil(totalGB / 10TB). При hddCount > NVR_MAX_HDD_SLOTS добавляется JBOD.
 */
function calculateStorage(
  totalCamerasAll: number,
  storageDays: number,
  bitrateMbps: number = STORAGE_BITRATE_MBPS_DEFAULT,
): { rows: LineItem[]; sum: number; hddCount: number; totalTb: number } {
  if (totalCamerasAll <= 0) return { rows: [], sum: 0, hddCount: 0, totalTb: 0 };
  const totalGB = (totalCamerasAll * bitrateMbps * 3600 * 24 * storageDays) / 8 / 1024;
  const totalTb = totalGB / 1024;
  const hddCount = Math.ceil(totalGB / hddConfig.capacityGb);
  const rows: LineItem[] = [
    {
      name: hddConfig.name,
      qty: hddCount,
      unitPrice: hddConfig.priceKzt,
      sum: hddCount * hddConfig.priceKzt,
      note: `≈ ${totalTb.toFixed(1)} ТБ, ${storageDays} дн. (${totalCamerasAll} камер, ${bitrateMbps} Мбит/с)`,
    },
  ];
  if (hddCount > NVR_MAX_HDD_SLOTS) {
    const jbodCount = Math.ceil((hddCount - NVR_MAX_HDD_SLOTS) / jbodConfig.slots);
    rows.push({
      name: jbodConfig.label,
      qty: jbodCount,
      unitPrice: jbodConfig.priceKzt,
      sum: jbodCount * jbodConfig.priceKzt,
      note: `расширитель при > ${NVR_MAX_HDD_SLOTS} слотов NVR`,
    });
  }
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, hddCount, totalTb };
}

/** Количество патч-кордов: с патч-панелью — cameras + NVR×4; без — только в стойке (ТЗ п.1). */
function calculatePatchCords(
  cameras: number,
  nvrCount: number,
  switchCount: number,
  hasPatchPanel: boolean,
): number {
  if (hasPatchPanel) return cameras + nvrCount * 4;
  return switchCount + nvrCount * 2 + 2;
}

/** 5. NVR (КП №14-26). Один вызов на всю смету: total = outdoor + indoor + ANPR + lift; при видеоаналитике — NVR824-256R (⌈total/256⌉), иначе — минимально достаточный из nvrTiers. */
function calculateNVR(
  input: CalculatorInputs,
  liftCount: number,
): { rows: LineItem[]; sum: number; totalNvrCount: number } {
  const ct = input.cameraTypes;
  const total = ct.outdoor2mp + ct.indoor2mp + ct.indoor4mp + ct.anpr3mp + liftCount;
  if (total === 0) return { rows: [], sum: 0, totalNvrCount: 0 };

  if (input.videoAnalytics) {
    const qty = Math.ceil(total / 256);
    const rows: LineItem[] = [{
      name: nvr256.name + ' 256 кан.',
      qty,
      unitPrice: nvr256.priceKzt,
      sum: qty * nvr256.priceKzt,
    }];
    return { rows, sum: rows[0].sum, totalNvrCount: qty };
  }

  const tier = nvrTiers.find((t) => t.channels >= total) ?? nvrTiers[nvrTiers.length - 1];
  const rows: LineItem[] = [{
    name: tier.model + ' ' + tier.channels + ' кан.',
    qty: 1,
    unitPrice: tier.priceKzt,
    sum: tier.priceKzt,
  }];
  return { rows, sum: tier.priceKzt, totalNvrCount: 1 };
}

/** 6. Коммутаторы (КП №14-26): один пул — все камеры (уличные + внутренние + ANPR + лифтовые) → один NVR. Только WK-PS227GF 24 порта. */
function calculateSwitches(totalCameras: number): { rows: LineItem[]; sum: number; totalSwitchCount: number } {
  if (totalCameras <= 0) return { rows: [], sum: 0, totalSwitchCount: 0 };
  const PORTS = switchConfigs.poe_24port.ports;
  const qty = Math.ceil(totalCameras / PORTS);
  const rows: LineItem[] = [{
    name: switchConfigs.poe_24port.name,
    qty,
    unitPrice: switchConfigs.poe_24port.priceKzt,
    sum: qty * switchConfigs.poe_24port.priceKzt,
  }];
  return { rows, sum: rows[0].sum, totalSwitchCount: qty };
}

/** Уровень серверного оборудования: 1 — малый (1–20 камер, нет домофонии), 2 — средний (21–60 или домофония), 3 — крупный (60+). */
function getServerRoomTier(totalCameras: number, hasIntercom: boolean): 1 | 2 | 3 {
  if (totalCameras <= 20 && !hasIntercom) return 1;
  if (totalCameras <= 60) return 2;
  return 3;
}

/** 7–8. Серверное оборудование по уровню: стойка/аксессуары/ИБП/монитор только при наличии поста охраны. */
function calculateServerRoom(
  totalCameras: number,
  hasIntercom: boolean,
  hasSecurityPost: boolean,
): { rows: LineItem[]; sum: number } {
  const rows: LineItem[] = [];
  const tier = getServerRoomTier(totalCameras, hasIntercom);

  if (tier === 1) {
    rows.push({
      name: serverRoomTier1.ups.name,
      qty: 1,
      unitPrice: serverRoomTier1.ups.priceKzt,
      sum: serverRoomTier1.ups.priceKzt,
    });
    rows.push({
      name: serverRoomTier1.note,
      qty: 1,
      unitPrice: 0,
      sum: 0,
    });
    return { rows, sum: serverRoomTier1.ups.priceKzt };
  }

  if (tier === 2) {
    if (serverRoomTier2.rack) {
      rows.push({
        name: serverRoomTier2.rack.name,
        qty: 1,
        unitPrice: serverRoomTier2.rack.priceKzt,
        sum: serverRoomTier2.rack.priceKzt,
      });
    }
    const acc = serverRoomTier2.accessories;
    if (acc) {
      if (acc.fan > 0) {
        rows.push({
          name: accessoriesConfig.fanPanel.name,
          qty: acc.fan,
          unitPrice: accessoriesConfig.fanPanel.priceKzt,
          sum: acc.fan * accessoriesConfig.fanPanel.priceKzt,
        });
      }
      if (acc.organizer > 0) {
        rows.push({
          name: accessoriesConfig.cableOrganizer.name,
          qty: acc.organizer,
          unitPrice: accessoriesConfig.cableOrganizer.priceKzt,
          sum: acc.organizer * accessoriesConfig.cableOrganizer.priceKzt,
        });
      }
      if (acc.pdu > 0) {
        rows.push({
          name: accessoriesConfig.pdu.name,
          qty: acc.pdu,
          unitPrice: accessoriesConfig.pdu.priceKzt,
          sum: acc.pdu * accessoriesConfig.pdu.priceKzt,
        });
      }
    }
    rows.push({
      name: serverRoomTier2.ups.name,
      qty: 1,
      unitPrice: serverRoomTier2.ups.priceKzt,
      sum: serverRoomTier2.ups.priceKzt,
    });
    if (hasSecurityPost && monitorConfig) {
      rows.push({
        name: monitorConfig.name,
        qty: 1,
        unitPrice: monitorConfig.priceKzt,
        sum: monitorConfig.priceKzt,
      });
    }
    const sum = rows.reduce((a, r) => a + r.sum, 0);
    return { rows, sum };
  }

  // Уровень 3: стойка 27U, полный набор аксессуаров, ИБП 3 кВА, монитор только при посту охраны
  rows.push({ name: rackConfig.name, qty: 1, unitPrice: rackConfig.priceKzt, sum: rackConfig.priceKzt });
  rows.push({
    name: accessoriesConfig.fanPanel.name,
    qty: 1,
    unitPrice: accessoriesConfig.fanPanel.priceKzt,
    sum: accessoriesConfig.fanPanel.priceKzt,
  });
  rows.push({
    name: accessoriesConfig.cableOrganizer.name,
    qty: 2,
    unitPrice: accessoriesConfig.cableOrganizer.priceKzt,
    sum: 2 * accessoriesConfig.cableOrganizer.priceKzt,
  });
  rows.push({
    name: accessoriesConfig.pdu.name,
    qty: 1,
    unitPrice: accessoriesConfig.pdu.priceKzt,
    sum: accessoriesConfig.pdu.priceKzt,
  });
  rows.push({
    name: upsConfig.name,
    qty: upsConfig.qty,
    unitPrice: upsConfig.priceKzt,
    sum: upsConfig.qty * upsConfig.priceKzt,
  });
  if (hasSecurityPost) {
    rows.push({
      name: monitorConfig.name,
      qty: 1,
      unitPrice: monitorConfig.priceKzt,
      sum: monitorConfig.priceKzt,
    });
  }
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum };
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

/**
 * Расчёт устройств домофонии (системная логика):
 * - Вызывная панель = подъезд (1) или калитка (1). Паркинг в расчёт НЕ входит.
 * - panels = entrances + gates
 * - intercom_panels = apartments (квартиры)
 * - extra_readers = доп. считыватели
 * - total = panels + intercom_panels + extra_readers
 * - recommend_vlan = total > 500
 */
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
  const gates = carEntrance.enabled ? carEntrance.gates : 0;
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
  /** Итог устройств по правилам: вызывные = подъезды + калитки (паркинг не входит), интерком = квартиры, доп. считыватели */
  const panelsCount = entrances + gates;
  const intercomPanelsCount = totalFlats;
  const extraReaders = extraCardReaders ?? 0;
  const intercomDevices = panelsCount + intercomPanelsCount + extraReaders;

  const rows: LineItem[] = [];
  if (entranceCount > 0) {
    rows.push({
      name: entrancePanelConfig.label,
      qty: entranceCount,
      unitPrice: entrancePanelConfig.priceKzt,
      sum: entranceCount * entrancePanelConfig.priceKzt,
    });
  }
  if (entrances > 0) {
    rows.push({
      name: intercomConfig.panel.name,
      qty: entrances,
      unitPrice: intercomConfig.panel.priceKzt,
      sum: entrances * intercomConfig.panel.priceKzt,
      note: `подъезды ${entrances}`,
    });
  }
  if (carEntrance.enabled && carEntrance.gates > 0) {
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
  const liftResult = calculateLifts(input);
  const totalCamerasAll = totalCamerasMain + liftResult.liftCount;
  const hasCameras = totalCamerasAll > 0;
  const hasIntercom = input.intercom.entrances > 0 || input.intercom.carEntrance.enabled;
  if (!hasCameras && !hasIntercom) return null;

  const warnings: string[] = [];
  const groups: ResultGroup[] = [];

  const cameraResult = calculateCameras(input);
  if (cameraResult.rows.length > 0) {
    const cameraRows = [...cameraResult.rows];
    if (input.videoAnalytics) {
      cameraRows.push({ name: 'Видеоаналитика включена', qty: 1, unitPrice: null, sum: 0 });
    }
    groups.push({ title: 'Камеры видеонаблюдения', rows: cameraRows, subtotal: cameraResult.sum, system: 'cctv' });
  }

  if (liftResult.rows.length > 0) {
    groups.push({ title: 'Лифтовое оборудование', rows: [...liftResult.rows], subtotal: liftResult.sum, system: 'cctv' });
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

  const storageDays = input.storageDays ?? 30;
  const storageResult = calculateStorage(totalCamerasAll, storageDays);
  if (storageResult.rows.length > 0) {
    groups.push({ title: 'Хранение данных', rows: storageResult.rows, subtotal: storageResult.sum, system: 'cctv' });
  }

  const nvrResult = calculateNVR(input, liftResult.liftCount);
  if (totalCamerasAll > 256 && !input.videoAnalytics) {
    warnings.push('Более 256 каналов — рекомендуется включить видеоаналитику для единой точки управления');
  }
  if (cableResult.totalMeters > 0) {
    const reels = Math.ceil(cableResult.totalMeters / REEL_LENGTH_METERS);
    if (reels > 20) warnings.push('Большой объём кабельных работ — рекомендуется выезд замерщика');
  }

  const switchResult = calculateSwitches(totalCamerasAll);
  const totalSwitchCount = switchResult.totalSwitchCount;

  const totalNvrCount = nvrResult.totalNvrCount;
  const hasPatchPanel = input.hasPatchPanel ?? false;
  const patchCordCount = calculatePatchCords(totalCamerasAll, totalNvrCount, totalSwitchCount, hasPatchPanel);

  if (nvrResult.rows.length > 0 || switchResult.rows.length > 0) {
    const serverRows: LineItem[] = [...nvrResult.rows, ...switchResult.rows];
    if (hasPatchPanel && totalCamerasAll > 0) {
      const panelCount = Math.ceil(totalCamerasAll / patchPanelConfig.ports);
      serverRows.push({
        name: patchPanelConfig.label,
        qty: panelCount,
        unitPrice: patchPanelConfig.priceKzt,
        sum: panelCount * patchPanelConfig.priceKzt,
      });
    }
    const hasSecurityPost = input.hasSecurityPost ?? false;
    const serverRoomResult = calculateServerRoom(totalCamerasAll, hasIntercom, hasSecurityPost);
    serverRows.push(...serverRoomResult.rows);
    const serverSubtotal = serverRows.reduce((a, r) => a + r.sum, 0);
    groups.push({ title: 'Серверное оборудование', rows: serverRows, subtotal: serverSubtotal, system: 'cctv' });
  }

  const patchCordCost = patchCordCount * patchCordConfig.priceKzt;
  const cableCctvGroup = groups.find((g) => g.title === 'Кабельная продукция (видеонаблюдение)');
  if (cableCctvGroup && patchCordCount > 0 && totalCamerasAll > 0) {
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
    totalSwitchCount,
    hddCount: storageResult.hddCount,
    /** Объём архива в ТБ (для UI «X ТБ → Y дисков») */
    storageTotalTb: storageResult.totalTb,
    totalFlats,
    monthlyIntercomPerFlat: INTERCOM_RATE,
    monthlyCctvPerFlat: CCTV_RATE,
    monthlyIntercomTotal,
    monthlyCctvTotal,
    monthlyTotal,
    paybackMonths,
  };
}
