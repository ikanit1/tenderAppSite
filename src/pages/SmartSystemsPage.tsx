import { PageMeta } from '@/app/PageMeta';
import { MainContainer } from '@/shared/ui/MainContainer/MainContainer';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { SmartSystemsSection } from '@/widgets/smartSystems/SmartSystemsSection';
import { SmartMarquee } from '@/widgets/smartSystems/SmartMarquee';
import { SmartSystemsProductModal } from '@/widgets/smartSystems/SmartSystemsProductModal';
import { StructuredData, getBreadcrumbSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
import { useState, useCallback } from 'react';
import type { AkuvoxProduct } from '@/shared/content/akuvoxSmartSystems';
// import { AssistantWidget } from '@/widgets/assistant/AssistantWidget';

export function SmartSystemsPage() {
  const [selectedProduct, setSelectedProduct] = useState<AkuvoxProduct | null>(null);
  const seoConfig = pageSEOConfig.smartSystems;

  const handleProductClick = useCallback((product: AkuvoxProduct) => {
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Главная', url: 'https://grgroup.kz/' },
    { name: 'Умные системы', url: 'https://grgroup.kz/smart-systems' },
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
        <div className="catalogContent">
          <SmartMarquee onProductClick={handleProductClick} />
        </div>
        <SmartSystemsSection />
      </MainContainer>
      <SmartSystemsProductModal product={selectedProduct} onClose={handleCloseModal} />
      {/* <AssistantWidget /> */}
    </>
  );
}
