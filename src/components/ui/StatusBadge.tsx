import clsx from 'clsx';
import styles from './StatusBadge.module.css';

type Status = 'ok' | 'warning' | 'error';

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

const icons: Record<Status, string> = { ok: '✓', warning: '⚠', error: '✕' };

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[status], className)} title={label}>
      <span className={styles.icon}>{icons[status]}</span>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
