import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step1Object.module.css';

export function Step1Object() {
  const reduceMotion = useReducedMotion();
  const inputs = useCalculatorStore((s) => s.inputs);
  const setObjectParams = useCalculatorStore((s) => s.setObjectParams);
  const setStep = useCalculatorStore((s) => s.setStep);

  const { entrances, floorsPerEntrance, flatsPerFloor } = inputs.intercom;
  const totalFlats = (entrances || 1) * (floorsPerEntrance || 1) * (flatsPerFloor || 4);

  const handleEntrances = (delta: number) => {
    setObjectParams({ entrances: Math.max(1, Math.min(50, (entrances || 1) + delta)) });
  };

  const handleEntrancesByValue = (v: number) => {
    setObjectParams({ entrances: Math.max(1, Math.min(50, v)) });
  };

  const handleFloors = (v: number) => {
    setObjectParams({ floors: Math.max(1, Math.min(50, v)) });
  };

  const handleFlatsPerFloor = (v: number) => {
    setObjectParams({ flatsPerFloor: Math.max(1, Math.min(50, v)) });
  };

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, x: 20 }}
    >
      <GlassCard className={styles.card}>
        <h2 className={styles.title}>Параметры объекта</h2>
        <p className={styles.subtitle}>Укажите количество квартир, подъездов, этажей и квартир на этаже</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Число квартир</label>
          <div className={styles.totalFlatsDisplay} aria-live="polite">
            {totalFlats}
          </div>
          <p className={styles.hint}>Рассчитывается: подъезды × этажи × квартир на этаже</p>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Число подъездов</label>
          <div className={styles.stepperRow}>
            <GlowButton variant="secondary" onClick={() => handleEntrances(-1)} aria-label="Уменьшить">−</GlowButton>
            <input
              type="number"
              min={1}
              max={50}
              value={entrances || 1}
              onChange={(e) => handleEntrancesByValue(Number(e.target.value) || 1)}
              className={styles.numberInput}
              aria-label="Число подъездов"
            />
            <GlowButton variant="secondary" onClick={() => handleEntrances(1)} aria-label="Увеличить">+</GlowButton>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Число этажей</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={floorsPerEntrance || 1}
              onChange={(e) => handleFloors(Number(e.target.value))}
              className={styles.slider}
            />
            <input
              type="number"
              min={1}
              max={50}
              value={floorsPerEntrance || 1}
              onChange={(e) => handleFloors(Number(e.target.value) || 1)}
              className={styles.numberInput}
              aria-label="Число этажей"
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Квартир на этаже</label>
          <div className={styles.stepperRow}>
            <GlowButton variant="secondary" onClick={() => handleFlatsPerFloor((flatsPerFloor || 4) - 1)} aria-label="Уменьшить">−</GlowButton>
            <input
              type="number"
              min={1}
              max={50}
              value={flatsPerFloor || 4}
              onChange={(e) => handleFlatsPerFloor(Number(e.target.value) || 4)}
              className={styles.numberInput}
              aria-label="Квартир на этаже"
            />
            <GlowButton variant="secondary" onClick={() => handleFlatsPerFloor((flatsPerFloor || 4) + 1)} aria-label="Увеличить">+</GlowButton>
          </div>
        </div>

        <div className={styles.actions}>
          <GlowButton onClick={() => setStep(2)}>Далее: Камеры</GlowButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
