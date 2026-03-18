/**
 * Глобальный стейт калькулятора смет (Zustand).
 * Синхронизирован с BuildingParams и результатом calculateResult (calculatorLogic).
 */
import { create } from 'zustand';
import type { BuildingParams, CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import { calculateResult } from '@/widgets/calculator/calculatorLogic';

export const STEPS = [
  { id: 1, label: 'Параметры объекта', short: 'Объект' },
  { id: 2, label: 'Итог', short: 'Итог' },
] as const;

const defaultParams: BuildingParams = {
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

export interface CalculatorState {
  step: number;
  params: BuildingParams;
  result: CalculatorResult | null;
  /** Для 3D: число этажей здания */
  buildingFloors: number;
}

export const useCalculatorStore = create<CalculatorState & {
  setStep: (s: number) => void;
  setParams: (patch: Partial<BuildingParams>) => void;
  reset: () => void;
}>((set, get) => {
  return {
    step: 1,
    params: defaultParams,
    result: null,
    buildingFloors: defaultParams.floors,

    setStep: (step) => set({ step }),

    setParams: (patch) => {
      const { params } = get();
      const next = { ...params, ...patch };
      set({
        params: next,
        buildingFloors: next.floors,
      });
      const result = calculateResult(next);
      set({ result: result ?? null });
    },

    reset: () => set({
      step: 1,
      params: defaultParams,
      result: null,
      buildingFloors: defaultParams.floors,
    }),
  };
});
