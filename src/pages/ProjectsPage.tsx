import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ProjectsSection } from '@/widgets/projects/ProjectsSection';
import {
  StructuredData,
  getBreadcrumbSchema,
  getProjectsItemListSchema,
} from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
import { projectsList } from '@/shared/content/projects';

export function ProjectsPage() {
  const seoConfig = pageSEOConfig.projects;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Проекты', url: 'https://grgroup.kz/projects' },
  ]);

  const itemList = getProjectsItemListSchema(
    projectsList.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      client: p.client,
    })),
  );

  return (
    <>
      <PageMeta
        title={seoConfig.title}
        description={seoConfig.description}
        keywords={seoConfig.keywords}
        ogType={seoConfig.ogType}
      />
      <StructuredData data={[breadcrumbs, itemList]} />
      <MainContainer>
        <BackButton />
        <ProjectsSection />
      </MainContainer>
    </>
  );
}
