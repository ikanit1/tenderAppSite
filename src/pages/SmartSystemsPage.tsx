import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { SmartSystemsSection } from '@/widgets/smartSystems/SmartSystemsSection';
import { SmartMarquee } from '@/widgets/smartSystems/SmartMarquee';
import { SmartSystemsProductModal } from '@/widgets/smartSystems/SmartSystemsProductModal';
import { useState, useCallback } from 'react';
import type { AkuvoxProduct } from '@/shared/content/akuvoxSmartSystems';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function SmartSystemsPage() {
  const [selectedProduct, setSelectedProduct] = useState<AkuvoxProduct | null>(null);

  const handleProductClick = useCallback((product: AkuvoxProduct) => {
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  return (
    <>
      <PageMeta
        title="Умные системы"
        description="Оборудование Akuvox для умного дома: сенсорные панели и аксессуары. Цены в тенге."
      />
      <MainContainer>
        <BackButton />
        <SmartMarquee onProductClick={handleProductClick} />
        <SmartSystemsSection />
      </MainContainer>
      <SmartSystemsProductModal product={selectedProduct} onClose={handleCloseModal} />
      {/* <AssistantWidget /> */}
    </>
  );
}
