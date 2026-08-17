import { Helmet } from 'react-helmet-async';
import { getFromPrices } from '@/lib/pricing/engine';

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

const toAbsoluteUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  // Ensure we use the www version as the primary canonical
  return `https://www.occta.co.uk${path}`;
};

export const SEO = ({
  title,
  description,
  canonical,
  type = 'website',
  image = DEFAULT_IMAGE,
  noIndex = false,
  keywords = DEFAULT_KEYWORDS,
  price,
  priceCurrency = 'GBP',
}: SEOProps) => {
  const currentPrices = getFromPrices();
  const defaultDesc = `UK fibre broadband from £${currentPrices.broadband}/mo. Price Lock 24 or Flex 30 where eligible. Clear first bill. UK-based support.`;
  
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — UK Broadband, 5G SIM & Digital Home Phone`;

  const browserPath = typeof window !== 'undefined'
    ? window.location.pathname
    : '/';
  
  // Clean up the canonical path - remove trailing slashes except for root
  let canonicalPath = (canonical || browserPath || '/').split('?')[0];
  if (canonicalPath.length > 1 && canonicalPath.endsWith('/')) {
    canonicalPath = canonicalPath.slice(0, -1);
  }
  
  const canonicalUrl = toAbsoluteUrl(canonicalPath);
  const socialImage = toAbsoluteUrl(image);
  const metaDescription = description || defaultDesc;
  
  const robotsContent = noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={keywords} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      <meta name="robots" content={robotsContent} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:alt" content="OCCTA UK broadband, SIM and Digital Voice" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_GB" />
      <meta property="og:url" content={canonicalUrl} />

      {/* Price Tags for Products */}
      {price && <meta property="product:price:amount" content={price} />}
      {price && <meta property="product:price:currency" content={priceCurrency} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@OCCTA" />
      <meta name="twitter:creator" content="@OCCTA" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content="OCCTA UK broadband, SIM and Digital Voice" />
    </Helmet>
  );
};

export default SEO;