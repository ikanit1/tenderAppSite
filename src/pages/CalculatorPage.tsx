import { PageMeta } from '@/app/PageMeta';
import { BackButton } from '@/shared/ui/BackButton/BackButton';
import { CalculatorWizard } from '@/components/calculator/CalculatorWizard';
import { StructuredData, getBreadcrumbSchema, getWebPageSchema } from '@/shared/seo/StructuredData';
import { pageSEOConfig } from '@/shared/seo/seoConfig';
import styles from './CalculatorPage.module.css';

export function CalculatorPage() {
    const seoConfig = pageSEOConfig.calculator;

    const breadcrumbs = getBreadcrumbSchema([
        { name: 'Главная', url: 'https://grgroup.kz/' },
        { name: 'Калькулятор', url: 'https://grgroup.kz/calculator' },
    ]);

    const webPageSchema = getWebPageSchema({
        name: seoConfig.title,
        description: seoConfig.description,
        url: 'https://grgroup.kz/calculator',
    });

    return (
        <>
            <PageMeta
                title={seoConfig.title}
                description={seoConfig.description}
                keywords={seoConfig.keywords}
            />
            <StructuredData data={[breadcrumbs, webPageSchema]} />
            <div className={styles.pageContent}>
                <BackButton />
                <CalculatorWizard />
            </div>
        </>
    );
}
