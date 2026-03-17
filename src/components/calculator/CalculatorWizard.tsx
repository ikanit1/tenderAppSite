import { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { BackgroundScene } from '@/components/three/BackgroundScene';
import { Stepper } from './Stepper';
import { Step1Object } from './steps/Step1Object';
import styles from './CalculatorWizard.module.css';

const Step2Cameras = lazy(() => import('./steps/Step2Cameras').then((m) => ({ default: m.Step2Cameras })));
const Step3Intercom = lazy(() => import('./steps/Step3Intercom').then((m) => ({ default: m.Step3Intercom })));
const Step4Network = lazy(() => import('./steps/Step4Network').then((m) => ({ default: m.Step4Network })));
const Step5Result = lazy(() => import('./steps/Step5Result').then((m) => ({ default: m.Step5Result })));

function StepContent() {
  const step = useCalculatorStore((s) => s.step);
  switch (step) {
    case 1:
      return <Step1Object />;
    case 2:
      return <Step2Cameras />;
    case 3:
      return <Step3Intercom />;
    case 4:
      return <Step4Network />;
    case 5:
      return <Step5Result />;
    default:
      return <Step1Object />;
  }
}

export function CalculatorWizard() {
  const step = useCalculatorStore((s) => s.step);
  const buildingFloors = useCalculatorStore((s) => s.buildingFloors);

  return (
    <div className={styles.wizard}>
      <BackgroundScene buildingFloors={buildingFloors} />
      <div className={styles.content}>
        <Stepper />
        <main className={styles.main} aria-live="polite">
          <Suspense fallback={<div className={styles.loading}>Загрузка…</div>}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ minHeight: 200 }}
              >
                <StepContent />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
