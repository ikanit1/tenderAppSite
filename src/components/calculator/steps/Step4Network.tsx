import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step4Network.module.css';

/** Шаг отключён: расчёт только по BuildingParams. Оставлен для совместимости. */
export function Step4Network() {
  const reduceMotion = useReducedMotion();
  const result = useCalculatorStore((s) => s.result);
  const setStep = useCalculatorStore((s) => s.setStep);

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0 }}
    >
      <h2 className={styles.title}>Сеть и питание</h2>
      <GlassCard className={styles.col}>
        <div className={styles.row}><span>Камер</span><span className={styles.mono}>{result?.totalCameras ?? 0}</span></div>
        {result?.totalCableMeters != null && result.totalCableMeters > 0 && (
          <div className={styles.row}><span>Кабель, м</span><span className={styles.mono}>{result.totalCableMeters}</span></div>
        )}
      </GlassCard>
      <div className={styles.row}>
        <GlowButton variant="secondary" onClick={() => setStep(3)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(5)}>К итогу</GlowButton>
      </div>
    </motion.div>
  );
}
