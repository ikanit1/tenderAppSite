import { motion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { intercomDevicesCount } from '@/lib/calculations';
import styles from './Step3Intercom.module.css';

const WARN = 250;

export function Step3Intercom() {
  const inputs = useCalculatorStore((s) => s.inputs);
  const setIntercom = useCalculatorStore((s) => s.setIntercom);
  const setStep = useCalculatorStore((s) => s.setStep);
  const devices = intercomDevicesCount(inputs);
  const showWarn = devices > WARN;
  return (
    <motion.div className={styles.wrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className={styles.title}>Домофония</h2>
      <GlassCard className={styles.card}>
        <p className={styles.hint}>Параметры из шага «Параметры объекта».</p>
        <div className={styles.row}>
          <label>Доп. считыватели</label>
          <input type="number" min={0} value={inputs.intercom.extraCardReaders} onChange={(e) => setIntercom({ extraCardReaders: Number(e.target.value) || 0 })} className={styles.input} />
        </div>
        <div className={styles.row}>
          <label>Въездная группа</label>
          <input type="checkbox" checked={inputs.intercom.carEntrance.enabled} onChange={(e) => setIntercom({ carEntrance: { ...inputs.intercom.carEntrance, enabled: e.target.checked } })} />
        </div>
        {inputs.intercom.carEntrance.enabled && (
          <>
            <div className={styles.row}>
              <label>Количество калиток</label>
              <div className={styles.stepper}>
                <GlowButton variant="secondary" onClick={() => setIntercom({ carEntrance: { ...inputs.intercom.carEntrance, gates: Math.max(0, inputs.intercom.carEntrance.gates - 1) } })}>−</GlowButton>
                <span className={styles.mono}>{inputs.intercom.carEntrance.gates}</span>
                <GlowButton variant="secondary" onClick={() => setIntercom({ carEntrance: { ...inputs.intercom.carEntrance, gates: inputs.intercom.carEntrance.gates + 1 } })}>+</GlowButton>
              </div>
            </div>
            <div className={styles.row}>
              <label>Въездов на паркинг</label>
              <div className={styles.stepper}>
                <GlowButton variant="secondary" onClick={() => setIntercom({ carEntrance: { ...inputs.intercom.carEntrance, parking: Math.max(0, inputs.intercom.carEntrance.parking - 1) } })}>−</GlowButton>
                <span className={styles.mono}>{inputs.intercom.carEntrance.parking}</span>
                <GlowButton variant="secondary" onClick={() => setIntercom({ carEntrance: { ...inputs.intercom.carEntrance, parking: inputs.intercom.carEntrance.parking + 1 } })}>+</GlowButton>
              </div>
            </div>
          </>
        )}
        {showWarn && <div className={styles.alert}>Устройств: {devices} — рекомендуется L3/VLAN.</div>}
        <div className={styles.devices}>Устройств: <strong>{devices}</strong></div>
      </GlassCard>
      <div className={styles.actions}>
        <GlowButton variant="secondary" onClick={() => setStep(2)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(4)}>Далее</GlowButton>
      </div>
    </motion.div>
  );
}
