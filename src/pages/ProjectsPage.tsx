import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ProjectsSection } from '@/widgets/projects/ProjectsSection';
import { StructuredData, getBreadcrumbSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ProjectsPage() {
  const seoConfig = pageSEOConfig.projects;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Проекты', url: 'https://grgroup.kz/projects' },
  ]);

  return (
    <>
      <PageMeta
        title={seoConfig.title}
        description={seoConfig.description}
        keywords={seoConfig.keywords}
        ogType={seoConfig.ogType}
      />
      <StructuredData data={breadcrumbs} />
      <MainContainer>
        <BackButton />
        <ProjectsSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
