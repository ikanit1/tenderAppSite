import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './GlowButton.module.css';

interface GlowButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  'aria-label'?: string;
}

export function GlowButton({ variant = 'primary', children, className, type = 'button', disabled, onClick, 'aria-label': ariaLabel }: GlowButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      className={clsx(styles.btn, styles[variant], className)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </motion.button>
  );
}
