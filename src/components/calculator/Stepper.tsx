import { motion } from 'framer-motion';
import { useCalculatorStore, STEPS } from '@/store/calculatorStore';
import styles from './Stepper.module.css';

export function Stepper() {
  const step = useCalculatorStore((s) => s.step);
  const setStep = useCalculatorStore((s) => s.setStep);

  return (
    <nav className={styles.stepper} aria-label="Шаги калькулятора">
      <ol className={styles.list}>
        {STEPS.map((s, i) => {
          const isActive = step === s.id;
          const completed = step > s.id;
          const stepNumber = i + 1;
          return (
            <li key={s.id} className={styles.item}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => setStep(s.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${s.label}${completed ? ', завершён' : ''}`}
              >
                <span className={styles.circleWrap}>
                  {completed ? (
                    <motion.span
                      className={styles.check}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      ✓
                    </motion.span>
                  ) : (
                    <motion.span
                      className={styles.num}
                      layoutId={isActive ? 'activeStep' : undefined}
                      animate={isActive ? { boxShadow: '0 0 20px 6px rgba(157,78,221,0.35)' } : {}}
                    >
                      {stepNumber}
                    </motion.span>
                  )}
                </span>
                <span className={styles.label}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={styles.line}>
                  <motion.div
                    className={styles.lineFill}
                    initial={false}
                    animate={{ width: completed ? '100%' : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
