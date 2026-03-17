import { motion, useReducedMotion } from 'framer-motion';
import { cameraTypes } from '@/shared/content/calculatorConfig';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { formatKzt } from '@/lib/calculations';
import styles from './Step2Cameras.module.css';

const KEYS = ['outdoor2mp', 'indoor2mp', 'indoor4mp', 'anpr3mp'] as const;
const LABELS: Record<string, string> = { outdoor2mp: 'Уличная 2MP', indoor2mp: 'Внутр. 2MP', indoor4mp: 'Внутр. 4MP', anpr3mp: 'Камера опознавания номерного знака' };

const STORAGE_OPTIONS: { days: 30 | 60 | 90; label: string }[] = [
  { days: 30, label: '1 месяц' },
  { days: 60, label: '2 месяца' },
  { days: 90, label: '3 месяца' },
];

export function Step2Cameras() {
  const reduceMotion = useReducedMotion();
  const inputs = useCalculatorStore((s) => s.inputs);
  const setCameraCount = useCalculatorStore((s) => s.setCameraCount);
  const setInputs = useCalculatorStore((s) => s.setInputs);
  const setElevator = useCalculatorStore((s) => s.setElevator);
  const setStep = useCalculatorStore((s) => s.setStep);
  const setVideoAnalytics = useCalculatorStore((s) => s.setVideoAnalytics);
  const setStorageDays = useCalculatorStore((s) => s.setStorageDays);
  const liftCount = inputs.elevatorCount ?? 0;
  const storageDays = inputs.storageDays ?? 30;
  const videoAnalytics = inputs.videoAnalytics ?? false;

  const handleCameraValue = (key: (typeof KEYS)[number], value: number) => {
    const n = Math.max(0, Math.min(999, value));
    setInputs({
      ...inputs,
      cameraTypes: { ...inputs.cameraTypes, [key]: n },
    });
  };

  const handleLiftValue = (value: number) => {
    const n = Math.max(0, Math.min(99, value));
    setElevator(n);
  };

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
    >
      <h2 className={styles.title}>Камеры</h2>
      <div className={styles.grid}>
        {KEYS.map((key) => {
          const qty = inputs.cameraTypes[key];
          const cfg = cameraTypes[key];
          return (
            <GlassCard key={key} className={styles.card}>
              <div className={styles.cardTitle}>{LABELS[key]}</div>
              <div className={styles.controls}>
                <GlowButton variant="secondary" onClick={() => setCameraCount(key, -1)}>−</GlowButton>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={qty}
                  onChange={(e) => handleCameraValue(key, Number(e.target.value) || 0)}
                  className={styles.numberInput}
                  aria-label={LABELS[key]}
                />
                <GlowButton variant="secondary" onClick={() => setCameraCount(key, 1)}>+</GlowButton>
              </div>
              <div className={styles.sum}>{formatKzt(qty * cfg.priceKzt)}</div>
            </GlassCard>
          );
        })}
      </div>
      <GlassCard className={styles.liftBlock}>
        <div className={styles.liftTitle}>Лифтовое оборудование</div>
        <span className={styles.hint}>0 = нет лифтов</span>
        <div className={styles.row}>
          <label>Количество лифтов</label>
          <div className={styles.stepper}>
            <GlowButton variant="secondary" onClick={() => setElevator(Math.max(0, liftCount - 1))}>−</GlowButton>
            <input
              type="number"
              min={0}
              max={99}
              value={liftCount}
              onChange={(e) => handleLiftValue(Number(e.target.value) || 0)}
              className={styles.numberInput}
              aria-label="Количество лифтов"
            />
            <GlowButton variant="secondary" onClick={() => setElevator(liftCount + 1)}>+</GlowButton>
          </div>
        </div>
        {liftCount > 0 && (
          <div className={styles.row}>
            <label>Тип камеры</label>
            <div className={styles.toggle}>
              <button type="button" className={inputs.elevatorCameraType === '2mp' ? styles.toggleActive : ''} onClick={() => setElevator(liftCount, '2mp')}>2MP</button>
              <button type="button" className={inputs.elevatorCameraType === '4mp' ? styles.toggleActive : ''} onClick={() => setElevator(liftCount, '4mp')}>4MP</button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className={styles.liftBlock}>
        <div className={styles.liftTitle}>Срок хранения архива</div>
        <div className={styles.row}>
          <label>Хранение</label>
          <div className={styles.toggle}>
            {STORAGE_OPTIONS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                className={storageDays === days ? styles.toggleActive : ''}
                onClick={() => setStorageDays(days)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className={styles.liftBlock}>
        <div className={styles.liftTitle}>Видеоаналитика</div>
        <div className={styles.row}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={videoAnalytics}
              onChange={(e) => setVideoAnalytics(e.target.checked)}
            />
            <span>Видеоаналитика {videoAnalytics ? 'ВКЛ' : 'ВЫКЛ'}</span>
          </label>
        </div>
        {videoAnalytics && (
          <span className={styles.hint}>Подключает NVR824-256R на 256 каналов (+4 834 500 ₸)</span>
        )}
      </GlassCard>

      <div className={styles.actions}>
        <GlowButton variant="secondary" onClick={() => setStep(1)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(3)}>Далее</GlowButton>
      </div>
    </motion.div>
  );
}
