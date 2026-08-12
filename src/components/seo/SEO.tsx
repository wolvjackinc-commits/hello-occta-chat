import { Helmet } from 'react-helmet-async';
import { getFromPrices } from '@/lib/pricing/engine';
import { isPrivateRoutePath } from './PrivateRouteNoIndex';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'product';
  image?: string;
  noIndex?: boolean;
  keywords?: string;
  price?: string;
  priceCurrency?: string;
}

const BASE_URL = 'https://www.occta.co.uk';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = 'OCCTA';
const DEFAULT_KEYWORDS = 'UK broadband, price lock broadband, 30 day rolling broadband, flexible broadband, fibre broadband UK, 5G SIM UK, SIM only deals UK, OCCTA';
const ROBOTS_INDEXABLE = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

/** Absolute https URL for social images; relative paths are resolved to the canonical domain. */
const toAbsoluteUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

/** Path-only canonical fallback (no query string, no hash) for callers that omit `canonical`. */
const currentPath = (): string => {
  if (typeof window === 'undefined') return '/';
  const path = window.location.pathname || '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
};

export const SEO = ({
  title,
  description = `UK fibre broadband from £${getFromPrices().broadband}/mo. Price Lock 24 or Flex 30 where eligible. Clear first bill. UK-based support.`,
  canonical,
  type = 'website',
  image = DEFAULT_IMAGE,
  noIndex = false,
  keywords = DEFAULT_KEYWORDS,
  price,
  priceCurrency = 'GBP',
}: SEOProps) => {
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — UK Broadband, 5G SIM & Digital Home Phone`;
  const canonicalPath = canonical ?? currentPath();
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const imageUrl = toAbsoluteUrl(image);
  // Never let a page-level SEO call re-open indexing on a private/transactional
  // route that PrivateRouteNoIndex protects (Helmet dedupes by name, last wins).
  const blockIndexing = noIndex || isPrivateRoutePath(currentPath());

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Canonical URL — falls back to the current pathname when not passed explicitly.
          Omitted on noindex routes so tokenised/private URLs are never advertised. */}
      {!blockIndexing && <link rel="canonical" href={canonicalUrl} />}

      {/* Robots — always explicit */}
      <meta name="robots" content={blockIndexing ? 'noindex, nofollow' : ROBOTS_INDEXABLE} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content="OCCTA - Affordable UK Broadband and SIM Plans" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_GB" />
      {!blockIndexing && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Price Tags for Products */}
      {price && <meta property="product:price:amount" content={price} />}
      {price && <meta property="product:price:currency" content={priceCurrency} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@OCCTA" />
      <meta name="twitter:creator" content="@OCCTA" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content="OCCTA - Affordable UK Broadband and SIM Plans" />
    </Helmet>
  );
};

export default SEO;
