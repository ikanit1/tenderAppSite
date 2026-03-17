/**
 * Схема и валидация входов калькулятора.
 * Защита при восстановлении из sessionStorage при изменении схемы.
 */

import type {
  CalculatorInputs,
  CameraCounts,
  CableSettings,
  IntercomSettings,
  CarEntranceSettings,
  ArchiveSettings,
  ObjectType,
  StorageDays,
} from '@/widgets/calculator/calculatorLogic';

const defaultCameraCounts: CameraCounts = {
  outdoor2mp: 0,
  indoor2mp: 0,
  indoor4mp: 0,
  anpr3mp: 0,
};

const defaultCableSettings: CableSettings = {
  useManualLength: false,
  manualLengthPerCamera: undefined,
  buildingFloors: 0,
  buildingRisers: 1,
};

const defaultCarEntrance: CarEntranceSettings = {
  enabled: false,
  gates: 0,
  parking: 0,
  entranceCount: 0,
};

const defaultIntercom: IntercomSettings = {
  entrances: 0,
  floorsPerEntrance: 0,
  flatsPerFloor: 4,
  extraCardReaders: 0,
  carEntrance: defaultCarEntrance,
  hasConcierge: false,
};

const defaultArchiveSettings: ArchiveSettings = {
  months: 1,
  recordingType: 'continuous',
};

/** Значения по умолчанию для всех полей калькулятора */
export const defaultInputs: CalculatorInputs = {
  objectType: 'ЖК',
  objectNameOrAddress: '',
  cameraTypes: defaultCameraCounts,
  elevatorCount: 0,
  elevatorCameraType: '2mp',
  archiveSettings: defaultArchiveSettings,
  storageDays: 30,
  hasPatchPanel: false,
  hasSecurityPost: false,
  cableSettings: defaultCableSettings,
  intercom: defaultIntercom,
  videoAnalytics: false,
};

const OBJECT_TYPES: ObjectType[] = ['ЖК', 'Офис', 'Паркинг', ''];
const STORAGE_DAYS: StorageDays[] = [30, 60, 90];
const ELEVATOR_TYPES = ['2mp', '4mp'] as const;
const MONTHS = [1, 2, 3] as const;
const RECORDING_TYPES = ['continuous', 'motion'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(x: unknown, fallback: number): number {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  return fallback;
}

function numOrUndef(x: unknown): number | undefined {
  if (x === undefined || x === null) return undefined;
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  return undefined;
}

function str(x: unknown, fallback: string): string {
  if (typeof x === 'string') return x;
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

function validateCameraCounts(parsed: unknown): CameraCounts {
  if (!isObject(parsed)) return defaultCameraCounts;
  return {
    outdoor2mp: num(parsed.outdoor2mp, defaultCameraCounts.outdoor2mp),
    indoor2mp: num(parsed.indoor2mp, defaultCameraCounts.indoor2mp),
    indoor4mp: num(parsed.indoor4mp, defaultCameraCounts.indoor4mp),
    anpr3mp: num(parsed.anpr3mp, defaultCameraCounts.anpr3mp),
  };
}

function validateCableSettings(parsed: unknown): CableSettings {
  if (!isObject(parsed)) return defaultCableSettings;
  return {
    useManualLength: bool(parsed.useManualLength, defaultCableSettings.useManualLength),
    manualLengthPerCamera: numOrUndef(parsed.manualLengthPerCamera),
    buildingFloors: num(parsed.buildingFloors, defaultCableSettings.buildingFloors),
    buildingRisers: num(parsed.buildingRisers, defaultCableSettings.buildingRisers),
  };
}

function validateCarEntrance(parsed: unknown): CarEntranceSettings {
  if (!isObject(parsed)) return defaultCarEntrance;
  return {
    enabled: bool(parsed.enabled, defaultCarEntrance.enabled),
    gates: num(parsed.gates, defaultCarEntrance.gates),
    parking: num(parsed.parking, defaultCarEntrance.parking),
    entranceCount: num(parsed.entranceCount, defaultCarEntrance.entranceCount),
  };
}

function validateIntercom(parsed: unknown): IntercomSettings {
  if (!isObject(parsed)) return defaultIntercom;
  return {
    entrances: num(parsed.entrances, defaultIntercom.entrances),
    floorsPerEntrance: num(parsed.floorsPerEntrance, defaultIntercom.floorsPerEntrance),
    flatsPerFloor: num(parsed.flatsPerFloor, defaultIntercom.flatsPerFloor),
    extraCardReaders: num(parsed.extraCardReaders, defaultIntercom.extraCardReaders),
    carEntrance: validateCarEntrance(parsed.carEntrance),
    hasConcierge: bool(parsed.hasConcierge, defaultIntercom.hasConcierge),
  };
}

function validateArchiveSettings(parsed: unknown): ArchiveSettings {
  if (!isObject(parsed)) return defaultArchiveSettings;
  return {
    months: oneOf(parsed.months, MONTHS, defaultArchiveSettings.months),
    recordingType: oneOf(parsed.recordingType, RECORDING_TYPES, defaultArchiveSettings.recordingType),
  };
}

/**
 * Валидирует данные из sessionStorage. При несоответствии схемы подставляет defaultInputs.
 */
export function validateInputs(parsed: unknown): CalculatorInputs {
  if (!isObject(parsed)) return defaultInputs;
  return {
    objectType: oneOf(parsed.objectType, OBJECT_TYPES, defaultInputs.objectType ?? 'ЖК'),
    objectNameOrAddress: str(parsed.objectNameOrAddress, defaultInputs.objectNameOrAddress ?? ''),
    cameraTypes: validateCameraCounts(parsed.cameraTypes),
    elevatorCount: num(parsed.elevatorCount, defaultInputs.elevatorCount),
    elevatorCameraType: oneOf(parsed.elevatorCameraType, ELEVATOR_TYPES, defaultInputs.elevatorCameraType),
    archiveSettings: validateArchiveSettings(parsed.archiveSettings),
    storageDays: oneOf(parsed.storageDays, STORAGE_DAYS, defaultInputs.storageDays ?? 30),
    hasPatchPanel: bool(parsed.hasPatchPanel, defaultInputs.hasPatchPanel ?? false),
    hasSecurityPost: bool(parsed.hasSecurityPost, defaultInputs.hasSecurityPost ?? false),
    cableSettings: validateCableSettings(parsed.cableSettings),
    intercom: validateIntercom(parsed.intercom),
    videoAnalytics: bool(parsed.videoAnalytics, defaultInputs.videoAnalytics),
  };
}
