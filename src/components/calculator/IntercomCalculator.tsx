import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import styles from './IntercomCalculator.module.css';

function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.stepperRow}>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Уменьшить"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className={styles.numberInput}
      />
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Увеличить"
      >
        +
      </button>
    </div>
  );
}

export function IntercomCalculator() {
  const params = useCalculatorStore((s) => s.intercomParams);
  const setParams = useCalculatorStore((s) => s.setIntercomParams);

  return (
    <GlassCard className={styles.card}>
      <h2 className={styles.title}>Расчёт домофонии ЖК</h2>
      <p className={styles.subtitle}>
        Вызывные панели, коммутаторы, кабельная инфраструктура
      </p>

      <div className={styles.layout}>
        {/* ─── Inputs ─── */}
        <div className={styles.inputsCol}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Количество подъездов</label>
            <Stepper value={params.entrances} min={1} max={50} onChange={(v) => setParams({ entrances: v })} />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Входов у одного подъезда</label>
            <Stepper value={params.entranceInputs} min={1} max={10} onChange={(v) => setParams({ entranceInputs: v })} />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Этажей в доме</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={1}
                max={50}
                value={params.floors}
                onChange={(e) => setParams({ floors: Number(e.target.value) })}
                className={styles.slider}
              />
              <input
                type="number"
                min={1}
                max={50}
                value={params.floors}
                onChange={(e) => setParams({ floors: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className={styles.numberInput}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Квартир в доме</label>
            <Stepper value={params.flats} min={1} max={9999} onChange={(v) => setParams({ flats: v })} />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Количество калиток</label>
            <Stepper value={params.gates} min={0} max={99} onChange={(v) => setParams({ gates: v })} />
          </div>
        </div>

      </div>
    </GlassCard>
  );
}

