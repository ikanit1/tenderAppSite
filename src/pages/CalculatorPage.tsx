import { PageMeta } from '@/app/PageMeta';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { CalculatorWizard } from '@/components/calculator/CalculatorWizard';
import styles from './CalculatorPage.module.css';

export function CalculatorPage() {
    return (
        <>
            <PageMeta
                title="Калькулятор видеонаблюдения"
                description="Онлайн-калькулятор оборудования для видеонаблюдения и домофонии. Рассчитайте камеры, кабель, NVR, коммутатор и жёсткие диски."
            />
            <div className={styles.pageContent}>
                <BackButton />
                <CalculatorWizard />
            </div>
        </>
    );
}
