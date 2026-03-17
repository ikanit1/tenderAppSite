import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './Step4Network.module.css';

export function Step4Network() {
  const reduceMotion = useReducedMotion();
  const inputs = useCalculatorStore((s) => s.inputs);
  const setInputs = useCalculatorStore((s) => s.setInputs);
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
      <div className={styles.columns}>
        <GlassCard className={styles.col}>
          <h3 className={styles.colTitle}>Расчёт</h3>
          <div className={styles.row}><span>HDD, ТБ</span><span className={styles.mono}>{result ? result.hddCount * 10 : 0}</span></div>
          <div className={styles.row}><span>Камер</span><span className={styles.mono}>{result?.totalCameras ?? 0}</span></div>
        </GlassCard>
      </div>
      <GlassCard className={styles.optionsCard}>
        <h3 className={styles.colTitle}>Серверное оборудование</h3>
        <div className={styles.inputGroup}>
          <span className={styles.inputLabel}>Патч-панель в стойке</span>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="hasPatchPanel"
                checked={!(inputs.hasPatchPanel ?? false)}
                onChange={() => setInputs({ ...inputs, hasPatchPanel: false })}
              />
              <span>Нет (прямое подключение)</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="hasPatchPanel"
                checked={inputs.hasPatchPanel ?? false}
                onChange={() => setInputs({ ...inputs, hasPatchPanel: true })}
              />
              <span>Да (профессиональная инсталляция)</span>
            </label>
          </div>
          <p className={styles.hint}>
            {inputs.hasPatchPanel ? 'Патч-панели и патч-корды камера×1 + NVR×4 в смете' : 'Только межоборудовательные патч-корды (экономия)'}
          </p>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.radioLabel}>
            <input
              type="checkbox"
              checked={inputs.hasSecurityPost ?? false}
              onChange={(e) => setInputs({ ...inputs, hasSecurityPost: e.target.checked })}
            />
            <span>Есть пост охраны (монитор в смете)</span>
          </label>
          <p className={styles.hint}>Монитор добавляется только при включённой опции; на малых объектах обычно не требуется.</p>
        </div>
      </GlassCard>
      <div className={styles.actions}>
        <GlowButton variant="secondary" onClick={() => setStep(3)}>Назад</GlowButton>
        <GlowButton onClick={() => setStep(5)}>Итог</GlowButton>
      </div>
    </motion.div>
  );
}
