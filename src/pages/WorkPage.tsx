import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { WorkSection } from '@/widgets/work/WorkSection';

export function WorkPage() {
  return (
    <>
      <PageMeta
        title="Работа с G&R Group"
        description="Мини-приложение G&R Group для подрядчиков и специалистов: контракты, заявки, вакансии и проекты."
      />
      <MainContainer>
        <BackButton />
        <WorkSection />
      </MainContainer>
    </>
  );
}
