import type { ReactNode } from 'react';
import styles from './Accordion.module.css';

interface AccordionItemProps {
  id: string;
  title: string;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
}

export function AccordionItem({ id, title, children, open, onToggle }: AccordionItemProps) {
  return (
    <div className={styles.item}>
      <button
        type="button"
        className={styles.trigger}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`accordion-${id}`}
        id={`accordion-heading-${id}`}
      >
        {title}
        <span className={styles.icon} aria-hidden>{open ? '−' : '+'}</span>
      </button>
      <div
        id={`accordion-${id}`}
        role="region"
        aria-labelledby={`accordion-heading-${id}`}
        className={styles.panel}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}

interface AccordionProps {
  children: ReactNode;
  className?: string;
}

export function Accordion({ children, className = '' }: AccordionProps) {
  return <div className={`${styles.accordion} ${className}`.trim()}>{children}</div>;
}
