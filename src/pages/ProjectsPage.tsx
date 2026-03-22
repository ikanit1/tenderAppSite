import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ProjectsSection } from '@/widgets/projects/ProjectsSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ProjectsPage() {
  return (
    <>
      <PageMeta
        title="Проекты"
        description="Реализованные проекты G&R Group: видеонаблюдение, системы безопасности, электромонтаж для предприятий Казахстана."
      />
      <MainContainer>
        <BackButton />
        <ProjectsSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
