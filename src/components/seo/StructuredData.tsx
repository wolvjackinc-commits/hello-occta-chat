import { Helmet } from 'react-helmet-async';
import { companyConfig } from '@/lib/companyConfig';

const BASE_URL = companyConfig.website.url;

// Organization Schema with enhanced details - for homepage
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: companyConfig.tradingName,
  legalName: companyConfig.name,
  alternateName: companyConfig.tradingName,
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/pwa-512x512.png`,
  image: `${BASE_URL}/og-image.png`,
  description: 'Cheap UK broadband, SIM plans, and landline services with no contracts. Affordable internet from £22.99/month.',
  ...(companyConfig.foundingYear ? { foundingDate: String(companyConfig.foundingYear) } : {}),
  address: {
    '@type': 'PostalAddress',
    streetAddress: companyConfig.address.street,
    addressLocality: companyConfig.address.city,
    postalCode: companyConfig.address.postcode,
    addressCountry: companyConfig.address.countryCode,
    addressRegion: companyConfig.address.region,
  },
  email: companyConfig.email.general,
  telephone: companyConfig.phone.display,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: companyConfig.phone.display,
    contactType: 'customer support',
    email: companyConfig.email.general,
    areaServed: 'GB',
    availableLanguage: ['en'],
  },
  areaServed: {
    '@type': 'Country',
    name: companyConfig.address.country,
  },
  sameAs: companyConfig.socialLinks,
};

// Local Business Schema - basic info without reviews
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${BASE_URL}/#localbusiness`,
  name: companyConfig.tradingName,
  legalName: companyConfig.name,
  description: 'Cheap UK broadband, SIM plans, and landline services. No contracts, no hidden fees, cancel anytime.',
  url: BASE_URL,
  telephone: companyConfig.phone.display,
  email: companyConfig.email.general,
  priceRange: '£',
  image: `${BASE_URL}/pwa-512x512.png`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: companyConfig.address.street,
    addressLocality: companyConfig.address.city,
    postalCode: companyConfig.address.postcode,
    addressCountry: companyConfig.address.countryCode,
    addressRegion: companyConfig.address.region,
  },
  areaServed: 'GB',
};

// Website Schema with SearchAction
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: companyConfig.tradingName,
  alternateName: companyConfig.name,
  url: BASE_URL,
  description: 'Cheap UK broadband, SIM plans, and landline services with no contracts.',
  publisher: {
    '@type': 'Organization',
    name: companyConfig.tradingName,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/pwa-512x512.png`,
    },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/broadband?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

interface ServiceSchemaProps {
  name: string;
  description: string;
  url: string;
  price?: string;
  priceCurrency?: string;
}

export const createServiceSchema = ({
  name,
  description,
  url,
  price,
  priceCurrency = 'GBP',
}: ServiceSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name,
  description,
  url: `${BASE_URL}${url}`,
  provider: {
    '@type': 'Organization',
    name: companyConfig.tradingName,
    url: BASE_URL,
  },
  areaServed: {
    '@type': 'Country',
    name: companyConfig.address.country,
  },
  termsOfService: `${BASE_URL}/terms-of-service`,
  ...(price && {
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency,
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      eligibleRegion: {
        '@type': 'Country',
        name: companyConfig.address.country,
      },
      seller: {
        '@type': 'Organization',
        name: companyConfig.tradingName,
      },
    },
  }),
});

// Offer schema for individual product/plan offerings
interface OfferSchemaProps {
  name: string;
  description: string;
  price: string;
  url: string;
  sku?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  category?: string;
}

export const createOfferSchema = ({
  name,
  description,
  price,
  url,
  sku,
  availability = 'InStock',
  category,
}: OfferSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'Offer',
  name,
  description,
  price,
  priceCurrency: 'GBP',
  url: `${BASE_URL}${url}`,
  availability: `https://schema.org/${availability}`,
  priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
  eligibleRegion: {
    '@type': 'Country',
    name: companyConfig.address.country,
  },
  seller: {
    '@type': 'Organization',
    name: companyConfig.tradingName,
    url: BASE_URL,
  },
  itemOffered: {
    '@type': 'Service',
    name,
    description,
    ...(sku && { sku }),
    ...(category && { category }),
    provider: {
      '@type': 'Organization',
      name: companyConfig.tradingName,
    },
  },
});

// Product Schema for broadband plans
export const createProductSchema = ({
  name,
  description,
  price,
  speed,
  url,
}: {
  name: string;
  description: string;
  price: string;
  speed?: string;
  url: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name,
  description,
  url: `${BASE_URL}${url}`,
  brand: {
    '@type': 'Brand',
    name: companyConfig.tradingName,
  },
  offers: {
    '@type': 'Offer',
    price,
    priceCurrency: 'GBP',
    availability: 'https://schema.org/InStock',
    priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    seller: {
      '@type': 'Organization',
      name: companyConfig.tradingName,
    },
    itemCondition: 'https://schema.org/NewCondition',
    ...(speed && { description: `Up to ${speed} download speed` }),
  },
});

// FAQ Schema for common questions
export const createFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});

// Breadcrumb Schema
export const createBreadcrumbSchema = (
  items: { name: string; url: string }[]
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${BASE_URL}${item.url}`,
  })),
});

interface StructuredDataProps {
  type?: 'organization' | 'localBusiness' | 'website' | 'all';
  customSchema?: object;
}

export const StructuredData = ({
  type = 'all',
  customSchema,
}: StructuredDataProps) => {
  const schemas: object[] = [];

  if (type === 'all' || type === 'organization') {
    schemas.push(organizationSchema);
  }
  if (type === 'all' || type === 'localBusiness') {
    schemas.push(localBusinessSchema);
  }
  if (type === 'all' || type === 'website') {
    schemas.push(websiteSchema);
  }
  if (customSchema) {
    schemas.push(customSchema);
  }

  return (
    <Helmet>
      {schemas.map((schema, index) => (
        <JsonLd key={index} data={schema} />
      ))}
    </Helmet>
  );
};

export const JsonLd = ({ data }: { data: object }) => (
  <script type="application/ld+json">{JSON.stringify(data)}</script>
);

export default StructuredData;
