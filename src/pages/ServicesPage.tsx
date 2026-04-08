import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ServicesSection } from '@/widgets/services/ServicesSection';
import { StructuredData, getBreadcrumbSchema, getServiceSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ServicesPage() {
  const seoConfig = pageSEOConfig.services;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Услуги', url: 'https://grgroup.kz/services' },
  ]);

  const serviceSchemas = [
    getServiceSchema({
      name: 'Видеонаблюдение',
      description: 'Проектирование и монтаж систем видеонаблюдения под ключ',
      areaServed: 'Казахстан',
    }),
    getServiceSchema({
      name: 'СКУД',
      description: 'Системы контроля и управления доступом для объектов любой сложности',
      areaServed: 'Казахстан',
    }),
  ];

  return (
    <>
      <PageMeta
        title={seoConfig.title}
        description={seoConfig.description}
        keywords={seoConfig.keywords}
        ogType={seoConfig.ogType}
      />
      <StructuredData data={[breadcrumbs, ...serviceSchemas]} />
      <MainContainer>
        <BackButton />
        <ServicesSection fullPage />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
