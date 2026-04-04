import { Helmet } from 'react-helmet-async';
import { siteConfig } from './seoConfig';

interface StructuredDataProps {
  data: object | object[];
}

export function StructuredData({ data }: StructuredDataProps) {
  const schemas = Array.isArray(data) ? data : [data];
  return (
    <Helmet>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

// ── Schema builders ──────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

interface WebPageSchemaOpts {
  name: string;
  description: string;
  url: string;
}

export function getWebPageSchema({ name, description, url }: WebPageSchemaOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.domain,
    },
  };
}

interface ServiceSchemaOpts {
  name: string;
  description: string;
  priceRange?: string;
  areaServed?: string;
}

export function getServiceSchema({ name, description, priceRange, areaServed }: ServiceSchemaOpts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    ...(priceRange && { priceRange }),
    ...(areaServed && { areaServed }),
    provider: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.domain,
    },
  };
}

export function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: siteConfig.name,
    url: siteConfig.domain,
    description: siteConfig.defaultDescription,
    areaServed: 'Казахстан',
  };
}
