import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step1Object.module.css';

export function Step1Object() {
  const reduceMotion = useReducedMotion();
  const params = useCalculatorStore((s) => s.params);
  const setParams = useCalculatorStore((s) => s.setParams);

  const scrollToResult = () => {
    document.getElementById('calculator-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <h2 className={styles.title}>Расчет видеонаблюдения ЖК</h2>
        <p className={styles.subtitle}>
          Подъезды, этажи, лифты, дворовые калитки, паркинг и охват видеонаблюдением
        </p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Подъездов</label>
          <div className={styles.stepperRow}>
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ entrances: Math.max(1, params.entrances - 1) })}
              aria-label="Уменьшить"
            >
              −
            </GlowButton>
            <input
              type="number"
              min={1}
              max={50}
              value={params.entrances}
              onChange={(e) => setParams({ entrances: Math.max(1, Number(e.target.value) || 1) })}
              className={styles.numberInput}
              aria-label="Подъездов"
            />
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ entrances: Math.min(50, params.entrances + 1) })}
              aria-label="Увеличить"
            >
              +
            </GlowButton>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Этажей</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={params.floors}
              onChange={(e) => setParams({ floors: Number(e.target.value) })}
              className={styles.slider}
            />
            <input
              type="number"
              min={1}
              max={50}
              value={params.floors}
              onChange={(e) => setParams({ floors: Math.max(1, Number(e.target.value) || 1) })}
              className={styles.numberInput}
              aria-label="Этажей"
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Лифтов</label>
          <div className={styles.stepperRow}>
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ elevators: Math.max(0, params.elevators - 1) })}
              aria-label="Уменьшить"
            >
              −
            </GlowButton>
            <input
              type="number"
              min={0}
              max={20}
              value={params.elevators}
              onChange={(e) => setParams({ elevators: Math.max(0, Number(e.target.value) || 0) })}
              className={styles.numberInput}
              aria-label="Лифтов"
            />
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ elevators: Math.min(20, params.elevators + 1) })}
              aria-label="Увеличить"
            >
              +
            </GlowButton>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Дворовые калитки</label>
          <div className={styles.stepperRow}>
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ yardGates: Math.max(0, params.yardGates - 1) })}
              aria-label="Уменьшить"
            >
              −
            </GlowButton>
            <input
              type="number"
              min={0}
              max={20}
              value={params.yardGates}
              onChange={(e) => setParams({ yardGates: Math.max(0, Number(e.target.value) || 0) })}
              className={styles.numberInput}
              aria-label="Калиток"
            />
            <GlowButton
              variant="secondary"
              onClick={() => setParams({ yardGates: Math.min(20, params.yardGates + 1) })}
              aria-label="Увеличить"
            >
              +
            </GlowButton>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.labelCheckbox}>
            <input
              type="checkbox"
              checked={params.hasParking}
              onChange={(e) => setParams({ hasParking: e.target.checked })}
            />
            <span>Есть паркинг (въезд/шлагбаум)</span>
          </label>
        </div>

        {params.hasParking && (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Въездов / шлагбаумов паркинга</label>
              <div className={styles.stepperRow}>
                <GlowButton
                  variant="secondary"
                  onClick={() => setParams({ parkingGates: Math.max(0, params.parkingGates - 1) })}
                  aria-label="Уменьшить"
                >
                  −
                </GlowButton>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={params.parkingGates}
                  onChange={(e) => setParams({ parkingGates: Math.max(0, Number(e.target.value) || 0) })}
                  className={styles.numberInput}
                  aria-label="Въездов паркинга"
                />
                <GlowButton
                  variant="secondary"
                  onClick={() => setParams({ parkingGates: Math.min(20, params.parkingGates + 1) })}
                  aria-label="Увеличить"
                >
                  +
                </GlowButton>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Камер в паркинге</label>
              <div className={styles.stepperRow}>
                <GlowButton
                  variant="secondary"
                  onClick={() => setParams({ parkingCameras: Math.max(0, params.parkingCameras - 1) })}
                  aria-label="Уменьшить"
                >
                  −
                </GlowButton>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={params.parkingCameras}
                  onChange={(e) => setParams({ parkingCameras: Math.max(0, Number(e.target.value) || 0) })}
                  className={styles.numberInput}
                  aria-label="Камер в паркинге"
                />
                <GlowButton
                  variant="secondary"
                  onClick={() => setParams({ parkingCameras: Math.min(100, params.parkingCameras + 1) })}
                  aria-label="Увеличить"
                >
                  +
                </GlowButton>
              </div>
            </div>
          </>
        )}

        <div className={styles.inputGroup}>
          <label className={styles.label}>Охват видеонаблюдением</label>
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={params.coverageType === 'entrance_only' ? styles.toggleActive : undefined}
              onClick={() => setParams({ coverageType: 'entrance_only' })}
            >
              Только входные группы
            </button>
            <button
              type="button"
              className={params.coverageType === 'whole_building' ? styles.toggleActive : undefined}
              onClick={() => setParams({ coverageType: 'whole_building' })}
            >
              Весь дом (входы + этажи)
            </button>
          </div>
        </div>

        {params.coverageType === 'whole_building' && (
          <div className={styles.inputGroup}>
            <label className={styles.labelCheckbox}>
              <input
                type="checkbox"
                checked={params.twoCamerasPerFloor}
                onChange={(e) => setParams({ twoCamerasPerFloor: e.target.checked })}
              />
              <span>2 камеры на этаж</span>
            </label>
          </div>
        )}

        <div className={styles.inputGroup}>
          <label className={styles.labelCheckbox}>
            <input
              type="checkbox"
              checked={params.hasCamerasInLifts}
              onChange={(e) => setParams({ hasCamerasInLifts: e.target.checked })}
            />
            <span>Камеры в лифтах</span>
          </label>
        </div>

        <div className={styles.actions}>
          <GlowButton onClick={scrollToResult}>Рассчитать смету</GlowButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
