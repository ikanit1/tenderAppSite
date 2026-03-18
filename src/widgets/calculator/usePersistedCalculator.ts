/**
 * Хук персистентного состояния калькулятора в sessionStorage.
 * Данные живут пока открыта вкладка. SSR-safe.
 * Синхронизирован с BuildingParams (calculatorLogic).
 */

import { useState, useCallback } from 'react';
import type { BuildingParams } from '@/widgets/calculator/calculatorLogic';
import { defaultParams, validateParams } from '@/widgets/calculator/calculatorSchema';

const STORAGE_KEY_PARAMS = 'calc-params';
const STORAGE_KEY_STEP = 'calc-step';
const DEFAULT_STEP = 1;

function readParams(): BuildingParams {
  if (typeof window === 'undefined') return defaultParams;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PARAMS);
    if (!raw) return defaultParams;
    const parsed: unknown = JSON.parse(raw);
    return validateParams(parsed);
  } catch {
    return defaultParams;
  }
}

function readStep(): number {
  if (typeof window === 'undefined') return DEFAULT_STEP;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_STEP);
    if (raw === null) return DEFAULT_STEP;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : DEFAULT_STEP;
  } catch {
    return DEFAULT_STEP;
  }
}

function writeParams(value: BuildingParams): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function writeStep(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_STEP, String(value));
  } catch {
    /* ignore */
  }
}

function clearStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY_PARAMS);
    sessionStorage.removeItem(STORAGE_KEY_STEP);
  } catch {
    /* ignore */
  }
}

export interface UsePersistedCalculatorReturn {
  params: BuildingParams;
  setParams: (value: BuildingParams | ((prev: BuildingParams) => BuildingParams)) => void;
  step: number;
  setStep: (value: number | ((prev: number) => number)) => void;
  reset: () => void;
}

/**
 * Состояние калькулятора с сохранением в sessionStorage при уходе со страницы.
 */
export function usePersistedCalculator(): UsePersistedCalculatorReturn {
  const [params, setParamsState] = useState<BuildingParams>(readParams);
  const [step, setStepState] = useState<number>(readStep);

  const setParams = useCallback((value: BuildingParams | ((prev: BuildingParams) => BuildingParams)) => {
    setParamsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      writeParams(next);
      return next;
    });
  }, []);

  const setStep = useCallback((value: number | ((prev: number) => number)) => {
    setStepState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      writeStep(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearStorage();
    setParamsState(defaultParams);
    setStepState(DEFAULT_STEP);
  }, []);

  return { params, setParams, step, setStep, reset };
}
