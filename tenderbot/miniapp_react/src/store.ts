import { create } from 'zustand';
import type { User } from './types';

export type Screen =
  | 'home'
  | 'tenders'
  | 'tender'
  | 'applications'
  | 'application'
  | 'support'
  | 'support_chat'
  | 'profile'
  | 'profile_edit'
  | 'my_tenders'
  | 'create_tender'
  | 'tender_applicants';

export interface NavParams {
  tenderId?: number;
  applicationId?: number;
  ticketId?: number;
}

interface AppState {
  user: User | null;
  screen: Screen;
  stack: Array<{ screen: Screen; params: NavParams }>;
  params: NavParams;

  setUser: (user: User) => void;
  navigate: (screen: Screen, params?: NavParams) => void;
  back: () => void;
  reset: (screen: Screen) => void;
  canGoBack: () => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  screen: 'home',
  stack: [],
  params: {},

  setUser: (user) => set({ user }),

  navigate: (screen, params = {}) => {
    const { screen: cur, params: curParams, stack } = get();
    set({ stack: [...stack, { screen: cur, params: curParams }], screen, params });
  },

  back: () => {
    const { stack } = get();
    if (!stack.length) {
      set({ screen: 'home', params: {} });
      return;
    }
    const prev = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1), screen: prev.screen, params: prev.params });
  },

  reset: (screen) => set({ screen, stack: [], params: {} }),

  canGoBack: () => get().stack.length > 0,
}));

// Tab screens that show the tabbar as the active tab
export const TAB_SCREENS: Screen[] = ['home', 'tenders', 'applications', 'support', 'profile', 'my_tenders', 'create_tender'];
