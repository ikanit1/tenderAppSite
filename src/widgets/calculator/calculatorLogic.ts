/**
 * Логика расчёта калькулятора видеонаблюдения для жилого дома.
 *
 * Применённая бизнес-логика:
 * — Зоны покрытия: только входные группы / весь дом
 * — Кабель UTP: 80 м на камеру (лифтовые камеры исключены), бухта 305 м = 51 700 ₸
 * — Бухта UTP = 305 м, округление вверх
 * — Расходные материалы = 35% от стоимости кабеля UTP
 * — Монтаж камер = 20 000 ₸/шт., монтаж кабеля = 230 ₸/м
 * — Хранение: каждые 25 камер = 1 диск 10 ТБ (HDD = ceil(камеры / 25))
 * — Серверная часть: фиксированная, нередактируемая (622 238 ₸)
 * — NVR и POE-коммутаторы: подбор по таблице согласно кол-ву камер
 */

// ═══════════════════════════════ КОНСТАНТЫ ════════════════════════════════

/** Метров кабеля UTP на одну камеру (лифтовые камеры не учитываются) */
const CABLE_METERS_PER_CAMERA = 80;

/** Метров в одной бухте UTP */
const UTP_REEL_LENGTH = 305;

/** Расходные материалы = 35 % от стоимости кабеля UTP */
const CONSUMABLES_RATE = 0.35;

/** Установка + пусконаладка одной камеры, ₸ */
const INSTALL_PER_CAMERA_KZT = 20_000;

/** Монтаж кабеля за метр, ₸ */
const CABLE_INSTALL_PER_METER_KZT = 230;

/** Цена одной бухты UTP (305 м), ₸ */
const UTP_REEL_PRICE_KZT = 51_700;

/** Хранение: каждые 25 камер = 1 диск 10 ТБ, округление вверх */
const HDD_CAMERAS_PER_DISK = 25;
const HDD_CAPACITY_TB = 10;
/** Цена одного жёсткого диска 10 ТБ, ₸ */
const HDD_PRICE_KZT = 220_000;

// ─── Купольная внутренняя камера (входные группы / этажи) ───
const DOME_CAMERA_PRICE_KZT = 14_400;
const DOME_CAMERA_MODEL = 'IPC-3612-APF28';

// ─── Уличная купольная камера (двор, калитки) ───
const OUTDOOR_CAMERA_PRICE_KZT = 14_400;
const OUTDOOR_CAMERA_MODEL = 'IPC-2122-APF28';

// ─── ANPR-камера распознавания номеров (паркинг) ───
const ANPR_CAMERA_PRICE_KZT = 274_300;
const ANPR_CAMERA_MODEL = 'PKC2630@Z28-IR-P';

// ─── Камера в лифт ───
const LIFT_CAMERA_PRICE_KZT = 19_900;
const LIFT_CAMERA_MODEL = 'IPC-324-PF28';

// ─── Радиомост 4-портовый POE (на каждый лифт) ───
const RADIO_BRIDGE_PRICE_KZT = 36_750;
const RADIO_BRIDGE_MODEL = 'WK-WB08-KIT';

// ═════════════════════════ СЕРВЕРНАЯ ЧАСТЬ (фиксированная) ════════════════

/**
 * Серверная часть всегда включается в смету автоматически.
 * Пользователь не может её убрать.
 */
const SERVER_ROOM_ITEMS: LineItem[] = [
  {
    name: 'Монтажный шкаф напольный 19" 27U SHIP 601S.6027.24.100',
    qty: 1,
    unitPrice: 283_773,
    sum: 283_773,
  },
  {
    name: 'ИБП онлайн 3000 ВА / 2700 Вт SVC LRT-3KL-LCD',
    qty: 1,
    unitPrice: 247_990,
    sum: 247_990,
  },
  {
    name: 'Вентиляторная панель с термостатом SHIP 700402112Т',
    qty: 1,
    unitPrice: 30_397,
    sum: 30_397,
  },
  {
    name: 'Кабельный органайзер 19" 1U 5 колец SHIP 701402120',
    qty: 5,
    unitPrice: 3_279,
    sum: 16_395,
  },
  {
    name: 'PDU сетевой фильтр 8 розеток SHIP 700508102',
    qty: 2,
    unitPrice: 12_324,
    sum: 24_648,
  },
  {
    name: 'Патч-панель 19"',
    qty: 1,
    unitPrice: 19_035,
    sum: 19_035,
  },
];

const SERVER_ROOM_TOTAL = SERVER_ROOM_ITEMS.reduce((acc, r) => acc + r.sum, 0);
// SERVER_ROOM_TOTAL = 622 238 ₸

// ════════════════════════════ ТИПЫ И ИНТЕРФЕЙСЫ ═══════════════════════════

export interface LineItem {
  name: string;
  qty: number;
  unitPrice: number | null;
  sum: number;
  note?: string;
}

export interface ResultGroup {
  title: string;
  rows: LineItem[];
  subtotal: number;
}

export interface InstallationBreakdown {
  name: string;
  sum: number;
}

// ──────────────────────────── Входные данные ─────────────────────────────

/** Тип охвата видеонаблюдением */
export type CoverageType = 'entrance_only' | 'whole_building';

export interface BuildingParams {
  /** Количество подъездов */
  entrances: number;
  /** Количество этажей */
  floors: number;
  /** Количество лифтов */
  elevators: number;
  /** Количество дворовых калиток */
  yardGates: number;
  /** Есть ли паркинг */
  hasParking: boolean;
  /** Количество въездных ворот / шлагбаумов паркинга */
  parkingGates: number;
  /** Тип охвата видеонаблюдением */
  coverageType: CoverageType;
  /** 2 камеры на этаж (только при «весь дом»); иначе 1 камера на этаж */
  twoCamerasPerFloor: boolean;
  /** Устанавливать ли камеры в лифтах */
  hasCamerasInLifts: boolean;
  /** Количество камер внутри паркинга (уличные купольные IPC-2122-APF28) */
  parkingCameras: number;
}

export interface CalculatorResult {
  groups: ResultGroup[];
  warnings: string[];
  totalCameras: number;
  /** Камеры, исключённые из расчёта кабеля (лифтовые) */
  liftCameras: number;
  totalCableMeters: number;
  utpReels: number;
  /** Стоимость оборудования (без расходников и монтажа) */
  equipment: number;
  /** Расходные материалы (35 % от стоимости кабеля UTP) */
  consumables: number;
  installation: {
    /** Установка и пусконаладка камер */
    cameraInstall: number;
    /** Монтаж кабеля */
    cableInstall: number;
    total: number;
    breakdown: InstallationBreakdown[];
  };
  grandTotal: number;
  /** Для совместимости с UI/экспортом (текущая логика — только видеонаблюдение) */
  totalFlats?: number;
  monthlyIntercomPerFlat?: number;
  monthlyCctvPerFlat?: number;
  monthlyIntercomTotal?: number;
  monthlyCctvTotal?: number;
  monthlyTotal?: number;
  paybackMonths?: number;
  /** Для модуля пересчёта сметы (estimateRecalculation) */
  totalMetersCctv?: number;
  totalMetersIntercom?: number;
  hddCount?: number;
  /** Суммарный объём хранилища, ТБ (hddCount × 10) */
  storageTotalTb?: number;
}

// ══════════════════════════ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ═══════════════════════

/** Округление вверх */
function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

// ────────────────────────── 1. Камеры ────────────────────────────────────

/**
 * Расчёт камер по зонам:
 *
 * Входные группы (подъезды):
 *   — «entrance_only»: 3 купольные камеры × кол-во подъездов
 *   — «whole_building»: 3 купольные камеры × подъезды (входные группы, 1-й этаж)
 *                     + подъезды × (этажи − 1) × [1 или 2] камеры на этаж (флаг twoCamerasPerFloor)
 *
 * Двор:
 *   — 2 уличные камеры × кол-во подъездов (со стороны двора)
 *   — 1 уличная камера × кол-во калиток
 *
 * Паркинг:
 *   — 1 ANPR-камера × кол-во ворот/шлагбаумов
 *
 * Лифты:
 *   — 1 камера + 1 радиомост POE × кол-во лифтов
 */
function calculateCameras(params: BuildingParams): {
  rows: LineItem[];
  sum: number;
  totalCameras: number;
  liftCameras: number;
} {
  const rows: LineItem[] = [];
  let sum = 0;
  let totalCameras = 0;
  let liftCameras = 0;

  const { entrances, floors, elevators, yardGates, hasParking, parkingGates, parkingCameras, coverageType, twoCamerasPerFloor, hasCamerasInLifts } =
    params;

  // ── Входные группы: 3 купольные камеры на каждый подъезд ──
  if (entrances > 0) {
    const qty = entrances * 3;
    const rowSum = qty * DOME_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера купольная внутренняя (входная группа) — ${DOME_CAMERA_MODEL}`,
      qty,
      unitPrice: DOME_CAMERA_PRICE_KZT,
      sum: rowSum,
      note: `${entrances} подъезд(ов) × 3 камеры`,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Весь дом: этажные камеры со 2-го этажа (1 или 2 на этаж по флагу) ──
  if (coverageType === 'whole_building' && entrances > 0 && floors > 1) {
    const floorsAboveGround = floors - 1;
    const camerasPerFloor = twoCamerasPerFloor ? 2 : 1;
    const qty = entrances * floorsAboveGround * camerasPerFloor;
    const rowSum = qty * DOME_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера купольная внутренняя (этажи со 2-го) — ${DOME_CAMERA_MODEL}`,
      qty,
      unitPrice: DOME_CAMERA_PRICE_KZT,
      sum: rowSum,
      note: `${entrances} подъезд(ов) × (${floors} − 1) этаж. × ${camerasPerFloor} камеры`,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Двор: 2 уличные камеры на каждый подъезд ──
  if (entrances > 0) {
    const qty = entrances * 2;
    const rowSum = qty * OUTDOOR_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера уличная купольная (двор) — ${OUTDOOR_CAMERA_MODEL}`,
      qty,
      unitPrice: OUTDOOR_CAMERA_PRICE_KZT,
      sum: rowSum,
      note: `${entrances} подъезд(ов) × 2 камеры`,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Калитки: 1 уличная камера на каждую калитку ──
  if (yardGates > 0) {
    const qty = yardGates;
    const rowSum = qty * OUTDOOR_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера уличная (дворовая калитка) — ${OUTDOOR_CAMERA_MODEL}`,
      qty,
      unitPrice: OUTDOOR_CAMERA_PRICE_KZT,
      sum: rowSum,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Паркинг: ANPR-камера на каждые ворота / шлагбаум ──
  if (hasParking && parkingGates > 0) {
    const qty = parkingGates;
    const rowSum = qty * ANPR_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера распознавания номеров (ANPR) — ${ANPR_CAMERA_MODEL}`,
      qty,
      unitPrice: ANPR_CAMERA_PRICE_KZT,
      sum: rowSum,
      note: `${qty} ворот/шлагбаумов`,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Паркинг: уличные камеры внутри паркинга ──
  if (hasParking && parkingCameras > 0) {
    const qty = parkingCameras;
    const rowSum = qty * OUTDOOR_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера уличная (паркинг) — ${OUTDOOR_CAMERA_MODEL}`,
      qty,
      unitPrice: OUTDOOR_CAMERA_PRICE_KZT,
      sum: rowSum,
      note: `${qty} камер в паркинге`,
    });
    sum += rowSum;
    totalCameras += qty;
  }

  // ── Лифты: 1 камера + 1 радиомост POE на каждый лифт ──
  if (hasCamerasInLifts && elevators > 0) {
    const camQty = elevators;
    const camSum = camQty * LIFT_CAMERA_PRICE_KZT;
    rows.push({
      name: `Камера в лифт — ${LIFT_CAMERA_MODEL}`,
      qty: camQty,
      unitPrice: LIFT_CAMERA_PRICE_KZT,
      sum: camSum,
    });

    const bridgeSum = elevators * RADIO_BRIDGE_PRICE_KZT;
    rows.push({
      name: `Радиомост 4-портовый POE (лифт) — ${RADIO_BRIDGE_MODEL}`,
      qty: elevators,
      unitPrice: RADIO_BRIDGE_PRICE_KZT,
      sum: bridgeSum,
    });

    sum += camSum + bridgeSum;
    totalCameras += camQty;
    liftCameras = camQty; // лифтовые камеры исключаются из расчёта кабеля
  }

  return { rows, sum, totalCameras, liftCameras };
}

// ─────────────────────── 2. Видеорегистраторы (NVR) ──────────────────────

/**
 * Таблица подбора NVR по количеству камер:
 *
 * 1–32    → 1× 32-кан.
 * 33–48   → 1× 32-кан. + 1× 16-кан.
 * 49–64   → 1× 64-кан.
 * 65–80   → 1× 64-кан. + 1× 16-кан.
 * 81–96   → 1× 64-кан. + 1× 32-кан.
 * 97–112  → 1× 64-кан. + 1× 48-кан.
 * 113–128 → 1× 128-кан.
 * 129–160 → 1× 128-кан. + 1× 32-кан.
 */

// Цены и модели NVR по количеству каналов
const NVR_PRICES: Record<16 | 32 | 48 | 64 | 128, number> = {
  16: 72_900,
  32: 120_000,
  48: 240_000, // модель не указана в прайсе
  64: 335_000,
  128: 756_000,
};
const NVR_MODELS: Record<16 | 32 | 48 | 64 | 128, string> = {
  16: 'NVR501-16B',
  32: 'NVR-302-32-IQ',
  48: 'NVR-508-48-E',
  64: 'NVR-508-64-E',
  128: 'NVR508-128E-R',
};

interface NvrLineItem {
  channels: number;
  qty: number;
}

function getNvrSpec(totalCameras: number): NvrLineItem[] {
  if (totalCameras <= 0) return [];
  if (totalCameras <= 32) return [{ channels: 32, qty: 1 }];
  if (totalCameras <= 48) return [{ channels: 32, qty: 1 }, { channels: 16, qty: 1 }];
  if (totalCameras <= 64) return [{ channels: 64, qty: 1 }];
  if (totalCameras <= 80) return [{ channels: 64, qty: 1 }, { channels: 16, qty: 1 }];
  if (totalCameras <= 96) return [{ channels: 64, qty: 1 }, { channels: 32, qty: 1 }];
  if (totalCameras <= 112) return [{ channels: 64, qty: 1 }, { channels: 48, qty: 1 }];
  if (totalCameras <= 128) return [{ channels: 128, qty: 1 }];
  if (totalCameras <= 160) return [{ channels: 128, qty: 1 }, { channels: 32, qty: 1 }];
  // > 160 — добавляем 128-кан. регистраторы с добором 32-кан.
  const base128 = Math.floor(totalCameras / 128);
  const remainder = totalCameras % 128;
  const spec: NvrLineItem[] = [{ channels: 128, qty: base128 }];
  if (remainder > 0) {
    const extra = getNvrSpec(remainder);
    spec.push(...extra);
  }
  return spec;
}

function calculateNVR(totalCameras: number): { rows: LineItem[]; sum: number } {
  const spec = getNvrSpec(totalCameras);
  if (spec.length === 0) return { rows: [], sum: 0 };

  const rows: LineItem[] = spec.map((s) => {
    const ch = s.channels as keyof typeof NVR_PRICES;
    const price = NVR_PRICES[ch] ?? 0;
    const model = NVR_MODELS[ch] ?? '';
    return {
      name: `Видеорегистратор ${s.channels}-канальный — ${model}`,
      qty: s.qty,
      unitPrice: price,
      sum: s.qty * price,
    };
  });

  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum };
}

// ─────────────────────── 3. POE-коммутаторы ──────────────────────────────

/**
 * Таблица подбора POE-коммутаторов:
 *
 * 1–8   → 1× 8-портовый POE
 * 9–16  → 1× 16-портовый POE
 * 17–24 → 1× 24-портовый POE
 * 25–48 → 1× 48-портовый POE
 * > 48  → несколько коммутаторов (каскад, добор 48-портовыми)
 *
 * Примечание: радиомосты POE на лифты работают автономно
 * и не входят в общий расчёт коммутаторов.
 */

// Цены и модели POE-коммутаторов по количеству портов
const SWITCH_PRICES: Record<8 | 16 | 24 | 48, number> = {
  8: 39_150,
  16: 66_300,
  24: 90_200,
  48: 464_100,
};
const SWITCH_MODELS: Record<8 | 16 | 24 | 48, string> = {
  8: 'NSW2100-9GT1GP-POE-IN',
  16: 'Wi-Tek WK-PS320GF (Wiking series)',
  24: 'Wi-Tek WK-PS328GF (Wiking series)',
  48: 'WI-PCMS554F-L3 V2',
};

function getSwitchSpec(totalCameras: number): Array<{ ports: 8 | 16 | 24 | 48; qty: number }> {
  if (totalCameras <= 0) return [];
  if (totalCameras <= 8) return [{ ports: 8, qty: 1 }];
  if (totalCameras <= 16) return [{ ports: 16, qty: 1 }];
  if (totalCameras <= 24) return [{ ports: 24, qty: 1 }];
  if (totalCameras <= 48) return [{ ports: 48, qty: 1 }];
  // > 48: рассчитываем количество 48-портовых + добор
  const qty48 = Math.floor(totalCameras / 48);
  const remainder = totalCameras % 48;
  const spec: Array<{ ports: 8 | 16 | 24 | 48; qty: number }> = [];
  if (qty48 > 0) spec.push({ ports: 48, qty: qty48 });
  if (remainder > 0) {
    const extra = getSwitchSpec(remainder);
    extra.forEach((e) => spec.push(e));
  }
  return spec;
}

function calculateSwitches(totalCameras: number): { rows: LineItem[]; sum: number } {
  const spec = getSwitchSpec(totalCameras);
  if (spec.length === 0) return { rows: [], sum: 0 };

  // Объединяем одинаковые порты
  const merged: Record<number, number> = {};
  spec.forEach((s) => {
    merged[s.ports] = (merged[s.ports] ?? 0) + s.qty;
  });

  const rows: LineItem[] = Object.entries(merged).map(([ports, qty]) => {
    const p = parseInt(ports) as 8 | 16 | 24 | 48;
    const price = SWITCH_PRICES[p] ?? 0;
    const model = SWITCH_MODELS[p] ?? '';
    return {
      name: `POE-коммутатор ${p}-портовый — ${model}`,
      qty,
      unitPrice: price,
      sum: qty * price,
    };
  });

  const sum = rows.reduce((a, r) => a + r.sum, 0);
  return { rows, sum };
}

// ─────────────────────── 4. Кабель UTP + расходники ──────────────────────

/**
 * Расчёт кабеля UTP:
 * — 80 м на каждую камеру (лифтовые камеры исключены — работают через радиомост)
 * — Бухта = 305 м, количество бухт округляется вверх
 * — Расходные материалы = 35 % от стоимости кабеля
 *
 * Состав расходных материалов (одной строкой в смете):
 *   хомуты, скобы, дюбели, гофра/кабель-канал,
 *   коннекторы RJ45, изолента, монтажная пена
 */
function calculateCable(totalCameras: number, liftCameras: number): {
  rows: LineItem[];
  sum: number;
  totalMeters: number;
  reels: number;
  cableCost: number;
  consumables: number;
} {
  const camerasForCable = totalCameras - liftCameras;
  if (camerasForCable <= 0) {
    return { rows: [], sum: 0, totalMeters: 0, reels: 0, cableCost: 0, consumables: 0 };
  }

  const totalMeters = camerasForCable * CABLE_METERS_PER_CAMERA;
  const reels = ceilDiv(totalMeters, UTP_REEL_LENGTH);
  const cableCost = reels * UTP_REEL_PRICE_KZT;
  const consumables = Math.round(cableCost * CONSUMABLES_RATE);

  const rows: LineItem[] = [
    {
      name: `Кабель UTP Cat5e (бухта ${UTP_REEL_LENGTH} м)`,
      qty: reels,
      unitPrice: UTP_REEL_PRICE_KZT,
      sum: cableCost,
      note: `${camerasForCable} камер × ${CABLE_METERS_PER_CAMERA} м = ${totalMeters} м → ${reels} бухт`,
    },
    {
      name: 'Расходные материалы (хомуты, гофра, коннекторы RJ45, дюбели, изолента, монтажная пена)',
      qty: 1,
      unitPrice: consumables,
      sum: consumables,
      note: `35 % от стоимости кабеля (${cableCost.toLocaleString('ru-RU')} ₸)`,
    },
  ];

  return {
    rows,
    sum: cableCost + consumables,
    totalMeters,
    reels,
    cableCost,
    consumables,
  };
}

// ─────────────────────── 5. Монтажные работы ─────────────────────────────

/**
 * Монтажные работы:
 * — Установка и пусконаладка: 20 000 ₸ × кол-во камер
 * — Монтаж кабеля: 230 ₸ × кол-во метров
 */
function calculateInstallation(totalCameras: number, totalMeters: number): {
  cameraInstall: number;
  cableInstall: number;
  total: number;
  breakdown: InstallationBreakdown[];
} {
  const cameraInstall = totalCameras * INSTALL_PER_CAMERA_KZT;
  const cableInstall = totalMeters * CABLE_INSTALL_PER_METER_KZT;
  const total = cameraInstall + cableInstall;

  const breakdown: InstallationBreakdown[] = [
    { name: 'Установка и пусконаладка камер', sum: cameraInstall },
    { name: 'Монтаж кабеля', sum: cableInstall },
  ];

  return { cameraInstall, cableInstall, total, breakdown };
}

// ─────────────────────── 5a. Хранение данных (HDD) ───────────────────────

/**
 * Жёсткие диски для архива:
 * — HDD = ceil(камеры / 25)
 * — Каждый диск = 10 ТБ
 */
function calculateStorage(totalCameras: number): {
  rows: LineItem[];
  sum: number;
  hddCount: number;
  storageTotalTb: number;
} {
  if (totalCameras <= 0) {
    return { rows: [], sum: 0, hddCount: 0, storageTotalTb: 0 };
  }
  const hddCount = ceilDiv(totalCameras, HDD_CAMERAS_PER_DISK);
  const sum = hddCount * HDD_PRICE_KZT;
  const storageTotalTb = hddCount * HDD_CAPACITY_TB;
  const rows: LineItem[] = [
    {
      name: `Жёсткий диск ${HDD_CAPACITY_TB} ТБ (видеонаблюдение) — SEAGATE HDD SkyHawkAI`,
      qty: hddCount,
      unitPrice: HDD_PRICE_KZT,
      sum,
      note: `${totalCameras} камер → ${hddCount} дисков (каждые ${HDD_CAMERAS_PER_DISK} камер = 1 диск ${HDD_CAPACITY_TB} ТБ)`,
    },
  ];
  return { rows, sum, hddCount, storageTotalTb };
}

// ─────────────────────── 6. Серверная часть (фиксированная) ──────────────

function calculateServerRoom(): { rows: LineItem[]; sum: number } {
  return {
    rows: SERVER_ROOM_ITEMS.map((r) => ({ ...r })),
    sum: SERVER_ROOM_TOTAL,
  };
}

// ══════════════════════════ ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА ═══════════════════════

export function calculateResult(params: BuildingParams): CalculatorResult | null {
  // Проверка: хоть что-то задано
  if (params.entrances <= 0 && params.elevators <= 0 && !params.hasParking) {
    return null;
  }

  const warnings: string[] = [];
  const groups: ResultGroup[] = [];

  // ── 1. Камеры ──────────────────────────────────────────────────────────
  const cameraResult = calculateCameras(params);
  const { totalCameras, liftCameras } = cameraResult;

  if (cameraResult.rows.length > 0) {
    groups.push({
      title: 'Камеры видеонаблюдения',
      rows: cameraResult.rows,
      subtotal: cameraResult.sum,
    });
  }

  if (totalCameras === 0) {
    warnings.push('Не выбрано ни одной камеры — проверьте параметры.');
    return null;
  }

  // ── 2. Видеорегистраторы ───────────────────────────────────────────────
  const nvrResult = calculateNVR(totalCameras);
  if (nvrResult.rows.length > 0) {
    groups.push({
      title: 'Видеорегистраторы (NVR)',
      rows: nvrResult.rows,
      subtotal: nvrResult.sum,
    });
  }

  // ── 2a. Хранение данных (HDD: каждые 25 камер = 1 диск 10 ТБ) ───────────
  const storageResult = calculateStorage(totalCameras);
  if (storageResult.rows.length > 0) {
    groups.push({
      title: 'Хранение данных',
      rows: storageResult.rows,
      subtotal: storageResult.sum,
    });
  }

  if (totalCameras > 160) {
    warnings.push(
      `Более 160 камер (${totalCameras}) — рекомендуется выезд инженера для уточнения топологии.`,
    );
  }

  // ── 3. POE-коммутаторы ─────────────────────────────────────────────────
  // Лифтовые камеры в расчёт коммутаторов не входят (они на радиомостах)
  const camerasForSwitch = totalCameras - liftCameras;
  const switchResult = calculateSwitches(camerasForSwitch);
  if (switchResult.rows.length > 0) {
    groups.push({
      title: 'POE-коммутаторы',
      rows: switchResult.rows,
      subtotal: switchResult.sum,
    });
  }

  // ── 4. Кабель UTP + расходные материалы ───────────────────────────────
  const cableResult = calculateCable(totalCameras, liftCameras);
  if (cableResult.rows.length > 0) {
    groups.push({
      title: 'Кабельная продукция и расходные материалы',
      rows: cableResult.rows,
      subtotal: cableResult.sum,
    });
  }

  if (cableResult.reels > 20) {
    warnings.push('Большой объём кабельных работ — рекомендуется выезд замерщика для уточнения трасс.');
  }

  // ── 5. Серверная часть (фиксированная, нередактируемая) ───────────────
  const serverResult = calculateServerRoom();
  groups.push({
    title: 'Серверная часть (фиксированная)',
    rows: serverResult.rows,
    subtotal: serverResult.sum,
  });

  // ── 6. Монтажные работы ────────────────────────────────────────────────
  const installResult = calculateInstallation(totalCameras, cableResult.totalMeters);

  // ── Итоговые суммы ─────────────────────────────────────────────────────
  const equipmentSum = groups.reduce((a, g) => a + g.subtotal, 0);
  // Расходные материалы уже входят в группу кабеля, выделяем отдельно для итога
  const consumables = cableResult.consumables;
  const equipment = equipmentSum - consumables;

  const grandTotal = equipmentSum + installResult.total;

  return {
    groups,
    warnings,
    totalCameras,
    liftCameras,
    totalCableMeters: cableResult.totalMeters,
    utpReels: cableResult.reels,
    equipment,
    consumables,
    hddCount: storageResult.hddCount,
    storageTotalTb: storageResult.storageTotalTb,
    installation: {
      cameraInstall: installResult.cameraInstall,
      cableInstall: installResult.cableInstall,
      total: installResult.total,
      breakdown: installResult.breakdown,
    },
    grandTotal,
    totalFlats: 0,
    monthlyIntercomPerFlat: 700,
    monthlyCctvPerFlat: 900,
    monthlyIntercomTotal: 0,
    monthlyCctvTotal: 0,
    monthlyTotal: 0,
    paybackMonths: 0,
  };
}

// ══════════════════════ ПРИМЕР ИСПОЛЬЗОВАНИЯ (можно удалить) ══════════════

/*
const result = calculateResult({
  entrances: 4,
  floors: 9,
  elevators: 4,
  yardGates: 2,
  parkingCameras: 10,
  hasParking: true,
  parkingGates: 2,
  coverageType: 'whole_building',
  hasCamerasInLifts: true,
});

if (result) {
  console.log('Итого камер:', result.totalCameras);
  console.log('Кабель (м):', result.totalCableMeters, '→', result.utpReels, 'бухт');
  console.log('Оборудование:', result.equipment.toLocaleString('ru-RU'), '₸');
  console.log('Расходники:', result.consumables.toLocaleString('ru-RU'), '₸');
  console.log('Монтаж:', result.installation.total.toLocaleString('ru-RU'), '₸');
  console.log('ИТОГО:', result.grandTotal.toLocaleString('ru-RU'), '₸');
}
*/
