import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './GlassCard.module.css';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
  id?: string;
}

export function GlassCard({ children, className, hover = true, style, id }: GlassCardProps) {
  return (
    <motion.div
      id={id}
      style={style}
      className={clsx(styles.card, hover && styles.hover, className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
