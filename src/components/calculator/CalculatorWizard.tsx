import { Suspense, lazy } from 'react';
import { useCalculatorStore } from '@/store/calculatorStore';
import { BackgroundScene } from '@/components/three/BackgroundScene';
import { Step1Object } from './steps/Step1Object';
import styles from './CalculatorWizard.module.css';

const Step5Result = lazy(() => import('./steps/Step5Result').then((m) => ({ default: m.Step5Result })));

export function CalculatorWizard() {
  const buildingFloors = useCalculatorStore((s) => s.buildingFloors);

  return (
    <div className={styles.wizard}>
      <BackgroundScene buildingFloors={buildingFloors} />
      <div className={styles.content}>
        <main className={styles.main} aria-live="polite">
          <div className={styles.blocksList}>
            <section className={styles.block} aria-label="Параметры объекта">
              <Step1Object />
            </section>
            <section id="calculator-result" className={styles.block} aria-label="Итог расчёта">
              <Suspense fallback={<div className={styles.loading}>Загрузка…</div>}>
                <Step5Result />
              </Suspense>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
