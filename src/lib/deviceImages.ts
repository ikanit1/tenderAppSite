/**
 * Маппинг наименований из сметы на артикулы каталога и локальные изображения.
 * Используется в ResultTable и при генерации КП.
 */
import { getCatalogUrl } from '@/shared/utils/catalogUrl';

/** Подстрока row.name → артикул модели (API каталога) */
export const deviceModelMap: Record<string, string> = {
  'Уличная цилиндрическая 2MP': 'IPC-2122-APF28',
  'Уличная цилиндрическая': 'IPC-2122-APF28',
  'Внутренняя купольная 2MP': 'IPC-3612-APF28-DL',
  'Внутренняя купольная 4MP': 'IPC-3614-APF28-NB',
  'АНПР': 'IPC-F842-IRDU',
  'Лифтовая камера 2MP': 'IPC-3612-APF28-DL',
  'Лифтовая камера 4MP': 'IPC-3614-APF28-NB',
  'Лифтовая камера': 'IPC-3612-APF28-DL',
  'WK-WB08-KIT': 'WK-WB08-KIT',
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
  'SHIP 701402120': 'SHIP 701402120',
  'SHIP 700508102': 'SHIP 700508102',
  'Патч-панель 24 порта': 'PP24-1UMU',
  'Патч-панель 48 портов': 'PP24-1UMU',
  'ИБП 3 кВА': 'ИБП 3 кВА',
  'ИБП 2 кВА': 'ИБП 2 кВА',
  'ИБП 1 кВА': 'ИБП 1 кВА',
};

/** Локальные изображения (приоритет над каталогом) */
export const deviceLocalImageMap: Record<string, string> = {
  'Домофон для входа': '/oeu-301s-hmka.jpg',
  'Вызывная панель (вход)': '/oeu-301s-hmka.jpg',
  'Вызывная панель IP': '/oeu-301s-hmka.jpg',
};

export function getDeviceImage(rowName: string): string | null {
  for (const [key, localPath] of Object.entries(deviceLocalImageMap)) {
    if (rowName.includes(key)) return localPath;
  }
  const base = getCatalogUrl();
  for (const [key, model] of Object.entries(deviceModelMap)) {
    if (rowName.includes(key)) {
      return `${base.replace(/\/$/, '')}/api/products/${encodeURIComponent(model)}/image`;
    }
  }
  return null;
}
