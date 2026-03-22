import { motion, useReducedMotion } from 'framer-motion';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step2Cameras.module.css';

/** Шаг отключён: расчёт только по BuildingParams (шаг 1). Оставлен для совместимости. */
export function Step2Cameras() {
  const reduceMotion = useReducedMotion();
  const params = useCalculatorStore((s) => s.params);
  const setStep = useCalculatorStore((s) => s.setStep);

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
    >
      <h2 className={styles.title}>Камеры</h2>
      <GlassCard className={styles.card}>
        <p className={styles.hint}>
          Количество камер и оборудование рассчитываются автоматически по параметрам объекта (подъезды, этажи, лифты, охват).
        </p>
        <p>Объект: {params.entrances} подъезд(ов), {params.floors} этаж(ей), {params.elevators} лифт(ов).</p>
      </GlassCard>
      <div className={styles.actions}>
        <GlowButton variant="secondary" onClick={() => setStep(1)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(3)}>Далее</GlowButton>
      </div>
    </motion.div>
  );
}
