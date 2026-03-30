import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ContactSection } from '@/widgets/contact/ContactSection';
import { StructuredData, getBreadcrumbSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ContactsPage() {
  const seoConfig = pageSEOConfig.contacts;

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Контакты', url: 'https://grgroup.kz/contacts' },
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
        <ContactSection fullPage />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
