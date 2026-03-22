/**
 * Глобальный стейт калькулятора смет (Zustand).
 * Синхронизирован с BuildingParams и результатом calculateResult (calculatorLogic).
 */
import { create } from 'zustand';
import type { BuildingParams, CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import { calculateResult } from '@/widgets/calculator/calculatorLogic';

// ─── Домофония ─────────────────────────────────────────────────────────────

export interface IntercomParams {
  entrances: number;
  entranceInputs: number;
  floors: number;
  flats: number;
  gates: number; // количество калиток (0 = нет калиток)
}

// Цены на оборудование домофонии
const PRICE_SWITCH_4PORT    = 13_301;   // Wi-Tek WK-PS305 V2 (из каталога: 133008700 ÷ 10000), ₸
const PRICE_PANEL_EQUIP     = 255_000;  // Вызывная панель (оборудование), ₸
const PRICE_PANEL_INSTALL   = 200_000;  // Монтаж одной панели, ₸
const PRICE_MANAGED_SWITCH  = 51_333;   // DH-SG4010-2F (из каталога: 5133337333 ÷ 100000), ₸
const PRICE_UTP_PER_METER   = 170;      // Кабель UTP за метр, ₸

// Монтажные работы
const PRICE_INSTALL_UTP_PER_METER = 120;  // Прокладка UTP за метр, ₸
const PRICE_INSTALL_PANEL         = 80_000; // Монтаж вызывной панели, ₸
const PRICE_INSTALL_SWITCH        = 4_000;  // Монтаж коммутатора (любого), ₸

// Пусконаладочные работы
const PRICE_COMM_FLAT             = 7_000;  // ПНР за квартиру, ₸
const PRICE_COMM_PANEL            = 50_000; // ПНР за вызывную панель, ₸

// Расходные материалы
const CONSUMABLES_UTP_RATIO       = 0.30;   // 30% от стоимости UTP кабеля

export interface IntercomResult {
  // количества
  switches4port: number;
  callPanels: number;
  managedSwitches: number;
  utpMeters: number;
  // оборудование
  costSwitches4port: number;
  costPanelEquip: number;
  costManagedSwitches: number;
  costUtp: number;
  costConsumables: number; // расходные материалы = 30% от UTP
  // монтажные работы
  installUtp: number;      // UTP × 120
  installPanels: number;   // панели × 80 000
  installSwitches: number; // (4port + managed) × 4 000
  totalInstall: number;
  // пусконаладочные работы
  flatsCount: number;      // кол-во квартир
  commFlats: number;       // квартиры × 10 000
  commPanels: number;      // панели × 50 000
  totalComm: number;
  // итоги
  totalPanelCost: number;  // панели (оборуд. + старый монтаж 200к) — для обратной совместимости
  grandTotal: number;      // оборудование + монтаж + ПНР
}

export const defaultIntercomParams: IntercomParams = {
  entrances: 1,
  entranceInputs: 1,
  floors: 5,
  flats: 20,
  gates: 0,
};

function calcIntercom(p: IntercomParams): IntercomResult {
  const switches4port    = p.entrances * p.floors;
  const callPanels       = p.entrances * p.entranceInputs + p.gates;
  const managedSwitches  = p.entrances;
  const utpMeters        = callPanels * 100 + p.entrances * 100 + p.flats * 40 + p.gates * 100;

  // Оборудование
  const costSwitches4port   = switches4port   * PRICE_SWITCH_4PORT;
  const costPanelEquip      = callPanels      * PRICE_PANEL_EQUIP;
  const costManagedSwitches = managedSwitches * PRICE_MANAGED_SWITCH;
  const costUtp             = utpMeters       * PRICE_UTP_PER_METER;
  const costConsumables     = Math.round(costUtp * CONSUMABLES_UTP_RATIO);

  // Монтажные работы
  const installUtp      = utpMeters    * PRICE_INSTALL_UTP_PER_METER;
  const installPanels   = callPanels   * PRICE_INSTALL_PANEL;
  const installSwitches = (switches4port + managedSwitches) * PRICE_INSTALL_SWITCH;
  const totalInstall    = installUtp + installPanels + installSwitches;

  // Пусконаладочные работы
  const flatsCount = p.flats;
  const commFlats  = p.flats    * PRICE_COMM_FLAT;
  const commPanels = callPanels * PRICE_COMM_PANEL;
  const totalComm  = commFlats + commPanels;

  const totalPanelCost = costPanelEquip + callPanels * PRICE_PANEL_INSTALL; // обратная совместимость
  const grandTotal     = costSwitches4port + costPanelEquip + costManagedSwitches + costUtp
                       + costConsumables + totalInstall + totalComm;

  return {
    switches4port, callPanels, managedSwitches, utpMeters,
    costSwitches4port, costPanelEquip, costManagedSwitches, costUtp, costConsumables,
    installUtp, installPanels, installSwitches, totalInstall,
    flatsCount, commFlats, commPanels, totalComm,
    totalPanelCost, grandTotal,
  };
}

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
  /** Домофония */
  intercomParams: IntercomParams;
  intercomResult: IntercomResult;
  /** true только после первого взаимодействия пользователя с формой домофонии */
  intercomDirty: boolean;
}

export const useCalculatorStore = create<CalculatorState & {
  setStep: (s: number) => void;
  setParams: (patch: Partial<BuildingParams>) => void;
  setIntercomParams: (patch: Partial<IntercomParams>) => void;
  reset: () => void;
}>((set, get) => {
  return {
    step: 1,
    params: defaultParams,
    // На первом открытии не показываем итог до первого изменения параметров пользователем.
    result: null,
    buildingFloors: defaultParams.floors,
    intercomParams: defaultIntercomParams,
    intercomResult: calcIntercom(defaultIntercomParams),
    intercomDirty: false,

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

    setIntercomParams: (patch) => {
      const { intercomParams } = get();
      const next = { ...intercomParams, ...patch };
      set({ intercomParams: next, intercomResult: calcIntercom(next), intercomDirty: true });
    },

    reset: () => set({
      step: 1,
      params: defaultParams,
      result: null,
      buildingFloors: defaultParams.floors,
      intercomParams: defaultIntercomParams,
      intercomResult: calcIntercom(defaultIntercomParams),
      intercomDirty: false,
    }),
  };
});
