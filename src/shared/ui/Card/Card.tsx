import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Card({ children, title, className = '' }: CardProps) {
  return (
    <article className={`${styles.card} ${className}`.trim()}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </article>
  );
}
