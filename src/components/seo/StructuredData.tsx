import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://www.occta.co.uk';

// Organization Schema with enhanced details
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'OCCTA Limited',
  alternateName: 'OCCTA',
  url: BASE_URL,
  logo: `${BASE_URL}/pwa-512x512.png`,
  description: 'Cheap UK broadband, SIM plans, and landline services with no contracts. Affordable internet from £22.99/month.',
  foundingDate: '2021',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '22 Pavilion View',
    addressLocality: 'Huddersfield',
    postalCode: 'HD3 3WU',
    addressCountry: 'GB',
    addressRegion: 'England',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: '+44-800-260-6627',
      contactType: 'customer service',
      areaServed: 'GB',
      availableLanguage: ['English'],
      hoursAvailable: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    },
    {
      '@type': 'ContactPoint',
      telephone: '+44-800-260-6627',
      contactType: 'sales',
      areaServed: 'GB',
      availableLanguage: ['English'],
    },
  ],
  sameAs: [],
};

// Local Business Schema - basic info without reviews
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${BASE_URL}/#localbusiness`,
  name: 'OCCTA',
  description: 'Cheap UK broadband, SIM plans, and landline services. No contracts, no hidden fees, cancel anytime.',
  url: BASE_URL,
  telephone: '+44-800-260-6627',
  priceRange: '£',
  image: `${BASE_URL}/pwa-512x512.png`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '22 Pavilion View',
    addressLocality: 'Huddersfield',
    postalCode: 'HD3 3WU',
    addressCountry: 'GB',
    addressRegion: 'England',
  },
  areaServed: {
    '@type': 'Country',
    name: 'United Kingdom',
  },
};

// Website Schema with SearchAction
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'OCCTA',
  alternateName: 'OCCTA Limited',
  url: BASE_URL,
  description: 'Cheap UK broadband, SIM plans, and landline services with no contracts.',
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
    name: 'OCCTA',
    url: BASE_URL,
  },
  areaServed: {
    '@type': 'Country',
    name: 'United Kingdom',
  },
  ...(price && {
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency,
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      seller: {
        '@type': 'Organization',
        name: 'OCCTA',
      },
    },
  }),
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
    name: 'OCCTA',
  },
  offers: {
    '@type': 'Offer',
    price,
    priceCurrency: 'GBP',
    availability: 'https://schema.org/InStock',
    priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    seller: {
      '@type': 'Organization',
      name: 'OCCTA',
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
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default StructuredData;
