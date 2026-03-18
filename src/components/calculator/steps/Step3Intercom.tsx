import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step3Intercom.module.css';

/** Шаг отключён: расчёт только по BuildingParams. Оставлен для совместимости. */
export function Step3Intercom() {
  const reduceMotion = useReducedMotion();
  const setStep = useCalculatorStore((s) => s.setStep);

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
    >
      <h2 className={styles.title}>Домофония</h2>
      <GlassCard className={styles.card}>
        <p className={styles.hint}>Параметры домофонии задаются в шаге «Расчет видеонаблюдения ЖК».</p>
      </GlassCard>
      <div className={styles.row}>
        <GlowButton variant="secondary" onClick={() => setStep(2)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(4)}>Далее</GlowButton>
      </div>
    </motion.div>
  );
}
