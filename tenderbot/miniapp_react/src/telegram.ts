export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  showAlert: (msg: string, cb?: () => void) => void;
  showConfirm: (msg: string, cb: (ok: boolean) => void) => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    isVisible: boolean;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const TG: TelegramWebApp | null = window.Telegram?.WebApp ?? null;

export function getInitData(): string {
  if (TG?.initData) return TG.initData;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tgWebAppData') || '';
  } catch {
    return '';
  }
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  TG?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: 'success' | 'error' | 'warning') {
  TG?.HapticFeedback?.notificationOccurred(type);
}
