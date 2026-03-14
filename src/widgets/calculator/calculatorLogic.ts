/**
 * Логика расчёта калькулятора видеонаблюдения и домофонии.
 * Уличные/внутренние камеры, битрейт-хранение, кабель по трассам, домофония по квартирам, монтаж по статьям.
 */

import {
  cameraTypes,
  cameraBitrateMbps,
  liftBitrateMbps,
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
  STORAGE_RESERVE_FACTOR,
  NVR_MAX_HDD_SLOTS,
  nvrConfigs,
  switchConfigs,
  uplinkSwitchConfig,
  rackConfigs,
  upsConfigs,
  accessoriesConfig,
  intercomConfig,
  INTERCOM_READERS_PER_CONTROLLER,
  intercomSwitches,
  consumablesCablePercent,
  installationRates,
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
}

export interface IntercomSettings {
  entrances: number;
  floorsPerEntrance: number;
  flatsPerFloor: number;
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
}

export interface InstallationBreakdown {
  name: string;
  sum: number;
}

export interface CalculatorResult {
  groups: ResultGroup[];
  warnings: string[];
  equipment: number;
  installation: {
    total: number;
    breakdown: InstallationBreakdown[];
  };
  grandTotal: number;
  /** Для совместимости и PDF */
  totalCameras: number;
  totalCableMeters: number;
  totalNvrCount: number;
  totalSwitchCount: number;
  hddCount: number;
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
    name: switchConfigs.poe_8port.name + ' (для лифтов)',
    qty: switch8Count,
    unitPrice: switchConfigs.poe_8port.priceKzt,
    sum: switch8Count * switchConfigs.poe_8port.priceKzt,
  });
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, liftCount: n };
}

/** 3. Кабель: по типам камер (outdoor2mp/anpr 120 м, indoor 60 м) + лифт + вертикаль + домофония */
function calculateCable(
  input: CalculatorInputs,
  liftCount: number,
): { rows: LineItem[]; sum: number; totalMeters: number } {
  const rows: LineItem[] = [];
  const ct = input.cameraTypes;
  let totalMeters: number;
  if (input.cableSettings.useManualLength && input.cableSettings.manualLengthPerCamera != null && input.cableSettings.manualLengthPerCamera > 0) {
    const totalCameras = ct.outdoor2mp + ct.indoor2mp + ct.indoor4mp + ct.anpr3mp + liftCount;
    totalMeters = Math.ceil(totalCameras * input.cableSettings.manualLengthPerCamera * CABLE_RESERVE_FACTOR);
  } else {
    const horizontalCameras =
      ct.outdoor2mp * cableMetersPerCamera.outdoor2mp +
      ct.indoor2mp * cableMetersPerCamera.indoor2mp +
      ct.indoor4mp * cableMetersPerCamera.indoor4mp +
      ct.anpr3mp * cableMetersPerCamera.anpr3mp;
    const horizontalLift = liftCount * cableMetersPerCamera.lift;
    const verticalLength = input.cableSettings.buildingFloors * FLOOR_HEIGHT_METERS * input.cableSettings.buildingRisers;
    const carEntranceCableMeters = input.intercom.carEntrance.enabled
      ? (1 + input.intercom.carEntrance.gates + input.intercom.carEntrance.parking) * INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL
      : 0;
    const intercomLength =
      input.intercom.entrances * input.intercom.floorsPerEntrance * INTERCOM_CABLE_METERS_PER_FLOOR + carEntranceCableMeters;
    totalMeters = Math.ceil((horizontalCameras + horizontalLift + verticalLength + intercomLength) * CABLE_RESERVE_FACTOR);
  }
  if (totalMeters <= 0) return { rows, sum: 0, totalMeters: 0 };
  const reelCount = Math.ceil(totalMeters / REEL_LENGTH_METERS);
  const cableCost = reelCount * cableConfig.indoor.priceKzt;
  rows.push({
    name: cableConfig.indoor.name,
    qty: reelCount,
    unitPrice: cableConfig.indoor.priceKzt,
    sum: cableCost,
    note: `≈ ${totalMeters} м`,
  });
  const consumablesCost = Math.round(cableCost * consumablesCablePercent);
  rows.push({
    name: `Расходные материалы (${Math.round(consumablesCablePercent * 100)}% от UTP)`,
    qty: 0,
    unitPrice: null,
    sum: consumablesCost,
  });
  return { rows, sum: cableCost + consumablesCost, totalMeters };
}

/** 4. Хранение: по битрейту и типу записи. АНПР всегда continuous — пропуск кадра недопустим. */
function calculateStorage(
  input: CalculatorInputs,
  liftCount: number,
  effectiveRecordingType: 'continuous' | 'motion',
): { rows: LineItem[]; sum: number; requiredGb: number; hddCount: number } {
  const { months } = input.archiveSettings;
  const ct = input.cameraTypes;
  let totalBitrateMbps = 0;
  for (const key of CAMERA_KEYS) {
    const qty = ct[key];
    if (qty <= 0) continue;
    const br = cameraBitrateMbps[key];
    const rate =
      key === 'anpr3mp'
        ? br.continuous
        : effectiveRecordingType === 'continuous'
          ? br.continuous
          : br.motion;
    totalBitrateMbps += qty * rate;
  }
  if (input.elevatorCameraType === '2mp') totalBitrateMbps += liftCount * liftBitrateMbps.lift2mp;
  else totalBitrateMbps += liftCount * liftBitrateMbps.lift4mp;
  if (totalBitrateMbps <= 0) return { rows: [], sum: 0, requiredGb: 0, hddCount: 0 };
  const dailyGb = (totalBitrateMbps * 3600 * 24) / 8 / 1024;
  const archiveDays = months * 30;
  const totalArchiveGb = dailyGb * archiveDays;
  const requiredGb = Math.ceil(totalArchiveGb * STORAGE_RESERVE_FACTOR);
  const hddCount = Math.ceil(requiredGb / hddConfig.capacityGb);
  const sum = hddCount * hddConfig.priceKzt;
  const rows: LineItem[] = [
    {
      name: hddConfig.name,
      qty: hddCount,
      unitPrice: hddConfig.priceKzt,
      sum,
      note: `≈ ${Math.round(totalArchiveGb)} ГБ за ${months} мес. (${effectiveRecordingType === 'continuous' ? 'постоянная' : 'по движению'})`,
    },
  ];
  return { rows, sum, requiredGb, hddCount };
}

/** 5. NVR: жадный подбор по каналам; проверка слотов HDD */
function pickNVRs(channels: number): { channelCount: number; items: { channels: number; count: number }[] } {
  const sizes = [256, 64, 32, 16];
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
    const smallest = sizes.find((s) => s >= remaining) ?? 16;
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
  if (videoAnalytics) {
    const nvr256 = nvrConfigs.find((n) => n.key === 'nvr_256ch')!;
    rows.push({
      name: `${nvr256.name} (256 кан., видеоаналитика)`,
      qty: 1,
      unitPrice: nvr256.priceKzt,
      sum: nvr256.priceKzt,
    });
    channelsToCover = Math.max(0, channelsToCover - 256);
  }
  const { items } = pickNVRs(channelsToCover);
  for (const { channels: ch, count } of items) {
    const nvr = nvrConfigs.find((n) => n.channels === ch)!;
    if (nvr && count > 0) {
      rows.push({
        name: `${nvr.name} (${nvr.channels} кан.)`,
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

/** Умный подбор коммутаторов домофонии по количеству устройств (жадный, 1 порт под uplink) */
function pickIntercomSwitches(
  devices: number,
  models: readonly { ports: number; usable: number; name: string; priceKzt: number }[],
): { name: string; priceKzt: number; usable: number; count: number }[] {
  if (devices <= 0) return [];
  const sorted = [...models].sort((a, b) => b.usable - a.usable);
  let remaining = devices;
  const result: { name: string; priceKzt: number; usable: number; count: number }[] = [];

  for (const model of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / model.usable);
    if (count > 0) {
      result.push({ name: model.name, priceKzt: model.priceKzt, usable: model.usable, count });
      remaining -= count * model.usable;
    }
  }

  if (remaining > 0) {
    const fit = [...sorted].reverse().find((m) => m.usable >= remaining);
    if (fit) {
      const existing = result.find((r) => r.name === fit.name);
      if (existing) {
        existing.count += 1;
      } else {
        result.push({ name: fit.name, priceKzt: fit.priceKzt, usable: fit.usable, count: 1 });
      }
    }
  }

  return result;
}

/** 9. Домофония: панели, считыватели, контроллеры, коммутаторы (умный подбор по устройствам) */
function calculateIntercom(input: CalculatorInputs): {
  rows: LineItem[];
  sum: number;
  panels: number;
  readers: number;
  controllers: number;
  switchCount: number;
  intercomDevices: number;
} {
  const { entrances, floorsPerEntrance, flatsPerFloor, carEntrance, hasConcierge } = input.intercom;
  const carEntrancePanels = carEntrance.enabled ? 1 + carEntrance.gates + carEntrance.parking : 0;
  const panels = entrances * 1 + carEntrancePanels;
  const totalFlats = entrances * floorsPerEntrance * flatsPerFloor;
  const readers = totalFlats + entrances * floorsPerEntrance + (hasConcierge ? 2 : 0);
  const controllers = Math.ceil(readers / INTERCOM_READERS_PER_CONTROLLER);
  const intercomDevices = panels + readers + controllers;
  const switchPicks = pickIntercomSwitches(intercomDevices, intercomSwitches);
  const switchCount = switchPicks.reduce((a, s) => a + s.count, 0);

  const rows: LineItem[] = [];
  if (panels > 0) {
    const showBreakdown = carEntrance.enabled && (carEntrance.gates > 0 || carEntrance.parking > 0);
    rows.push({
      name: intercomConfig.panel.name,
      qty: panels,
      unitPrice: intercomConfig.panel.priceKzt,
      sum: panels * intercomConfig.panel.priceKzt,
      note: showBreakdown ? `в т.ч.: подъезды ${entrances}, калитки ${carEntrance.gates}, паркинг ${carEntrance.parking}` : undefined,
    });
  }
  if (readers > 0) {
    rows.push({
      name: intercomConfig.reader.name,
      qty: readers,
      unitPrice: intercomConfig.reader.priceKzt,
      sum: readers * intercomConfig.reader.priceKzt,
    });
  }
  if (controllers > 0) {
    rows.push({
      name: intercomConfig.controller.name,
      qty: controllers,
      unitPrice: intercomConfig.controller.priceKzt,
      sum: controllers * intercomConfig.controller.priceKzt,
    });
  }
  for (const s of switchPicks) {
    rows.push({
      name: s.name + ' (домофония)',
      qty: s.count,
      unitPrice: s.priceKzt,
      sum: s.count * s.priceKzt,
    });
  }
  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum, panels, readers, controllers, switchCount, intercomDevices };
}

/** 10. Монтаж по статьям */
function calculateInstallation(
  ct: CameraCounts,
  liftCount: number,
  totalCableMeters: number,
  nvrCount: number,
  switchCountTotal: number,
  intercomPanels: number,
  intercomReaders: number,
): { total: number; breakdown: InstallationBreakdown[] } {
  const r = installationRates;
  const breakdown: InstallationBreakdown[] = [];
  let total = 0;
  const outdoorCameras = ct.outdoor2mp + ct.anpr3mp;
  const indoorCameras = ct.indoor2mp + ct.indoor4mp;
  if (outdoorCameras > 0) {
    const s = outdoorCameras * r.cameraOutdoor;
    breakdown.push({ name: 'Монтаж камер уличных', sum: s });
    total += s;
  }
  if (indoorCameras > 0) {
    const s = indoorCameras * r.cameraIndoor;
    breakdown.push({ name: 'Монтаж камер внутренних', sum: s });
    total += s;
  }
  if (liftCount > 0) {
    const s = liftCount * r.cameraLift;
    breakdown.push({ name: 'Монтаж лифтовых камер', sum: s });
    total += s;
  }
  if (totalCableMeters > 0) {
    const s = totalCableMeters * r.cablePerMeter;
    breakdown.push({ name: 'Кабельные работы', sum: s });
    total += s;
  }
  if (nvrCount > 0) {
    const s = nvrCount * r.nvr;
    breakdown.push({ name: 'Монтаж NVR', sum: s });
    total += s;
  }
  if (switchCountTotal > 0) {
    const s = switchCountTotal * r.switch;
    breakdown.push({ name: 'Монтаж коммутаторов', sum: s });
    total += s;
  }
  if (intercomPanels > 0 || intercomReaders > 0) {
    const s = intercomPanels * r.panel + intercomReaders * r.reader;
    breakdown.push({ name: 'Монтаж домофонии', sum: s });
    total += s;
  }
  return { total, breakdown };
}

export function calculateResult(input: CalculatorInputs): CalculatorResult | null {
  const effectiveRecordingType = input.videoAnalytics ? 'continuous' : input.archiveSettings.recordingType;

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
    groups.push({
      title: 'Камеры видеонаблюдения',
      rows: cameraResult.rows,
      subtotal: cameraResult.sum,
    });
  }

  if (liftResult.rows.length > 0) {
    groups.push({
      title: 'Лифтовое оборудование',
      rows: liftResult.rows,
      subtotal: liftResult.sum,
    });
  }

  const intercomResult = calculateIntercom(input);
  const cableResult = calculateCable(input, liftResult.liftCount);
  if (cableResult.rows.length > 0) {
    groups.push({
      title: 'Кабельная продукция',
      rows: [...cableResult.rows],
      subtotal: cableResult.sum,
    });
  }

  const storageResult = calculateStorage(input, liftResult.liftCount, effectiveRecordingType);
  if (storageResult.rows.length > 0) {
    groups.push({
      title: 'Хранение данных',
      rows: storageResult.rows,
      subtotal: storageResult.sum,
    });
  }

  const totalChannels = totalCamerasAll;
  const nvrResult = calculateNVR(totalChannels, input.videoAnalytics);
  const maxHddSlots = nvrResult.totalNvrCount * NVR_MAX_HDD_SLOTS;
  const extraStorageUnits =
    storageResult.hddCount > maxHddSlots
      ? Math.ceil((storageResult.hddCount - maxHddSlots) / jbodConfig.slots)
      : 0;
  if (extraStorageUnits > 0) {
    warnings.push(`Требуется расширитель хранения: ${extraStorageUnits} ед.`);
  }
  if (totalChannels > 256 && !input.videoAnalytics) {
    warnings.push('Более 256 каналов — рекомендуется включить видеоаналитику для единой точки управления');
  }
  if (cableResult.totalMeters > 0) {
    const reels = Math.ceil(cableResult.totalMeters / REEL_LENGTH_METERS);
    if (reels > 20) warnings.push('Большой объём кабельных работ — рекомендуется выезд замерщика');
  }

  const liftSwitchCount = Math.ceil(liftResult.liftCount / 4);
  const switchResult = calculateSwitches(ct.outdoor2mp, indoorCameras, ct.anpr3mp, liftSwitchCount);
  const totalSwitchesForInstall = switchResult.totalSwitchCount + liftSwitchCount + intercomResult.switchCount;

  if (nvrResult.rows.length > 0 || switchResult.rows.length > 0) {
    const serverRows: LineItem[] = [...nvrResult.rows, ...switchResult.rows];
    if (extraStorageUnits > 0) {
      serverRows.push({
        name: jbodConfig.label,
        qty: extraStorageUnits,
        unitPrice: jbodConfig.priceKzt,
        sum: extraStorageUnits * jbodConfig.priceKzt,
      });
    }
    const rackResult = calculateRack(nvrResult.totalNvrCount, switchResult.totalSwitchCount, totalCamerasAll);
    serverRows.push(...rackResult.rows);
    const upsResult = calculateUPS(
      ct,
      liftResult.liftCount,
      nvrResult.totalNvrCount,
      switchResult.totalSwitchCount + liftSwitchCount + intercomResult.switchCount,
      intercomResult.controllers,
      extraStorageUnits,
    );
    serverRows.push(...upsResult.rows);
    if (upsResult.totalWatts > 5400) {
      warnings.push('Высокая нагрузка — рекомендуется резервное питание от дизель-генератора');
    }
    const jbodSum = extraStorageUnits * jbodConfig.priceKzt;
    const serverSubtotal = nvrResult.sum + switchResult.sum + jbodSum + rackResult.sum + upsResult.sum;
    groups.push({
      title: 'Серверное оборудование',
      rows: serverRows,
      subtotal: serverSubtotal,
    });
  }

  const patchCordCount = totalCamerasAll + nvrResult.totalNvrCount * 4;
  const patchCordCost = patchCordCount * patchCordConfig.priceKzt;
  const cableGroup = groups.find((g) => g.title === 'Кабельная продукция');
  if (cableGroup && patchCordCount > 0) {
    cableGroup.rows.push({
      name: patchCordConfig.label,
      qty: patchCordCount,
      unitPrice: patchCordConfig.priceKzt,
      sum: patchCordCost,
    });
    cableGroup.subtotal += patchCordCost;
  }

  if (intercomResult.rows.length > 0) {
    groups.push({
      title: 'Домофония',
      rows: intercomResult.rows,
      subtotal: intercomResult.sum,
    });
    if (intercomResult.intercomDevices > 500) {
      warnings.push(
        `Домофония: ${intercomResult.intercomDevices} устройств — рекомендуется разбить на подсети`,
      );
    }
  }

  const equipment = groups.reduce((a, g) => a + g.subtotal, 0);
  const installation = calculateInstallation(
    ct,
    liftResult.liftCount,
    cableResult.totalMeters,
    nvrResult.totalNvrCount,
    totalSwitchesForInstall,
    intercomResult.panels,
    intercomResult.readers,
  );
  const grandTotal = equipment + installation.total;

  return {
    groups,
    warnings,
    equipment,
    installation: {
      total: installation.total,
      breakdown: installation.breakdown,
    },
    grandTotal,
    totalCameras: totalCamerasAll,
    totalCableMeters: cableResult.totalMeters,
    totalNvrCount: nvrResult.totalNvrCount,
    totalSwitchCount: switchResult.totalSwitchCount,
    hddCount: storageResult.hddCount,
  };
}
