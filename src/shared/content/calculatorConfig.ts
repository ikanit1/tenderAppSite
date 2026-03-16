/**
 * Конфигурация калькулятора видеонаблюдения и домофонии.
 * Прайс-лист и константы по спецификации G&R Group.
 */

/** Типы камер: уличные 2MP, внутренние 2MP/4MP, опознавание номерного знака */
export const cameraTypes = {
  outdoor2mp: { label: 'Уличная цилиндрическая 2MP IPC-2122', priceKzt: 14_400 },
  indoor2mp: { label: 'Внутренняя купольная 2MP', priceKzt: 14_400 },
  indoor4mp: { label: 'Внутренняя купольная 4MP', priceKzt: 21_000 },
  anpr3mp: { label: 'Камера опознавания номерного знака 3MP', priceKzt: 274_300 },
} as const;

/** Битрейт Мбит/с: постоянная запись / по движению. Камера опознавания номерного знака всегда постоянная. */
export const cameraBitrateMbps = {
  outdoor2mp: { continuous: 4, motion: 1.5 },
  indoor2mp: { continuous: 4, motion: 1.5 },
  indoor4mp: { continuous: 8, motion: 3 },
  anpr3mp: { continuous: 6, motion: 6 },
} as const;

/** Лифтовые камеры (КП №14-26): IPC-324-PF28 купольная 4MP */
export const elevatorCameras = {
  '2mp': { label: 'Лифтовая камера 2MP', priceKzt: 14_400 },
  '4mp': { label: 'IPC-324-PF28 (лифт 4MP)', priceKzt: 19_900 },
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

/** Кабель UTP (КП №14-26): внутренний / уличный, бухта 305 м */
export const cableConfig = {
  indoor: { model: 'CAB-LC2100B-E2-IN', name: 'CAB-LC2100B-E2-IN 305м', priceKzt: 41_300, metersPerCoil: 305, meters: 305 },
  outdoor: { model: 'CAB-LC2110B-IN', name: 'CAB-LC2110B-IN 305м', priceKzt: 51_700, metersPerCoil: 305, meters: 305 },
} as const;

export const REEL_LENGTH_METERS = 305;
/** Резерв 15% на повороты и провисы (ТЗ п.8) */
export const CABLE_RESERVE_FACTOR = 1.15;
export const FLOOR_HEIGHT_METERS = 4;
export const INTERCOM_CABLE_METERS_PER_FLOOR = 15;
/** Метров кабеля на одну панель въездной группы (до серверной) */
export const INTERCOM_CABLE_CAR_ENTRANCE_PER_PANEL = 50;

/** Патч-корды и патч-панель (ТЗ: с панелью — камера×1 + NVR×4; без — только межоборудовательные) */
export const patchCordConfig = {
  label: 'Патч-корд 3м UTP Cat5e',
  model: 'Патч-корд 3м UTP Cat5e',
  priceKzt: 1_500,
} as const;

/** Патч-панель 24 порта — только при hasPatchPanel = true */
export const patchPanelConfig = {
  label: 'Патч-панель 24 порта',
  model: 'Патч-панель 24 порта',
  priceKzt: 8_500,
  ports: 24,
} as const;

/** HDD для хранения (Seagate SkyHawk AI 10TB) */
export const hddConfig = {
  name: 'SEAGATE SkyHawk AI 10TB',
  priceKzt: 220_000,
  capacityTb: 10,
  capacityGb: 10_000,
};

/** Средний битрейт на камеру для расчёта объёма архива (Мбит/с), по умолчанию 4 */
export const STORAGE_BITRATE_MBPS_DEFAULT = 4;

/** Максимум слотов HDD в одном NVR; при большем числе дисков добавляется JBOD */
export const NVR_MAX_HDD_SLOTS = 24;

export const STORAGE_RESERVE_FACTOR = 1.2;
export const JBOD_SLOTS = 24;

/** Расширитель хранения при нехватке слотов в NVR */
export const jbodConfig = {
  label: 'Расширитель хранения JBOD',
  priceKzt: 380_000,
  powerW: 60,
  slots: 24,
} as const;

/** NVR 256 каналов — ТОЛЬКО при включённой видеоаналитике (КП №14-26) */
export const nvr256 = { model: 'NVR824-256R', name: 'NVR824-256R', priceKzt: 4_834_500, channels: 256 } as const;

/** Подбор NVR без аналитики: по минимально достаточному числу каналов (1–16 → 16, 17–32 → 32, …) */
export const nvrTiers = [
  { model: 'NVR316-16E', channels: 16, priceKzt: 115_000 },
  { model: 'NVR308-32E', channels: 32, priceKzt: 115_000 },
  { model: 'NVR308-64E', channels: 64, priceKzt: 115_000 },
  { model: 'NVR364-128', channels: 128, priceKzt: 220_000 },
  { model: 'NVR324-256', channels: 256, priceKzt: 350_000 },
] as const;

/** Коммутаторы PoE: только WK-PS227GF 24 порта (КП №14-26) */
export const switchConfigs = {
  poe_24port: { name: 'WK-PS227GF', priceKzt: 69_500, ports: 24 },
} as const;

/** Серверный шкаф (КП №14-26): один на объект */
export const rackConfig = {
  model: 'SHIP 601S.6027.24.100',
  name: 'SHIP 601S.6027.24.100',
  priceKzt: 283_773,
  units: 27,
} as const;

/** ИБП онлайн 3 кВА (КП №14-26): 1 шт на объект */
export const upsConfig = {
  model: 'SVC LRT-3KL-LCD',
  name: 'SVC LRT-3KL-LCD',
  priceKzt: 247_990,
  kva: 3,
  qty: 1,
} as const;

/** Потребление серверного оборудования (Вт) */
export const powerWattsServer = { nvr: 200, switch: 30, controller: 20 } as const;

/** Аксессуары для шкафа (КП №14-26): 1 вентилятор, 2 органайзера, 1 PDU на шкаф */
export const accessoriesConfig = {
  fanPanel: { name: 'SHIP 700402112T', priceKzt: 30_397 },
  cableOrganizer: { name: 'SHIP 701402120', priceKzt: 3_279 },
  pdu: { name: 'SHIP 700508102', priceKzt: 12_324 },
} as const;

/** Монитор */
export const monitorConfig = {
  name: 'MW3255-F-V2 (55" 4K)',
  priceKzt: 363_700,
};

/** Домофония (вызывная панель IP 250 000 тг; интерком для квартир и контроллер доступа не в смете) */
export const intercomConfig = {
  panel: { name: 'Вызывная панель IP', priceKzt: 250_000 },
  reader: { name: 'Интерком панели для квартир', priceKzt: 25_000 },
  controller: { name: 'Контроллер доступа', priceKzt: 35_000 },
};

/** PoE-коммутатор на этаж: до 4 квартир — 4п, 5 и более — 8п */
export const floorPoeSwitchConfig = {
  small: { ports: 4, priceKzt: 22_000, label: 'PoE-коммутатор 4-порт этаж' },
  large: { ports: 8, priceKzt: 35_000, label: 'PoE-коммутатор 8-порт этаж' },
} as const;

/** Вход (калитка/паркинг): панель + считыватель */
export const entrancePanelConfig = {
  priceKzt: 250_000,
  label: 'Домофон для входа',
} as const;

/** Расходники домофонии: 25% от стоимости кабельной продукции (ТЗ п.2) */
export const consumablesIntercomPercent = 0.25;

export const INTERCOM_READERS_PER_CONTROLLER = 4;

/** Коммутаторы домофонии (8 и 16 портов — 90 000 тг) */
export const intercomSwitches = [
  { ports: 4, usable: 3, name: 'WK-PS204GF 4 порта PoE', priceKzt: 22_000 },
  { ports: 8, usable: 7, name: 'WK-PS208GF 8 портов PoE', priceKzt: 90_000 },
  { ports: 16, usable: 15, name: 'WK-PS216GF 16 портов PoE', priceKzt: 90_000 },
  { ports: 32, usable: 31, name: 'WK-PS232GF 32 порта PoE', priceKzt: 75_000 },
  { ports: 64, usable: 63, name: 'WK-PS264GF 64 порта PoE', priceKzt: 130_000 },
] as const;

/** Расходные материалы: 15% от стоимости кабеля */
/** Расходные материалы: доля от стоимости кабеля (гофра, крепёж, клеммы, патч-корды) */
export const consumablesCablePercent = 0.25;

/** Монтаж по ТЗ п.8: 30% от оборудования, пусконаладка 25% от монтажа, кабель 300 тг/м */
export const installationConfig = {
  installationRate: 0.3,
  commissioningRate: 0.25,
  cableInstallPerMeter: 300,
} as const;

/** Ставки монтажа по статьям (₸) — оставлены для совместимости, основной расчёт по installationConfig */
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

/** Срок хранения архива (месяцы) — для совместимости */
export const storageMonthsOptions = [1, 2, 3] as const;

/** Срок хранения архива в днях: 1 / 2 / 3 месяца (ТЗ п.2) */
export const storageDaysOptions = [30, 60, 90] as const;

/** Контакт для заявок */
export const calculatorContact = {
  email: 'info@grgroup.kz',
  phone: '+7 771 421 55 93',
};

/** Конфиг для PDF (ТЗ п.10): логотип, компания, контакты */
export const pdfConfig = {
  logoPath: '/logo.png',
  companyName: 'G&R Group',
  address: 'г. Алматы',
  phone: '+7 771 421 55 93',
  email: 'info@grgroup.kz',
} as const;

/** ——— Пересчёт сметы по результатам техаудита ——— */

/** Битрейт для расчёта объёма архива 30 дней (Мбит/с): 2MP=2, 4MP=4, опоз. номерного знака=6, лифт 2MP=2 */
export const storageBitrateMbpsFor30d = {
  outdoor2mp: 2,
  indoor2mp: 2,
  indoor4mp: 4,
  anpr3mp: 6,
  lift2mp: 2,
  lift4mp: 4,
} as const;

/** Запас на кабель при пересчёте бухт по метражу (15%) */
export const CABLE_RESERVE_RECALC = 1.15;

/** Порог устройств домофонии для добавления L3/VLAN */
export const INTERCOM_DEVICES_L3_THRESHOLD = 250;

/** L3-коммутатор и настройка VLAN (рыночные цены, Казахстан) */
export const auditRecalcConfig = {
  l3Switch24: { name: 'Коммутатор L3 управляемый 24п', priceKzt: 85_000 },
  vlanSetup: { name: 'Настройка VLAN и маршрутизации', priceKzt: 45_000 },
  /** Абонентские устройства */
  subscriberPanel: { name: 'Видеодомофон 7" в квартиру', priceKzt: 35_000 },
  conciergeMonitor: { name: 'Монитор 55" 4K на пост консьержа', priceKzt: 363_700 },
  /** Лицензии ПО (ориентир) */
  licenseNvrPerChannel: { name: 'Лицензия NVR доп. канал', priceKzt: 2_500 },
  licenseAnprPerCamera: { name: 'Лицензия ANPR на камеру', priceKzt: 15_000 },
  licenseSkud: { name: 'Лицензия СКУД (контроллеры доступа)', priceKzt: 8_000 },
} as const;

/** PoE-бюджет коммутаторов (Вт) — по даташитам */
export const switchPoEBudgetWatts = {
  poe_24port: 380,
  poe_16port: 250,
  poe_8port: 65,
  floor4port: 52,
  floor8port: 65,
} as const;
