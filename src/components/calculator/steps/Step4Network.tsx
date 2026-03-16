import { motion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step4Network.module.css';

export function Step4Network() {
  const result = useCalculatorStore((s) => s.result);
  const setStep = useCalculatorStore((s) => s.setStep);

  return (
    <motion.div className={styles.wrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className={styles.title}>Сеть и питание</h2>
      <div className={styles.columns}>
        <GlassCard className={styles.col}>
          <h3 className={styles.colTitle}>Расчёт</h3>
          <div className={styles.row}><span>HDD, ТБ</span><span className={styles.mono}>{result ? result.hddCount * 10 : 0}</span></div>
          <div className={styles.row}><span>Камер</span><span className={styles.mono}>{result?.totalCameras ?? 0}</span></div>
        </GlassCard>
      </div>
      <div className={styles.actions}>
        <GlowButton variant="secondary" onClick={() => setStep(3)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(5)}>Итог</GlowButton>
      </div>
    </motion.div>
  );
}
