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
    '@id': `${siteConfig.domain}/#organization`,
    name: siteConfig.name,
    url: siteConfig.domain,
    description: siteConfig.defaultDescription,
    areaServed: 'Казахстан',
    telephone: '+77714215593',
    email: 'Hello@atta.la',
    priceRange: '₸₸',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ул. Кабанбай Батыра, 56',
      addressLocality: 'Астана',
      addressCountry: 'KZ',
    },
  };
}

interface FaqItem {
  question: string;
  answer: string;
}

export function getFaqSchema(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

interface ProjectListItem {
  id: string;
  title: string;
  description: string;
  client?: string;
}

export function getProjectsItemListSchema(items: readonly ProjectListItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'CreativeWork',
        name: item.title,
        description: item.description,
        ...(item.client && { creator: { '@type': 'Organization', name: item.client } }),
      },
    })),
  };
}

interface OfferCatalogService {
  name: string;
  description: string;
  priceFrom?: string;
}

export function getOfferCatalogSchema(services: readonly OfferCatalogService[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: 'Услуги G&R Group',
    provider: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.domain,
    },
    itemListElement: services.map((s) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: s.name,
        description: s.description,
      },
      ...(s.priceFrom && { priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'KZT', description: s.priceFrom } }),
    })),
  };
}
