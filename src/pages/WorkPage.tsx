import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { WorkSection } from '@/widgets/work/WorkSection';
import { StructuredData, getBreadcrumbSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';

export function WorkPage() {
  const seoConfig = pageSEOConfig.work;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Как мы работаем', url: 'https://grgroup.kz/work' },
  ]);

  return (
    <>
      <PageMeta
        title={seoConfig.title}
        description={seoConfig.description}
        keywords={seoConfig.keywords}
      />
      <StructuredData data={breadcrumbs} />
      <MainContainer>
        <BackButton />
        <WorkSection />
      </MainContainer>
    </>
  );
}
