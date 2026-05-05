import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ServicesSection } from '@/widgets/services/ServicesSection';
import {
  StructuredData,
  getBreadcrumbSchema,
  getServiceSchema,
  getOfferCatalogSchema,
} from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
import { servicesList } from '@/shared/content/services';

export function ServicesPage() {
  const seoConfig = pageSEOConfig.services;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Услуги', url: 'https://grgroup.kz/services' },
  ]);

  const serviceSchemas = servicesList.map((s) =>
    getServiceSchema({
      name: s.title,
      description: s.items.join('. '),
      areaServed: 'Казахстан',
      ...(s.priceFrom && { priceRange: s.priceFrom }),
    }),
  );

  const offerCatalog = getOfferCatalogSchema(
    servicesList.map((s) => ({
      name: s.title,
      description: s.items.join('. '),
      priceFrom: s.priceFrom,
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
      <StructuredData data={[breadcrumbs, offerCatalog, ...serviceSchemas]} />
      <MainContainer>
        <BackButton />
        <ServicesSection fullPage />
      </MainContainer>
    </>
  );
}
