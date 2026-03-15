/**
 * Вспомогательные расчёты и форматирование для калькулятора смет.
 */
import type { CalculatorInputs } from '@/widgets/calculator/calculatorLogic';

const KZT_FORMAT = new Intl.NumberFormat('ru-KZ', {
  style: 'currency',
  currency: 'KZT',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatKzt(value: number): string {
  return KZT_FORMAT.format(value);
}

/** Количество устройств домофонии для предупреждения >250 */
export function intercomDevicesCount(input: CalculatorInputs): number {
  const { entrances, floorsPerEntrance, flatsPerFloor, extraCardReaders, carEntrance, hasConcierge } = input.intercom;
  const totalFlats = entrances * floorsPerEntrance * flatsPerFloor;
  const readersFromFlats = totalFlats + entrances * floorsPerEntrance + (hasConcierge ? 2 : 0);
  const entranceCount = carEntrance.enabled ? carEntrance.entranceCount ?? 0 : 0;
  const readers = readersFromFlats + (extraCardReaders ?? 0) + entranceCount;
  const controllers = Math.ceil(readers / 4);
  const carPanels = carEntrance.enabled ? 1 + carEntrance.gates + carEntrance.parking : 0;
  const panels = entrances + carPanels + entranceCount;
  const totalFloors = entrances * floorsPerEntrance;
  return panels + readers + controllers + totalFloors;
}

export type ObjectType = 'residential' | 'office' | 'parking';
