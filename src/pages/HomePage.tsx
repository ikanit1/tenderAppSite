import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
// import { Hero } from '@/widgets/hero/Hero';
import { AboutSection } from '@/widgets/about/AboutSection';
import { ServicesSection } from '@/widgets/services/ServicesSection';
import { PartnersSection } from '@/widgets/partners/PartnersSection';
import { DigitalEcosystemSection } from '@/widgets/digitalEcosystem/DigitalEcosystemSection';
// import { AssistantSection } from '@/widgets/assistant/AssistantSection';
import { ContactSection } from '@/widgets/contact/ContactSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function HomePage() {
  return (
    <>
      <PageMeta title="ТОО «G&R Group»" />
      <MainContainer>
        {/* <Hero /> */}
        <AboutSection />
        <ServicesSection />
        <PartnersSection />
        <DigitalEcosystemSection />
        {/* <AssistantSection /> */}
        <ContactSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
