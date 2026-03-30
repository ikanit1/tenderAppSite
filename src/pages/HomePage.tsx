import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { StructuredData, getLocalBusinessSchema, getWebPageSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
// import { Hero } from '@/widgets/hero/Hero';
import { AboutSection } from '@/widgets/about/AboutSection';
import { ServicesSection } from '@/widgets/services/ServicesSection';
import { PartnersSection } from '@/widgets/partners/PartnersSection';
import { DigitalEcosystemSection } from '@/widgets/digitalEcosystem/DigitalEcosystemSection';
// import { CctvCalculatorSection } from '@/widgets/calculator/CctvCalculatorSection';
// import { AssistantSection } from '@/widgets/assistant/AssistantSection';
import { ContactSection } from '@/widgets/contact/ContactSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function HomePage() {
  const seoConfig = pageSEOConfig.home;

  const webPageSchema = getWebPageSchema({
    name: seoConfig.title,
    description: seoConfig.description,
    url: 'https://grgroup.kz/',
  });

  return (
    <>
      <PageMeta
        title={seoConfig.title}
        description={seoConfig.description}
        keywords={seoConfig.keywords}
        image={seoConfig.image}
      />
      <StructuredData data={[getLocalBusinessSchema(), webPageSchema]} />
      <MainContainer>
        {/* <Hero /> */}
        <AboutSection />
        <ServicesSection />
        <PartnersSection />
        <DigitalEcosystemSection />
        {/* <CctvCalculatorSection /> */}
        {/* <AssistantSection /> */}
        <ContactSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
