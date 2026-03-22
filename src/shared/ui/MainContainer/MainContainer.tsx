import type { ReactNode } from 'react';
import styles from './MainContainer.module.css';

interface MainContainerProps {
  children: ReactNode;
}

export function MainContainer({ children }: MainContainerProps) {
  return <div className={styles.main}>{children}</div>;
}
