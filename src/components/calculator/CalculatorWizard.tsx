import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react';
import { useCalculatorStore } from '@/store/calculatorStore';
import { BackgroundScene } from '@/components/three/BackgroundScene';
import { Step1Object } from './steps/Step1Object';
import { IntercomCalculator } from './IntercomCalculator';
import styles from './CalculatorWizard.module.css';

const Step5Result = lazy(() =>
  import('./steps/Step5Result').then((m) => ({ default: m.Step5Result }))
);

class StepResultErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Step5Result load/render failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className={styles.loading}>Ошибка загрузки результата</div>;
    }
    return this.props.children;
  }
}

export function CalculatorWizard() {
  const buildingFloors = useCalculatorStore((s) => s.buildingFloors);

  return (
    <div className={styles.wizard}>
      <BackgroundScene buildingFloors={buildingFloors} />
      <div className={styles.content}>
        <main className={styles.main} aria-live="polite">
          <div className={styles.blocksList}>
            <div className={styles.inputsRow}>
              <section className={styles.block} aria-label="Расчет видеонаблюдения ЖК">
                <Step1Object />
              </section>
              <section id="intercom-calculator" className={styles.block} aria-label="Расчёт домофонии ЖК">
                <IntercomCalculator />
              </section>
            </div>
            <section id="calculator-result" className={styles.block} aria-label="Итог расчёта">
              <StepResultErrorBoundary>
                <Suspense fallback={<div className={styles.loading}>Загрузка…</div>}>
                  <Step5Result />
                </Suspense>
              </StepResultErrorBoundary>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
