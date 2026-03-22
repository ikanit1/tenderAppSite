import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ServicesSection } from '@/widgets/services/ServicesSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ServicesPage() {
  return (
    <>
      <PageMeta title="Услуги" description="Электромонтаж и слаботочные системы: квартиры, офисы, коммерческие объекты. Прайс и условия." />
      <MainContainer>
        <BackButton />
        <ServicesSection fullPage />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
