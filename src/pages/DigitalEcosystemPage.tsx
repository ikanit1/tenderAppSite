import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { DigitalEcosystemSection } from '@/widgets/digitalEcosystem/DigitalEcosystemSection';
import { StructuredData, getBreadcrumbSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function DigitalEcosystemPage() {
  const seoConfig = pageSEOConfig.digitalEcosystem;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Цифровая экосистема', url: 'https://grgroup.kz/digital-ecosystem' },
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
        <DigitalEcosystemSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
