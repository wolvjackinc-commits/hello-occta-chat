import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://hello-occta-chat.lovable.app';

// Organization Schema
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'OCCTA Limited',
  alternateName: 'OCCTA',
  url: BASE_URL,
  logo: `${BASE_URL}/pwa-512x512.png`,
  description: 'Affordable broadband, SIM plans, and landline services across the UK',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '20 Wensley Bank',
    addressLocality: 'Huddersfield',
    addressRegion: 'West Yorkshire',
    postalCode: 'HD3 3WU',
    addressCountry: 'GB',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+44-333-016-2016',
    contactType: 'customer service',
    areaServed: 'GB',
    availableLanguage: ['English'],
  },
  sameAs: [],
};

// Local Business Schema
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'TelecommunicationsService',
  name: 'OCCTA',
  description: 'UK broadband, SIM plans, and landline telephone services',
  url: BASE_URL,
  telephone: '+44-333-016-2016',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '20 Wensley Bank',
    addressLocality: 'Huddersfield',
    addressRegion: 'West Yorkshire',
    postalCode: 'HD3 3WU',
    addressCountry: 'GB',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 53.6458,
    longitude: -1.7854,
  },
  priceRange: '£',
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
  url: BASE_URL,
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
    },
  }),
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
