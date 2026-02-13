export interface AkuvoxProduct {
  model: string;
  descriptionRu: string;
  priceUsd: number;
  priceKzt: number;
  category: string;
  /** URL пути к изображению (например /akuvox/PS51-R2-EU.png) */
  image?: string;
}

export interface AkuvoxCategory {
  id: string;
  title: string;
  products: AkuvoxProduct[];
}

export interface AkuvoxSmartSystemsData {
  title: string;
  subtitle: string;
  usdToKzt: number;
  categories: AkuvoxCategory[];
}

import data from './akuvoxSmartSystems.json';

export const akuvoxSmartSystems = data as AkuvoxSmartSystemsData;

/** Понятные названия категорий для отображения (Умные панели, Умные розетки и т.д.) */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'сенсорные-панели-ps51': 'Умные панели',
  'сенсорные-панели-ps52': 'Умные панели',
  'панели-с-клавиатурой-ks53': 'Умные панели с клавиатурой',
  'центральные-панели-ks41': 'Центральные умные панели',
  'компактные-панели-rt61': 'Компактные умные панели',
  'аксессуары': 'Аксессуары',
  'умные-панели': 'Умные панели',
};
