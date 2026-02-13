import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { DigitalEcosystemSection } from '@/widgets/digitalEcosystem/DigitalEcosystemSection';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function DigitalEcosystemPage() {
  return (
    <>
      <PageMeta
        title="Цифровая экосистема дома"
        description="IP-домофония и видеонаблюдение. Коммерческое предложение G&R Group."
      />
      <MainContainer>
        <BackButton />
        <DigitalEcosystemSection />
      </MainContainer>
      {/* <AssistantWidget /> */}
    </>
  );
}
