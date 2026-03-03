import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { CctvCalculatorSection } from '@/widgets/calculator/CctvCalculatorSection';

export function CalculatorPage() {
    return (
        <>
            <PageMeta
                title="Калькулятор видеонаблюдения"
                description="Онлайн-калькулятор оборудования для видеонаблюдения и домофонии. Рассчитайте камеры, кабель, NVR, коммутатор и жёсткие диски."
            />
            <MainContainer>
                <BackButton />
                <CctvCalculatorSection />
            </MainContainer>
        </>
    );
}
