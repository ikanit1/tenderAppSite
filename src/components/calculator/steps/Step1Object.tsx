import { motion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import type { ObjectType } from '@/lib/calculations';
import styles from './Step1Object.module.css';

const OBJECT_TYPES: { id: ObjectType; label: string }[] = [
  { id: 'residential', label: 'ЖК' },
  { id: 'office', label: 'Офис' },
  { id: 'parking', label: 'Паркинг' },
];

export function Step1Object() {
  const inputs = useCalculatorStore((s) => s.inputs);
  const objectType = useCalculatorStore((s) => s.objectType);
  const setObjectParams = useCalculatorStore((s) => s.setObjectParams);
  const setObjectType = useCalculatorStore((s) => s.setObjectType);
  const setStep = useCalculatorStore((s) => s.setStep);

  const { entrances, floorsPerEntrance, flatsPerFloor } = inputs.intercom;
  const totalFlats = entrances * floorsPerEntrance * flatsPerFloor || 0;

  const handleFlats = (v: number) => {
    const n = Math.max(0, Math.min(2000, v));
    setObjectParams({
      totalFlats: n,
      entrances: entrances || 1,
      floors: floorsPerEntrance || 1,
    });
  };

  const handleEntrances = (delta: number) => {
    const n = Math.max(1, Math.min(50, entrances + delta));
    setObjectParams({
      entrances: n,
      floors: floorsPerEntrance,
      totalFlats: totalFlats || n * (floorsPerEntrance || 1) * 4,
    });
  };

  const handleFloors = (v: number) => {
    const n = Math.max(1, Math.min(50, v));
    setObjectParams({
      entrances,
      floors: n,
      totalFlats: totalFlats || entrances * n * 4,
    });
  };

  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
    >
      <GlassCard className={styles.card}>
        <h2 className={styles.title}>Параметры объекта</h2>
        <p className={styles.subtitle}>Укажите количество квартир, подъездов и этажей</p>

        <div className={styles.field}>
          <label className={styles.label}>Число квартир</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={0}
              max={500}
              step={1}
              value={totalFlats}
              onChange={(e) => handleFlats(Number(e.target.value))}
              className={styles.slider}
            />
            <input
              type="number"
              min={0}
              max={2000}
              value={totalFlats}
              onChange={(e) => handleFlats(Number(e.target.value) || 0)}
              className={styles.numberInput}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Число подъездов</label>
          <div className={styles.stepperRow}>
            <GlowButton variant="secondary" onClick={() => handleEntrances(-1)} aria-label="Уменьшить">−</GlowButton>
            <span className={styles.mono}>{entrances || 1}</span>
            <GlowButton variant="secondary" onClick={() => handleEntrances(1)} aria-label="Увеличить">+</GlowButton>
          </div>
        </div>

        <div className={styles.field}>
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
            <span className={styles.mono}>{floorsPerEntrance || 1}</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Тип объекта</label>
          <div className={styles.toggle} role="tablist">
            {OBJECT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={objectType === t.id}
                className={styles.toggleBtn}
                onClick={() => setObjectType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <GlowButton onClick={() => setStep(2)}>Далее: Камеры</GlowButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
