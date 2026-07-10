/**
 * Centralized company configuration
 * Single source of truth for all company details used across the application
 */

import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_INTERNATIONAL,
  CONTACT_PHONE_TEL,
} from "./constants";

export const companyConfig = {
  // Company Legal Details
  name: "OCCTA LIMITED",
  tradingName: "OCCTA LIMITED",
  companyNumber: "13828933",
  // VAT registration — OCCTA is VAT registered from 01 July 2026.
  // Use `isVatApplicableFor(dateIso)` for date-gated display on historical
  // documents so invoices/receipts dated before the effective date do not
  // display the VAT number retroactively.
  vatNumber: "520 6072 30",
  vatRegistered: true,
  vatEffectiveDate: "2026-07-01",
  defaultVatRate: 20,
  vatScheme: "Standard VAT accounting",
  vatDisplayModeConsumer: "inc VAT first" as const,
  vatDisplayModeBusiness: "ex VAT + inc VAT" as const,
  
  // Contact Information
  phone: {
    display: CONTACT_PHONE_DISPLAY,
    href: CONTACT_PHONE_TEL,
    international: CONTACT_PHONE_INTERNATIONAL,
  },
  
  // Email Addresses
  email: {
    general: "hello@occta.co.uk",
    support: "hello@occta.co.uk",
    complaints: "hello@occta.co.uk",
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

  // Social Links
  socialLinks: [
    "https://x.com/Occtatelecom",
    "https://www.facebook.com/Occtalimited/",
    "https://www.instagram.com/occtalimited",
  ],

  // Business Information
  foundingYear: null,
  
  // Support Hours
  supportHours: {
    weekday: "Mon-Fri 9am-6pm",
    saturday: "Sat 9am-1pm",
    phone: "Mon–Fri, 8am–6pm",
  },
  
  // Legal/Compliance
  // Global tagline. OCCTA now offers both Flex (rolling) and Fixed/Price Lock
  // contracts, so global copy must not claim "No contracts" or "Cancel anytime".
  // Flex-specific pages may use "Flexible monthly options available" / "No minimum term".
  tagline: "Simple telecom. Clear terms.",
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
VAT No. ${companyConfig.vatNumber}
`.trim();

// Helper for PDF footers
export const getPdfFooterText = () => 
  `${companyConfig.name} | Company No. ${companyConfig.companyNumber} | VAT No. ${companyConfig.vatNumber} | ${companyConfig.address.oneLine}`;

/**
 * Whether VAT registration applies to a document with the given ISO date.
 * Returns false for undated documents (safe default: do not show VAT number).
 * Used to gate VAT-number rendering on historical invoices/receipts issued
 * before the effective date.
 */
export function isVatApplicableFor(isoDate?: string | Date | null): boolean {
  if (!companyConfig.vatRegistered) return false;
  if (!isoDate) return false;
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return false;
  return d.getTime() >= new Date(companyConfig.vatEffectiveDate + "T00:00:00Z").getTime();
}

export default companyConfig;
