import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  welcome?: boolean;
}

export function Card({ children, onClick, className = '', welcome }: CardProps) {
  const cls = [styles.card, welcome ? styles.welcome : '', className].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <div className={cls + ' ' + styles.clickable} onClick={onClick} role="button" tabIndex={0}>
        {children}
      </div>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className={styles.title}>{children}</h3>;
}

export function CardMeta({ children }: { children: ReactNode }) {
  return <p className={styles.meta}>{children}</p>;
}

export function CardDesc({ children }: { children: ReactNode }) {
  return <p className={styles.desc}>{children}</p>;
}
