/**
 * Хук персистентного состояния калькулятора в sessionStorage.
 * Данные живут пока открыта вкладка. SSR-safe.
 */

import { useState, useCallback } from 'react';
import type { CalculatorInputs } from '@/widgets/calculator/calculatorLogic';
import { defaultInputs, validateInputs } from '@/widgets/calculator/calculatorSchema';

const STORAGE_KEY_INPUTS = 'calc-inputs';
const STORAGE_KEY_STEP = 'calc-step';
const DEFAULT_STEP = 1;

function readInputs(): CalculatorInputs {
  if (typeof window === 'undefined') return defaultInputs;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_INPUTS);
    if (!raw) return defaultInputs;
    const parsed: unknown = JSON.parse(raw);
    const validated = validateInputs(parsed);
    return { ...defaultInputs, ...validated };
  } catch {
    return defaultInputs;
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

function writeInputs(value: CalculatorInputs): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_INPUTS, JSON.stringify(value));
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
    sessionStorage.removeItem(STORAGE_KEY_INPUTS);
    sessionStorage.removeItem(STORAGE_KEY_STEP);
  } catch {
    /* ignore */
  }
}

export interface UsePersistedCalculatorReturn {
  inputs: CalculatorInputs;
  setInputs: (value: CalculatorInputs | ((prev: CalculatorInputs) => CalculatorInputs)) => void;
  step: number;
  setStep: (value: number | ((prev: number) => number)) => void;
  reset: () => void;
}

/**
 * Состояние калькулятора с сохранением в sessionStorage при уходе со страницы.
 */
export function usePersistedCalculator(): UsePersistedCalculatorReturn {
  const [inputs, setInputsState] = useState<CalculatorInputs>(readInputs);
  const [step, setStepState] = useState<number>(readStep);

  const setInputs = useCallback((value: CalculatorInputs | ((prev: CalculatorInputs) => CalculatorInputs)) => {
    setInputsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      writeInputs(next);
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
    setInputsState(defaultInputs);
    setStepState(DEFAULT_STEP);
  }, []);

  return { inputs, setInputs, step, setStep, reset };
}
