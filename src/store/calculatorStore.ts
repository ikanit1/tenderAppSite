/**
 * Глобальный стейт калькулятора смет (Zustand).
 * Синхронизирован с CalculatorInputs и результатом calculateResult.
 */
import { create } from 'zustand';
import type { CalculatorInputs, CalculatorResult, CameraCounts } from '@/widgets/calculator/calculatorLogic';
import { calculateResult } from '@/widgets/calculator/calculatorLogic';
import type { ObjectType } from '@/lib/calculations';

// ObjectType: residential | office | parking

export const STEPS = [
  { id: 1, label: 'Параметры объекта', short: 'Объект' },
  { id: 2, label: 'Камеры', short: 'Камеры' },
  { id: 3, label: 'Домофония', short: 'Домофония' },
  { id: 4, label: 'Сеть и питание', short: 'Сеть' },
  { id: 5, label: 'Итог', short: 'Итог' },
] as const;

const defaultCameraCounts: CameraCounts = {
  outdoor2mp: 0,
  indoor2mp: 0,
  indoor4mp: 0,
  anpr3mp: 0,
};

const defaultInputs: CalculatorInputs = {
  cameraTypes: defaultCameraCounts,
  elevatorCount: 0,
  elevatorCameraType: '2mp',
  archiveSettings: { months: 1, recordingType: 'continuous' },
  storageDays: 30,
  hasPatchPanel: false,
  hasSecurityPost: false,
  cableSettings: {
    useManualLength: false,
    manualLengthPerCamera: undefined,
    buildingFloors: 0,
    buildingRisers: 1,
  },
  intercom: {
    entrances: 0,
    floorsPerEntrance: 0,
    flatsPerFloor: 4,
    extraCardReaders: 0,
    carEntrance: { enabled: false, gates: 0, parking: 0, entranceCount: 0 },
    hasConcierge: false,
  },
  videoAnalytics: false,
};

export interface CalculatorState {
  step: number;
  inputs: CalculatorInputs;
  result: CalculatorResult | null;
  /** Только для UI Step1 (ЖК / Офис / Паркинг) */
  objectType: ObjectType;
  /** Для совместимости (опции Step4 удалены по ТЗ) */
  subscriberCount: number;
  /** Для 3D: число этажей здания (визуал) */
  buildingFloors: number;
}

export const useCalculatorStore = create<CalculatorState & {
  setStep: (s: number) => void;
  setInputs: (inputs: CalculatorInputs) => void;
  setObjectParams: (p: { entrances?: number; floors?: number; flatsPerFloor?: number }) => void;
  setObjectType: (t: ObjectType) => void;
  setCameraCount: (key: keyof CameraCounts, delta: number) => void;
  setElevator: (count: number, type?: '2mp' | '4mp') => void;
  setIntercom: (patch: Partial<CalculatorInputs['intercom']>) => void;
  setArchive: (months: 1 | 2 | 3, recordingType?: 'continuous' | 'motion') => void;
  setVideoAnalytics: (v: boolean) => void;
  setStorageDays: (days: 30 | 60 | 90) => void;
  reset: () => void;
}>((set, get) => {
  function recompute() {
    const { inputs } = get();
    const result = calculateResult(inputs);
    set({ result: result ?? null });
    return result;
  }

  return {
    step: 1,
    inputs: defaultInputs,
    result: null,
    objectType: 'residential',
    subscriberCount: 0,
    buildingFloors: 0,

    setStep: (step) => set({ step }),

    setInputs: (inputs) => {
      set({ inputs });
      recompute();
    },

    setObjectParams: (p) => {
      const { inputs } = get();
      const prev = inputs.intercom;
      const entrances = p.entrances ?? prev.entrances;
      const floors = p.floors ?? prev.floorsPerEntrance;
      const flatsPerFloor =
        p.flatsPerFloor !== undefined && p.flatsPerFloor !== null
          ? Math.max(1, Math.min(50, p.flatsPerFloor))
          : prev.flatsPerFloor;
      set({
        inputs: {
          ...inputs,
          intercom: {
            ...prev,
            entrances,
            floorsPerEntrance: floors,
            flatsPerFloor,
          },
          cableSettings: {
            ...inputs.cableSettings,
            buildingFloors: floors,
            buildingRisers: entrances,
          },
        },
        buildingFloors: floors,
      });
      recompute();
    },

    setObjectType: (objectType) => set({ objectType }),

    setCameraCount: (key, delta) => {
      const { inputs } = get();
      const ct = { ...inputs.cameraTypes };
      ct[key] = Math.max(0, ct[key] + delta);
      set({ inputs: { ...inputs, cameraTypes: ct } });
      recompute();
    },

    setElevator: (elevatorCount, elevatorCameraType) => {
      const { inputs } = get();
      set({
        inputs: {
          ...inputs,
          elevatorCount,
          elevatorCameraType: elevatorCameraType ?? inputs.elevatorCameraType,
        },
      });
      recompute();
    },

    setIntercom: (patch) => {
      const { inputs } = get();
      set({
        inputs: {
          ...inputs,
          intercom: { ...inputs.intercom, ...patch },
        },
        buildingFloors: patch.floorsPerEntrance ?? inputs.intercom.floorsPerEntrance,
      });
      recompute();
    },

    setArchive: (months, recordingType) => {
      const { inputs } = get();
      set({
        inputs: {
          ...inputs,
          archiveSettings: {
            months,
            recordingType: recordingType ?? inputs.archiveSettings.recordingType,
          },
        },
      });
      recompute();
    },

    setVideoAnalytics: (videoAnalytics) => {
      set({ inputs: { ...get().inputs, videoAnalytics } });
      recompute();
    },

    setStorageDays: (storageDays) => {
      const { inputs } = get();
      const months = storageDays === 30 ? 1 : storageDays === 60 ? 2 : 3;
      set({
        inputs: {
          ...inputs,
          storageDays,
          archiveSettings: { ...inputs.archiveSettings, months },
        },
      });
      recompute();
    },

    reset: () => set({
      step: 1,
      inputs: defaultInputs,
      result: null,
      objectType: 'residential',
      subscriberCount: 0,
      buildingFloors: 0,
    }),
  };
});
