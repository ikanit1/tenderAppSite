import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}

// Application status badge
const APP_STATUS: Record<string, { label: string; variant: Variant }> = {
  applied:  { label: 'Ожидает',       variant: 'info' },
  selected: { label: 'Выбраны вы',    variant: 'success' },
  rejected: { label: 'Отклонён',      variant: 'danger' },
};

export function ApplicationStatusBadge({ status }: { status: string }) {
  const cfg = APP_STATUS[status] ?? { label: status, variant: 'neutral' as Variant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Ticket status badge
const TICKET_STATUS: Record<string, { label: string; variant: Variant }> = {
  new:         { label: 'Новый',    variant: 'accent' },
  in_progress: { label: 'В работе', variant: 'warning' },
  closed:      { label: 'Закрыт',   variant: 'neutral' },
};

export function TicketStatusBadge({ status }: { status: string }) {
  const cfg = TICKET_STATUS[status] ?? { label: status, variant: 'neutral' as Variant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Tender status badge
const TENDER_STATUS: Record<string, { label: string; variant: Variant }> = {
  open:        { label: 'Открыт',      variant: 'success' },
  in_progress: { label: 'В работе',    variant: 'warning' },
  closed:      { label: 'Закрыт',      variant: 'neutral' },
  cancelled:   { label: 'Отменён',     variant: 'danger' },
  draft:       { label: 'Черновик',    variant: 'info' },
};

export function TenderStatusBadge({ status, hasApplied }: { status: string; hasApplied?: boolean }) {
  if (hasApplied) return <Badge variant="accent">Откликнулись</Badge>;
  const cfg = TENDER_STATUS[status] ?? { label: status, variant: 'neutral' as Variant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
