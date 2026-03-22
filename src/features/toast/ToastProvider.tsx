import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import { Toast } from '@/shared/ui/Toast/Toast';
import styles from './ToastProvider.module.css';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

interface ToastContextValue {
  show: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((text: string, type: ToastType = 'success') => {
    const currentId = ++id;
    setToasts((prev) => [...prev, { id: currentId, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== currentId));
    }, 4000);
  }, []);

  const remove = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.container} role="region" aria-label="Уведомления">
        {toasts.map((t) => (
          <Toast key={t.id} type={t.type} onClose={() => remove(t.id)}>
            {t.text}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
