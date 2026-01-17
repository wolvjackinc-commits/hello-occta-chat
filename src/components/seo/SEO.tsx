import { Helmet } from 'react-helmet-async';

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
const DEFAULT_KEYWORDS = 'cheap broadband UK, no contract broadband, cancel anytime broadband, affordable internet UK, 5G SIM no credit check, cheap SIM deals UK, budget broadband, fibre broadband no contract, unlimited broadband UK, OCCTA';

export const SEO = ({
  title,
  description = 'Cheap broadband UK from £22.99/mo. No contract broadband, 5G SIM plans, landline. No credit check, cancel anytime. 900Mbps speeds. Get connected today!',
  canonical,
  type = 'website',
  image = DEFAULT_IMAGE,
  noIndex = false,
  keywords = DEFAULT_KEYWORDS,
  price,
  priceCurrency = 'GBP',
}: SEOProps) => {
  const fullTitle = title 
    ? `${title} | ${SITE_NAME} - Cheap UK Broadband & SIM` 
    : `${SITE_NAME} - Cheap UK Broadband, SIM Plans & Landline | No Contracts`;
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : undefined;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content="OCCTA - Affordable UK Broadband and SIM Plans" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_GB" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Price Tags for Products */}
      {price && (
        <>
          <meta property="product:price:amount" content={price} />
          <meta property="product:price:currency" content={priceCurrency} />
        </>
      )}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@OCCTA" />
      <meta name="twitter:creator" content="@OCCTA" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content="OCCTA - Affordable UK Broadband and SIM Plans" />
    </Helmet>
  );
};

export default SEO;
