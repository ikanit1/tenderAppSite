import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { ContactSection } from '@/widgets/contact/ContactSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function ContactsPage() {
  return (
    <>
      <PageMeta title="Контакты" description="Свяжитесь с нами: телефон, email, адрес в Астане. Оставьте заявку на расчёт." />
      <MainContainer>
        <BackButton />
        <ContactSection fullPage />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
