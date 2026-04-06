import type {
  CatalogueProduct,
  InstallScenario,
  CareLevelConfig,
  VoiceCatalogueProduct,
  NumberType,
  PortingOption,
  SmsTier,
  CallTariff,
  AddonCatalogueItem,
  BundleConfig,
} from './types';

// ── Global constants ──
export const GLOBAL_CEASE_FEE = 36.00;
export const REBATE_CLAWBACK_MONTHS = 12;

// ── Broadband Catalogue ──
// Every ICUK wholesale row with exact uploaded prices.
export const catalogueProducts: CatalogueProduct[] = [
  // ── Residential 1-month (public, rolling) ──
  {
    id: 'sogea-40-10-1m', slug: 'sogea-40-10-1m', name: 'SOGEA 40/10 1-month',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 40, speedUp: 10,
    wholesaleMonthly: 25.00, retailMonthly: 29.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 30, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'public', notes: 'SOGEA 1-month product', disclaimers: '', source: 'icuk',
  },
  {
    id: 'sogea-80-20-1m', slug: 'sogea-80-20-1m', name: 'SOGEA 80/20 1-month',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 80, speedUp: 20,
    wholesaleMonthly: 26.00, retailMonthly: 30.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 40, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'public', notes: 'SOGEA 1-month product', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-80-20-tt', slug: 'fttp-80-20-tt', name: 'FTTP 80/20 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 80, speedUp: 20,
    wholesaleMonthly: 22.00, retailMonthly: 22.99, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 50, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-160-tt', slug: 'fttp-160-tt', name: 'FTTP 160 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 160, speedUp: 30,
    wholesaleMonthly: 27.00, retailMonthly: 32.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 60, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-220-tt', slug: 'fttp-220-tt', name: 'FTTP 220 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 220, speedUp: 30,
    wholesaleMonthly: 30.00, retailMonthly: 34.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 65, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-330-tt', slug: 'fttp-330-tt', name: 'FTTP 330 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 330, speedUp: 50,
    wholesaleMonthly: 31.00, retailMonthly: 35.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 70, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-500-tt', slug: 'fttp-500-tt', name: 'FTTP 500 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 500, speedUp: 75,
    wholesaleMonthly: 28.00, retailMonthly: 33.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 80, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-550-cf', slug: 'fttp-550-cf', name: 'FTTP 550 CityFibre',
    supplier: 'CityFibre', technology: 'FTTP', speedDown: 550, speedUp: 75,
    wholesaleMonthly: 35.00, retailMonthly: 40.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 75, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-1000-tt', slug: 'fttp-1000-tt', name: 'FTTP 1000 TalkTalk',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 1000, speedUp: 115,
    wholesaleMonthly: 30.00, retailMonthly: 35.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 90, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-1000-cf', slug: 'fttp-1000-cf', name: 'FTTP 1000 CityFibre',
    supplier: 'CityFibre', technology: 'FTTP', speedDown: 1000, speedUp: 115,
    wholesaleMonthly: 38.00, retailMonthly: 43.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'residential',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 85, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'public', notes: '', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-2500-cf', slug: 'fttp-2500-cf', name: 'FTTP 2500 CityFibre',
    supplier: 'CityFibre', technology: 'FTTP', speedDown: 2500, speedUp: 250,
    wholesaleMonthly: 39.00, retailMonthly: 49.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'public', customerType: 'business',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 95, marginMonthly: 10.95, marginOneOff: 0,
    visibility: 'public', notes: 'Hyper tier — not mapped to public residential card', disclaimers: '', source: 'icuk',
  },

  // ── Business-grade variants (internal_only) ──
  {
    id: 'sogea-40-10-1m-biz', slug: 'sogea-40-10-1m-biz', name: 'SOGEA 40/10 1-month Business',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 40, speedUp: 10,
    wholesaleMonthly: 25.00, retailMonthly: 29.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'internal_only', customerType: 'business',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 30, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: 'Business variant', disclaimers: '', source: 'icuk',
  },
  {
    id: 'sogea-80-20-1m-biz', slug: 'sogea-80-20-1m-biz', name: 'SOGEA 80/20 1-month Business',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 80, speedUp: 20,
    wholesaleMonthly: 26.00, retailMonthly: 30.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'internal_only', customerType: 'business',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 40, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: 'Business variant', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-500-tt-biz', slug: 'fttp-500-tt-biz', name: 'FTTP 500 TalkTalk Business',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 500, speedUp: 75,
    wholesaleMonthly: 28.00, retailMonthly: 33.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'internal_only', customerType: 'business',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 80, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'internal_only', notes: 'Business variant', disclaimers: '', source: 'icuk',
  },
  {
    id: 'fttp-1000-tt-biz', slug: 'fttp-1000-tt-biz', name: 'FTTP 1000 TalkTalk Business',
    supplier: 'TalkTalk', technology: 'FTTP', speedDown: 1000, speedUp: 115,
    wholesaleMonthly: 30.00, retailMonthly: 35.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'internal_only', customerType: 'business',
    networkType: 'FTTP', installTypeSupported: ['fttp-standard'],
    freeInstallEligible: true, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 90, marginMonthly: 5.95, marginOneOff: 0,
    visibility: 'internal_only', notes: 'Business variant', disclaimers: '', source: 'icuk',
  },

  // ── 12-month term variants (internal_only) ──
  {
    id: 'sogea-40-10-12m', slug: 'sogea-40-10-12m', name: 'SOGEA 40/10 12-month',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 40, speedUp: 10,
    wholesaleMonthly: 25.00, retailMonthly: 29.95, wholesaleContractTerm: 12,
    retailContractLabel: '12-month contract', productStatus: 'internal_only', customerType: 'residential',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 20, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: '12-month term variant', disclaimers: '', source: 'icuk',
  },
  {
    id: 'sogea-80-20-12m', slug: 'sogea-80-20-12m', name: 'SOGEA 80/20 12-month',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 80, speedUp: 20,
    wholesaleMonthly: 26.00, retailMonthly: 30.95, wholesaleContractTerm: 12,
    retailContractLabel: '12-month contract', productStatus: 'internal_only', customerType: 'residential',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 25, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: '12-month term variant', disclaimers: '', source: 'icuk',
  },

  // ── 18-month term variants (internal_only) ──
  {
    id: 'sogea-40-10-18m', slug: 'sogea-40-10-18m', name: 'SOGEA 40/10 18-month',
    supplier: 'Openreach', technology: 'SOGEA', speedDown: 40, speedUp: 10,
    wholesaleMonthly: 25.00, retailMonthly: 29.95, wholesaleContractTerm: 18,
    retailContractLabel: '18-month contract', productStatus: 'internal_only', customerType: 'residential',
    networkType: 'FTTC', installTypeSupported: ['engineer', 'no-engineer', 'migrate-fttc', 'migrate-adsl'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 15, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: '18-month term variant', disclaimers: '', source: 'icuk',
  },

  // ── Legacy / quote-only ──
  {
    id: 'soadsl-1m', slug: 'soadsl-1m', name: 'SOADSL 1-month',
    supplier: 'Openreach', technology: 'SOADSL', speedDown: 17, speedUp: 1,
    wholesaleMonthly: 20.00, retailMonthly: 24.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'internal_only', customerType: 'residential',
    networkType: 'ADSL', installTypeSupported: ['engineer', 'no-engineer'],
    freeInstallEligible: false, rebateClawbackMonths: 12, ceaseFee: 36.00,
    priorityScore: 10, marginMonthly: 4.95, marginOneOff: 0,
    visibility: 'internal_only', notes: 'Legacy ADSL — not promoted publicly', disclaimers: '', source: 'icuk',
  },
  {
    id: 'pstn-line', slug: 'pstn-line', name: 'PSTN Line',
    supplier: 'Openreach', technology: 'PSTN', speedDown: 0, speedUp: 0,
    wholesaleMonthly: 12.00, retailMonthly: 18.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'quote_only', customerType: 'both',
    networkType: 'PSTN', installTypeSupported: [],
    freeInstallEligible: false, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 1, marginMonthly: 6.95, marginOneOff: 0,
    visibility: 'quote_only', notes: 'Legacy PSTN — quote only', disclaimers: '', source: 'icuk',
  },
  {
    id: 'isdn2-line', slug: 'isdn2-line', name: 'ISDN2 Line',
    supplier: 'Openreach', technology: 'ISDN2', speedDown: 0, speedUp: 0,
    wholesaleMonthly: 18.00, retailMonthly: 28.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'quote_only', customerType: 'business',
    networkType: 'ISDN', installTypeSupported: [],
    freeInstallEligible: false, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 1, marginMonthly: 10.95, marginOneOff: 0,
    visibility: 'quote_only', notes: 'Legacy ISDN2 — quote only', disclaimers: '', source: 'icuk',
  },
  {
    id: 'isdn30-channel', slug: 'isdn30-channel', name: 'ISDN30 Channel',
    supplier: 'Openreach', technology: 'ISDN30', speedDown: 0, speedUp: 0,
    wholesaleMonthly: 8.00, retailMonthly: 14.95, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'quote_only', customerType: 'business',
    networkType: 'ISDN', installTypeSupported: [],
    freeInstallEligible: false, rebateClawbackMonths: 0, ceaseFee: 36.00,
    priorityScore: 1, marginMonthly: 6.95, marginOneOff: 0,
    visibility: 'quote_only', notes: 'Legacy ISDN30 — quote only, per channel', disclaimers: '', source: 'icuk',
  },
  {
    id: 'cps-line', slug: 'cps-line', name: 'CPS (Carrier Pre-Select)',
    supplier: 'Openreach', technology: 'CPS', speedDown: 0, speedUp: 0,
    wholesaleMonthly: 0, retailMonthly: 0, wholesaleContractTerm: 1,
    retailContractLabel: '30-day rolling', productStatus: 'quote_only', customerType: 'both',
    networkType: 'CPS', installTypeSupported: [],
    freeInstallEligible: false, rebateClawbackMonths: 0, ceaseFee: 0,
    priorityScore: 1, marginMonthly: 0, marginOneOff: 0,
    visibility: 'quote_only', notes: 'Legacy CPS — quote only', disclaimers: '', source: 'icuk',
  },
];

// ── Install Scenarios ──
export const installScenarios: InstallScenario[] = [
  { id: 'sogea-engineer', label: 'Engineer visit activation', retailCharge: 79.95, wholesaleCharge: 117.10, rebateAmount: 64.50, effectiveCost: 52.60 },
  { id: 'sogea-no-engineer', label: 'Self-install activation', retailCharge: 59.95, wholesaleCharge: 106.30, rebateAmount: 64.50, effectiveCost: 41.80 },
  { id: 'sogea-migrate-fttc', label: 'Migration from FTTC to SOGEA', retailCharge: 9.95, wholesaleCharge: 8.71, rebateAmount: 8.55, effectiveCost: 0.16 },
  { id: 'sogea-migrate-adsl', label: 'Migration from ADSL/SOADSL to SOGEA', retailCharge: 19.95, wholesaleCharge: 67.20, rebateAmount: 64.50, effectiveCost: 2.70 },
  { id: 'fttp-standard', label: 'Standard FTTP install', retailCharge: 0, wholesaleCharge: 0, rebateAmount: 0, effectiveCost: 0 },
];

// ── Care Levels ──
export const careLevels: CareLevelConfig[] = [
  { id: 'standard', label: 'Standard', monthlyUplift: 0, internalSLA: 'CL1: clear by 23:59 day after next Mon-Fri excl holidays. CL2: clear by 23:59 next day Mon-Sat excl holidays.' },
  { id: 'priority', label: 'Priority', monthlyUplift: 9, internalSLA: 'CL2.5: as CL2 with priority. CL3: same day if before 13:00, else by 12:59 next day, seven days incl holidays.' },
  { id: 'enhanced', label: 'Enhanced', monthlyUplift: 14, internalSLA: 'CL3: same day if before 13:00, else by 12:59 next day, seven days. CL4: within 6 hours any time any day.' },
];

// ── Voice Products ──
export const voiceProducts: VoiceCatalogueProduct[] = [
  { id: 'home-phone-payg', name: 'Digital Home Phone PAYG', type: 'home', variant: 'payg', wholesaleMonthly: 2.00, retailMonthly: 4.95, minutesIncluded: null, productStatus: 'public', customerType: 'residential', source: 'icuk' },
  { id: 'home-phone-1000min', name: 'Digital Home Phone 1000min', type: 'home', variant: 'bundle', wholesaleMonthly: 4.00, retailMonthly: 7.95, minutesIncluded: 1000, productStatus: 'public', customerType: 'residential', source: 'icuk' },
  { id: 'biz-voip-payg', name: 'Business VoIP PAYG', type: 'business', variant: 'payg', wholesaleMonthly: 3.00, retailMonthly: 6.95, minutesIncluded: null, productStatus: 'public', customerType: 'business', source: 'icuk' },
  { id: 'biz-voip-2000min', name: 'Business VoIP 2000min', type: 'business', variant: 'bundle', wholesaleMonthly: 6.00, retailMonthly: 11.95, minutesIncluded: 2000, productStatus: 'public', customerType: 'business', source: 'icuk' },
  { id: 'sip-trunk-payg', name: 'SIP Trunk PAYG', type: 'sip', variant: 'payg', wholesaleMonthly: 3.00, retailMonthly: 5.95, minutesIncluded: null, productStatus: 'public', customerType: 'business', source: 'icuk' },
  { id: 'sip-trunk-2000min', name: 'SIP Trunk 2000min', type: 'sip', variant: 'bundle', wholesaleMonthly: 6.00, retailMonthly: 9.95, minutesIncluded: 2000, productStatus: 'public', customerType: 'business', source: 'icuk' },
  { id: 'enhanced-sip', name: 'Enhanced SIP Add-on', type: 'sip', variant: 'payg', wholesaleMonthly: 1.00, retailMonthly: 2.50, minutesIncluded: null, productStatus: 'public', customerType: 'business', source: 'icuk' },
];

// ── Numbers ──
export const numberTypes: NumberType[] = [
  { id: 'number-bronze', tier: 'Bronze', wholesaleMonthly: 0.25, retailMonthly: 1.25 },
  { id: 'number-silver', tier: 'Silver', wholesaleMonthly: 1.50, retailMonthly: 2.95 },
  { id: 'number-gold', tier: 'Gold', wholesaleMonthly: 10.00, retailMonthly: 14.95 },
  { id: 'number-platinum', tier: 'Platinum', wholesaleMonthly: 20.00, retailMonthly: 29.95 },
  { id: 'number-nongeo', tier: 'Non-geographic', wholesaleMonthly: 0.50, retailMonthly: 1.95 },
];

// ── Porting ──
export const portingOptions: PortingOption[] = [
  { id: 'port-single', type: 'Single number port', wholesaleCharge: 11.00, retailCharge: 15.00 },
  { id: 'port-multi', type: 'Multi-number port', wholesaleCharge: 11.00, retailCharge: 12.00, multiCap: 72.00 },
  { id: 'port-change', type: 'Change/resubmission', wholesaleCharge: 11.00, retailCharge: 15.00 },
  { id: 'port-validation', type: 'Validation', wholesaleCharge: 5.00, retailCharge: 7.00 },
  { id: 'port-export', type: 'Export', wholesaleCharge: 10.00, retailCharge: 15.00 },
];

// ── SMS Tiers ──
export const smsTiers: SmsTier[] = [
  { minVolume: 1, maxVolume: 1999, retailPerMessage: 0.06, internationalFormula: 'wholesale × 1.25, min 0.10' },
  { minVolume: 2000, maxVolume: 4999, retailPerMessage: 0.05, internationalFormula: 'wholesale × 1.25, min 0.10' },
  { minVolume: 5000, maxVolume: null, retailPerMessage: 0.045, internationalFormula: 'wholesale × 1.25, min 0.10' },
];

// ── Call Tariffs ──
export const callTariffs: CallTariff[] = [
  { type: 'UK landline', retailPerMinute: 0.015 },
  { type: 'UK mobile', retailPerMinute: 0.035 },
  { type: 'UK 03', retailPerMinute: 0.015 },
  { type: 'International', retailPerMinute: 0, internationalMarkup: 1.30 },
];

// ── Add-ons ──
export const addonCatalogue: AddonCatalogueItem[] = [
  // ICUK-derived add-ons
  { id: 'addon-call-recording-12m', name: 'Call Recording 12m', wholesaleMonthly: 5.00, retailMonthly: 8.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'mic', description: 'Call recording with 12-month storage', source: 'icuk' },
  { id: 'addon-call-recording-24m', name: 'Call Recording 24m', wholesaleMonthly: 10.00, retailMonthly: 14.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'mic', description: 'Call recording with 24-month storage', source: 'icuk' },
  { id: 'addon-call-recording-36m', name: 'Call Recording 36m', wholesaleMonthly: 15.00, retailMonthly: 19.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'mic', description: 'Call recording with 36-month storage', source: 'icuk' },
  { id: 'addon-conference', name: 'Conference Calling', wholesaleMonthly: 5.00, retailMonthly: 9.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'users', description: 'Multi-party conference calling', source: 'icuk' },
  { id: 'addon-mobile-app', name: 'Mobile App', wholesaleMonthly: 1.00, retailMonthly: 1.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'smartphone', description: 'Softphone app for iOS/Android', source: 'icuk' },
  { id: 'addon-desktop-app', name: 'Desktop App', wholesaleMonthly: 1.50, retailMonthly: 2.95, retailOneOff: 0, serviceType: 'voice', productStatus: 'public', icon: 'monitor', description: 'Desktop softphone application', source: 'icuk' },

  // Existing website add-ons (no ICUK wholesale data)
  { id: 'addon-wifi-extender', name: 'WiFi Extender', wholesaleMonthly: 0, retailMonthly: 3.99, retailOneOff: 0, serviceType: 'broadband', productStatus: 'public', icon: 'wifi', description: 'Boost signal to every corner of your home', source: 'website_existing' },
  { id: 'addon-mesh-node', name: 'Mesh WiFi Node', wholesaleMonthly: 0, retailMonthly: 5.99, retailOneOff: 0, serviceType: 'broadband', productStatus: 'public', icon: 'router', description: 'Seamless whole-home coverage with mesh technology', source: 'website_existing' },
  { id: 'addon-static-ip', name: 'Static IP Address', wholesaleMonthly: 0, retailMonthly: 4.99, retailOneOff: 0, serviceType: 'broadband', productStatus: 'public', icon: 'server', description: 'Fixed IP for remote access, gaming servers & security cameras', source: 'website_existing' },
  { id: 'addon-security-suite', name: 'Norton Security Suite', wholesaleMonthly: 0, retailMonthly: 2.99, retailOneOff: 0, serviceType: 'broadband', productStatus: 'public', icon: 'shield', description: 'Complete online protection for all devices', source: 'website_existing' },
  { id: 'addon-parental-controls', name: 'Advanced Parental Controls', wholesaleMonthly: 0, retailMonthly: 1.99, retailOneOff: 0, serviceType: 'broadband', productStatus: 'public', icon: 'user-check', description: 'Keep your family safe online with content filtering', source: 'website_existing' },
  { id: 'addon-esim', name: 'eSIM', wholesaleMonthly: 0, retailMonthly: 0, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'smartphone', description: 'Digital SIM - no physical card needed, instant activation', source: 'website_existing' },
  { id: 'addon-physical-sim', name: 'Physical SIM', wholesaleMonthly: 0, retailMonthly: 0, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'credit-card', description: 'Traditional SIM card posted to your address', source: 'website_existing' },
  { id: 'addon-international-calls', name: 'International Calls Pack', wholesaleMonthly: 0, retailMonthly: 5.99, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'globe', description: '100 mins to 50+ countries including USA, India, Pakistan', source: 'website_existing' },
  { id: 'addon-roaming-pass', name: 'Global Roaming Pass', wholesaleMonthly: 0, retailMonthly: 7.99, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'plane', description: 'Use your allowance in 80+ destinations worldwide', source: 'website_existing' },
  { id: 'addon-data-boost', name: 'Data Boost 10GB', wholesaleMonthly: 0, retailMonthly: 4.99, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'zap', description: 'Extra 10GB data when you need it most', source: 'website_existing' },
  { id: 'addon-insurance', name: 'Device Insurance', wholesaleMonthly: 0, retailMonthly: 8.99, retailOneOff: 0, serviceType: 'sim', productStatus: 'public', icon: 'shield-check', description: 'Cover for loss, theft, and accidental damage', source: 'website_existing' },
  { id: 'addon-unlimited-uk-calls', name: 'Unlimited UK Calls', wholesaleMonthly: 0, retailMonthly: 3, retailOneOff: 0, serviceType: 'landline', productStatus: 'public', icon: 'phone-forwarded', description: 'Unlimited calls to UK landlines and mobiles, 24/7', source: 'website_existing' },
  { id: 'addon-intl-calls-pack', name: 'International Calls Pack', wholesaleMonthly: 0, retailMonthly: 5, retailOneOff: 0, serviceType: 'landline', productStatus: 'public', icon: 'globe', description: '300 mins to 50+ countries including USA, India, Pakistan', source: 'website_existing' },
  { id: 'addon-home-handset', name: 'Home Phone Handset', wholesaleMonthly: 0, retailMonthly: 0, retailOneOff: 29, serviceType: 'landline', productStatus: 'public', icon: 'smartphone', description: 'Cordless DECT handset delivered to your door', source: 'website_existing', oneTime: true },
];

// ── Bundles ──
export const bundleConfigs: BundleConfig[] = [
  { id: 'home-sweet-internet', name: 'Home Sweet Internet', discount: 2, requiredServices: ['broadband', 'landline'], eligibleBroadbandFamilies: ['all'], voiceType: 'home', voiceCount: 1, includesFreeBronzeNumber: true, stackable: false, addonDiscountRules: 'none' },
  { id: 'startup-pack', name: 'Startup Pack', discount: 3, requiredServices: ['broadband', 'voice'], eligibleBroadbandFamilies: ['all'], voiceType: 'business', voiceCount: 1, includesFreeBronzeNumber: false, stackable: false, addonDiscountRules: 'none' },
  { id: 'team-pack', name: 'Team Pack', discount: 7, requiredServices: ['broadband', 'voice'], eligibleBroadbandFamilies: ['all'], voiceType: 'business', voiceCount: 3, includesFreeBronzeNumber: false, stackable: false, addonDiscountRules: 'none' },
  { id: 'sip-saver', name: 'SIP Saver', discount: 3, requiredServices: ['broadband', 'sip'], eligibleBroadbandFamilies: ['all'], voiceType: 'sip', voiceCount: 1, includesFreeBronzeNumber: false, stackable: false, addonDiscountRules: 'none' },
];
