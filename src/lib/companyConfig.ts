/**
 * Centralized company configuration
 * Single source of truth for all company details used across the application
 */

export const companyConfig = {
  // Company Legal Details
  name: "OCCTA Limited",
  tradingName: "OCCTA",
  companyNumber: "13828933",
  vatNumber: null, // Add when registered for VAT
  
  // Contact Information
  phone: {
    display: "0800 260 6627",
    href: "tel:08002606627",
    international: "+44-800-260-6627",
  },
  
  // Email Addresses
  email: {
    general: "hello@occta.co.uk",
    support: "support@occta.co.uk",
    complaints: "complaints@occta.co.uk",
  },
  
  // Physical Address
  address: {
    street: "22 Pavilion View",
    city: "Huddersfield",
    postcode: "HD3 3WU",
    country: "United Kingdom",
    countryCode: "GB",
    region: "England",
    // Formatted versions
    oneLine: "22 Pavilion View, Huddersfield, HD3 3WU",
    full: "22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom",
    mapsUrl: "https://maps.google.com/?q=22%20Pavilion%20View,%20Huddersfield,%20HD3%203WU",
  },
  
  // Website
  website: {
    url: "https://www.occta.co.uk",
    domain: "www.occta.co.uk",
  },
  
  // Business Information
  foundingYear: 2021,
  
  // Support Hours
  supportHours: {
    weekday: "Mon-Fri 9am-6pm",
    saturday: "Sat 9am-1pm",
    phone: "Mon–Fri, 8am–6pm",
  },
  
  // Legal/Compliance
  tagline: "Proper British telecom. No robots, no rubbish, no regrets.",
  compliance: "OCCTA Limited complies with UK telecommunications regulations and GDPR requirements.",
} as const;

// Helper function for formatted contact block (for emails, PDFs, etc.)
export const getFormattedContact = () => `
${companyConfig.name}
${companyConfig.address.street}
${companyConfig.address.city}, ${companyConfig.address.postcode}
${companyConfig.address.country}

Phone: ${companyConfig.phone.display}
Email: ${companyConfig.email.support}
Web: ${companyConfig.website.url}
Company No. ${companyConfig.companyNumber}
`.trim();

// Helper for PDF footers
export const getPdfFooterText = () => 
  `${companyConfig.name} | Company No. ${companyConfig.companyNumber} | ${companyConfig.address.oneLine}`;

export default companyConfig;
