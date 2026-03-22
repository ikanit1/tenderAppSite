/**
 * Схема и валидация входов калькулятора (BuildingParams).
 * Защита при восстановлении из sessionStorage при изменении схемы.
 */

import type { BuildingParams, CoverageType } from '@/widgets/calculator/calculatorLogic';

export const defaultParams: BuildingParams = {
  entrances: 1,
  floors: 1,
  elevators: 0,
  yardGates: 0,
  hasParking: false,
  parkingGates: 0,
  coverageType: 'entrance_only',
  twoCamerasPerFloor: false,
  hasCamerasInLifts: false,
};

const COVERAGE_TYPES: CoverageType[] = ['entrance_only', 'whole_building'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(x: unknown, fallback: number): number {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  return fallback;
}

function bool(x: unknown, fallback: boolean): boolean {
  if (typeof x === 'boolean') return x;
  return fallback;
}

function oneOf<T>(x: unknown, options: readonly T[], fallback: T): T {
  if (options.includes(x as T)) return x as T;
  return fallback;
}

/**
 * Валидирует данные из sessionStorage. При несоответствии схемы подставляет defaultParams.
 */
export function validateParams(parsed: unknown): BuildingParams {
  if (!isObject(parsed)) return defaultParams;
  return {
    entrances: Math.max(0, num(parsed.entrances, defaultParams.entrances)),
    floors: Math.max(0, num(parsed.floors, defaultParams.floors)),
    elevators: Math.max(0, num(parsed.elevators, defaultParams.elevators)),
    yardGates: Math.max(0, num(parsed.yardGates, defaultParams.yardGates)),
    hasParking: bool(parsed.hasParking, defaultParams.hasParking),
    parkingGates: Math.max(0, num(parsed.parkingGates, defaultParams.parkingGates)),
    coverageType: oneOf(parsed.coverageType, COVERAGE_TYPES, defaultParams.coverageType),
    twoCamerasPerFloor: bool(parsed.twoCamerasPerFloor, defaultParams.twoCamerasPerFloor),
    hasCamerasInLifts: bool(parsed.hasCamerasInLifts, defaultParams.hasCamerasInLifts),
  };
}
