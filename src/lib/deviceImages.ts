/**
 * Маппинг наименований из сметы на артикулы каталога и локальные изображения.
 * Используется в ResultTable и при генерации КП.
 */
import { getCatalogUrl } from '@/shared/utils/catalogUrl';

/** Подстрока row.name → артикул модели (API каталога). Изображения из portal_export через /api/products/{model}/image */
export const deviceModelMap: Record<string, string> = {
  // Позиции калькулятора видеонаблюдения (название — модель в row.name)
  'IPC-3612-APF28': 'IPC-3612-APF28E',
  'IPC-2122-APF28': 'IPC-2122-APF28',
  'PKC2630@Z28-IR-P': 'PKC2630@Z28-IR-P',
  'IPC-324-PF28': 'IPC-324-PF28',
  'WK-WB08-KIT': 'WK-WB08-KIT',
  'NVR501-16B': 'NVR501-16B',
  'NVR-302-32-IQ': 'NVR-302-32-IQ',
  'NVR-508-48-E': 'NVR-508-64-E',
  'NVR-508-64-E': 'NVR-508-64-E',
  'NVR508-128E-R': 'NVR508-128E-R',
  'NSW2100-9GT1GP-POE-IN': 'NSW2100-9GT1GP-POE-IN',
  'WK-PS320GF': 'WK-PS320GF',
  'WK-PS328GF': 'WK-PS328GF',
  'WI-PCMS554F-L3 V2': 'WI-PCMS554F-L3 V2',
  'SEAGATE HDD SkyHawkAI': 'ST10000VE000',
  'Жёсткий диск 10 ТБ': 'ST10000VE000',
  'Патч-панель 19"': 'PP24-1UC5EU-D05-1',
  'Кабель UTP Cat5e': 'CAB-LC2110B-IN',
  'Уличная цилиндрическая 2MP': 'IPC-2122-APF28',
  'Уличная цилиндрическая': 'IPC-2122-APF28',
  'Внутренняя купольная 2MP': 'IPC-3612-APF28-DL',
  'Внутренняя купольная 4MP': 'IPC-3614-APF28-NB',
  'Камера опознавания номерного знака 3MP': 'DHI-ITC413-PW4D-Z1',
  'опознавания номерного знака': 'DHI-ITC413-PW4D-Z1',
  'Камера опознавания номерного знака': 'DHI-ITC413-PW4D-Z1',
  'Лифтовая камера 2MP': 'IPC-3612-APF28-DL',
  'Лифтовая камера 4MP': 'IPC-324-PF28',
  'Лифтовая камера': 'IPC-3612-APF28-DL',
  'WK-WB08': 'WK-WB08-KIT',
  'WK-PS227GF': 'WK-PS227GF',
  'WK-PS216GF': 'WK-PS216GF',
  'WK-PS208GF': 'WK-PS208GF',
  'PoE-коммутатор 4-порт': 'WK-PS208GF',
  'PoE-коммутатор 8-порт': 'WK-PS208GF',
  'PoE-коммутатор': 'WK-PS227GF',
  'CAB-LC2100B-E2-IN': 'CAB-LC2100B-E2-IN',
  'CAB-LC2110B': 'CAB-LC2110B-IN',
  'CAB-LC': 'CAB-LC2100B-E2-IN',
  'SkyHawk': 'ST8000VX010',
  'SEAGATE SkyHawk': 'ST8000VX010',
  'NVR824-256R': 'NVR308-64X',
  'NVR308-64E': 'NVR308-64X',
  'NVR304-32E': 'NVR304-32B-IQ',
  'NVR302-16E': 'NVR302-16B-IQ',
  'NVR824': 'NVR308-64X',
  'NVR308': 'NVR308-64X',
  'NVR304': 'NVR304-32B-IQ',
  'NVR302': 'NVR302-16B-IQ',
  'Коммутатор управляемый 24п': 'NS-1010-8GT',
  'Вызывная панель (вход)': 'OEU-201S-HMK-W',
  'Домофон для входа': 'OEU-201S-HMK-W',
  'Вызывная панель': 'C313S',
  'Вызывная панель IP': 'OEU-201S-HMK-W',
  'Интерком панели для квартир': 'C313S',
  'Контроллер доступа': 'GVAE11',
  'Шкаф 18U': 'LWR3-18U66-GF',
  'Шкаф 42U': 'LWR3-18U66-GF',
  'SHIP 700402112T': 'SHIP 700402112T',
  'SHIP 701402120': 'CO05-1M5RM',
  'SHIP 700508102': 'SHIP 700508102',
  'Патч-корд': 'PC01-C5EU-02M',
  'Патч-панель 24 порта': 'PP24-1UMU',
  'Патч-панель 48 портов': 'PP24-1UMU',
  'ИБП 3 кВА': 'ИБП 3 кВА',
  'ИБП 2 кВА': 'ИБП 2 кВА',
  'ИБП 1 кВА': 'ИБП 1 кВА',
};

/** Локальные изображения (приоритет над каталогом). Файлы из docs/ — в public/docs/ для доступа по /docs/... */
export const deviceLocalImageMap: Record<string, string> = {
  'Домофон для входа': '/oeu-301s-hmka.jpg',
  'Вызывная панель (вход)': '/oeu-301s-hmka.jpg',
  'Вызывная панель IP': '/oeu-301s-hmka.jpg',
  'Стойка настенная 9U': '/docs/stoika.jpg',
  'Монтажный шкаф напольный 19" 27U': '/docs/shkaf-27u.jpg',
  'SHIP 601S.6027.24.100': '/docs/shkaf-27u.jpg',
  'ИБП онлайн 3000 ВА': '/docs/ibp-3kva.jpg',
  'LRT-3KL-LCD': '/docs/ibp-3kva.jpg',
  'Вентиляторная панель с термостатом': '/docs/vent.jpg',
  'SHIP 700402112T': '/docs/vent.jpg',
  'SHIP 700402112Т': '/docs/vent.jpg',
  'SHIP 700508102': '/docs/setevoifilt.jpg',
};

export function getDeviceImage(rowName: string): string | null {
  for (const [key, localPath] of Object.entries(deviceLocalImageMap)) {
    if (rowName.includes(key)) return localPath;
  }
  const base = getCatalogUrl();
  for (const [key, model] of Object.entries(deviceModelMap)) {
    if (rowName.includes(key)) {
      return `${base.replace(/\/$/, '')}/api/products/${encodeURIComponent(model)}/image?index=0`;
    }
  }
  return null;
}
