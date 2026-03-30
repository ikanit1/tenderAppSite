import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { siteConfig, getCanonicalUrl, getImageUrl } from '@/shared/seo/seoConfig';

interface PageMetaProps {
  title: string;
  description?: string;
  keywords?: string[];
  image?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'product';
  canonical?: string;
}

const siteName = siteConfig.name;
const defaultDescription = siteConfig.defaultDescription;

export function PageMeta({
  title,
  description = defaultDescription,
  keywords,
  image,
  noindex = false,
  ogType = 'website',
  canonical,
}: PageMetaProps) {
  const location = useLocation();
  const fullTitle = title === siteName ? siteName : `${title} | ${siteName}`;
  const canonicalUrl = canonical || getCanonicalUrl(location.pathname);
  const ogImage = image ? getImageUrl(image) : `${siteConfig.domain}/GR.png`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={siteConfig.locale} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
