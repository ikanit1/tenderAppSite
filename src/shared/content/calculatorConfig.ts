/**
 * Конфигурация калькулятора видеонаблюдения и домофонии.
 * Прайс-лист и константы по спецификации G&R Group.
 */

/** Типы камер: уличные 2MP, внутренние 2MP/4MP, АНПР */
export const cameraTypes = {
  outdoor2mp: { label: 'Уличная цилиндрическая 2MP IPC-2122', priceKzt: 14_400 },
  indoor2mp: { label: 'Внутренняя купольная 2MP', priceKzt: 15_500 },
  indoor4mp: { label: 'Внутренняя купольная 4MP', priceKzt: 21_000 },
  anpr3mp: { label: 'АНПР 3MP', priceKzt: 274_300 },
} as const;

/** Битрейт Мбит/с: постоянная запись / по движению. АНПР всегда постоянная. */
export const cameraBitrateMbps = {
  outdoor2mp: { continuous: 4, motion: 1.5 },
  indoor2mp: { continuous: 4, motion: 1.5 },
  indoor4mp: { continuous: 8, motion: 3 },
  anpr3mp: { continuous: 6, motion: 6 },
} as const;

/** Лифтовые камеры: отдельный SKU (антивандальный корпус), битрейт — постоянная запись */
export const elevatorCameras = {
  '2mp': { label: 'Лифтовая камера 2MP (антивандальная)', priceKzt: 18_500 },
  '4mp': { label: 'Лифтовая камера 4MP (антивандальная)', priceKzt: 26_000 },
} as const;

/** Лифтовые камеры: битрейт всегда постоянная запись */
export const liftBitrateMbps = { lift2mp: 4, lift4mp: 8 } as const;

/** Длина кабеля на камеру (м): outdoor2mp/anpr — 120, indoor — 60, лифт — 30 */
export const cableMetersPerCamera = { outdoor2mp: 120, indoor2mp: 60, indoor4mp: 60, anpr3mp: 120, lift: 30 } as const;

/** Потребление (Вт): уличные 15, внутренние 10, лифт 12 */
export const powerWattsPerCamera = { outdoor2mp: 15, indoor2mp: 10, indoor4mp: 10, anpr3mp: 15, lift: 12 } as const;

/** Радиомост (комплект для лифта) */
export const radioBridgeConfig = {
  name: 'WK-WB08-KIT',
  priceKzt: 24_750,
};

/** Кабель UTP */
export const cableConfig = {
  indoor: { name: 'CAB-LC2100B-E2-IN (305м)', priceKzt: 51_000, meters: 305 },
  outdoor: { name: 'CAB-LC2110B-IN (305м)', priceKzt: 51_700, meters: 305 },
};

export const REEL_LENGTH_METERS = 305;
export const CABLE_RESERVE_FACTOR = 1.1;
export const FLOOR_HEIGHT_METERS = 4;
export const INTERCOM_CABLE_METERS_PER_FLOOR = 15;
/** Метров кабеля на одну панель въездной группы (до серверной) */
export const INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL = 50;

/** Патч-корды (камера × 1, NVR × 4 uplink) */
export const patchCordConfig = {
  label: 'Патч-корд 3м UTP Cat5e',
  priceKzt: 1_500,
} as const;

/** HDD для хранения */
export const hddConfig = {
  name: 'SEAGATE SkyHawk AI 10TB',
  priceKzt: 220_000,
  capacityTb: 10,
  capacityGb: 10_000,
};

export const STORAGE_RESERVE_FACTOR = 1.2;
export const NVR_MAX_HDD_SLOTS = 8;
export const JBOD_SLOTS = 24;

/** Расширитель хранения при нехватке слотов в NVR */
export const jbodConfig = {
  label: 'Расширитель хранения JBOD',
  priceKzt: 380_000,
  powerW: 60,
  slots: 24,
} as const;

/** NVR по каналам */
export const nvrConfigs = [
  { key: 'nvr_256ch', name: 'NVR824-256R', priceKzt: 4_834_500, channels: 256 },
  { key: 'nvr_64ch', name: 'NVR308-64E', priceKzt: 850_000, channels: 64 },
  { key: 'nvr_32ch', name: 'NVR304-32E', priceKzt: 420_000, channels: 32 },
  { key: 'nvr_16ch', name: 'NVR302-16E', priceKzt: 195_000, channels: 16 },
] as const;

/** Коммутаторы PoE */
export const switchConfigs = {
  poe_24port: { name: 'WK-PS227GF (24 порта PoE)', priceKzt: 69_500, ports: 24, effectivePorts: 22 },
  poe_16port: { name: 'WK-PS216GF (16 портов PoE)', priceKzt: 52_000, ports: 16 },
  poe_8port: { name: 'WK-PS208GF (8 портов PoE)', priceKzt: 35_000, ports: 8, effectivePorts: 6 },
} as const;

/** Аплинк-коммутатор (агрегация, без PoE) */
export const uplinkSwitchConfig = {
  name: 'Коммутатор управляемый 24п (аплинк)',
  priceKzt: 45_000,
};

/** Серверные шкафы */
export const rackConfigs = {
  rack_42u: { name: 'Шкаф 42U', priceKzt: 380_000, units: 42 },
  rack_27u: { name: 'SHIP 601S.6027.24.100 (27U)', priceKzt: 283_773, units: 27 },
  rack_18u: { name: 'Шкаф 18U', priceKzt: 165_000, units: 18 },
} as const;

/** ИБП: 1000 ВА (600 Вт), 2000 ВА (1200 Вт), 3000 ВА (1800 Вт) */
export const upsConfigs = {
  ups_1kva: { name: 'ИБП 1 кВА (600 Вт)', priceKzt: 85_000, va: 1000, watts: 600 },
  ups_2kva: { name: 'ИБП 2 кВА (1200 Вт)', priceKzt: 165_000, va: 2000, watts: 1200 },
  ups_3kva: { name: 'ИБП 3 кВА (1800 Вт)', priceKzt: 247_990, va: 3000, watts: 1800 },
} as const;

/** Потребление серверного оборудования (Вт) */
export const powerWattsServer = { nvr: 200, switch: 30, controller: 20 } as const;

/** Аксессуары для шкафа */
export const accessoriesConfig = {
  fanPanel: { name: 'SHIP 700402112T (вентиляторы)', priceKzt: 30_397 },
  cableOrganizer: { name: 'SHIP 701402120 (органайзер)', priceKzt: 3_279 },
  pdu: { name: 'SHIP 700508102 (PDU 8 розеток)', priceKzt: 12_324 },
  patchPanel_24: { name: 'Патч-панель 24 порта', priceKzt: 8_500 },
  patchPanel_48: { name: 'Патч-панель 48 портов', priceKzt: 14_200 },
};

/** Монитор */
export const monitorConfig = {
  name: 'MW3255-F-V2 (55" 4K)',
  priceKzt: 363_700,
};

/** Домофония */
export const intercomConfig = {
  panel: { name: 'Вызывная панель IP', priceKzt: 85_000 },
  reader: { name: 'Считыватель карт', priceKzt: 25_000 },
  controller: { name: 'Контроллер доступа (до 4 считывателей)', priceKzt: 35_000 },
};

export const INTERCOM_READERS_PER_CONTROLLER = 4;

/** Коммутаторы домофонии (1 порт под uplink, остальные — устройства) */
export const intercomSwitches = [
  { ports: 4, usable: 3, name: 'WK-PS204GF (4 порта PoE)', priceKzt: 22_000 },
  { ports: 8, usable: 7, name: 'WK-PS208GF (8 портов PoE)', priceKzt: 35_000 },
  { ports: 16, usable: 15, name: 'WK-PS216GF (16 портов PoE)', priceKzt: 52_000 },
  { ports: 32, usable: 31, name: 'WK-PS232GF (32 порта PoE)', priceKzt: 75_000 },
  { ports: 64, usable: 63, name: 'WK-PS264GF (64 порта PoE)', priceKzt: 130_000 },
] as const;

/** Расходные материалы: 15% от стоимости кабеля */
/** Расходные материалы: доля от стоимости кабеля (гофра, крепёж, клеммы, патч-корды) */
export const consumablesCablePercent = 0.25;

/** Ставки монтажа по статьям (₸) */
export const installationRates = {
  cameraOutdoor: 2_500,
  cameraIndoor: 1_500,
  cameraLift: 3_500,
  cablePerMeter: 150,
  nvr: 5_000,
  switch: 2_000,
  panel: 4_000,
  reader: 800,
} as const;

/** Срок хранения архива (месяцы) */
export const storageMonthsOptions = [1, 2, 3] as const;

/** Контакт для заявок */
export const calculatorContact = {
  email: 'info@grgroup.kz',
  phone: '+7 771 421 55 93',
};
