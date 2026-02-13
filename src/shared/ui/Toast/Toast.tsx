import type { ReactNode } from 'react';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  type?: ToastType;
  children: ReactNode;
  onClose: () => void;
}

export function Toast({ type = 'success', children, onClose }: ToastProps) {
  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <span className={styles.text}>{children}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
