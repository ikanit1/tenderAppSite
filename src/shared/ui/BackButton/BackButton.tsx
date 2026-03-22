import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './BackButton.module.css';

export function BackButton() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.wrapper}>
      <motion.button
        type="button"
        className={styles.button}
        onClick={() => navigate(-1)}
        aria-label="Назад"
        whileHover={reduceMotion ? undefined : { x: -4, scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <span className={styles.icon}>←</span>
        Назад
      </motion.button>
    </div>
  );
}
