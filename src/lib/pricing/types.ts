// ── Pricing Engine Types ──

export type ProductStatus = 'public' | 'internal_only' | 'quote_only' | 'disabled';
export type CustomerType = 'residential' | 'business' | 'both';
export type Technology = 'SOGEA' | 'FTTP' | 'SOGFast' | 'SOADSL' | 'PSTN' | 'ISDN2' | 'ISDN30' | 'CPS';
export type VoiceType = 'home' | 'business' | 'sip';
export type VoiceVariant = 'payg' | 'bundle';
export type ServiceFamily = 'broadband' | 'sim' | 'landline' | 'voice' | 'sip';
export type ProductSource = 'icuk' | 'website_existing';

export interface CatalogueProduct {
  id: string;
  slug: string;
  name: string;
  supplier: string; // internal only — never rendered publicly
  technology: Technology;
  speedDown: number;
  speedUp: number;
  wholesaleMonthly: number;
  retailMonthly: number;
  wholesaleContractTerm: 1 | 12 | 18;
  retailContractLabel: string;
  productStatus: ProductStatus;
  customerType: CustomerType;
  networkType: string;
  installTypeSupported: string[];
  freeInstallEligible: boolean;
  rebateClawbackMonths: number;
  ceaseFee: number;
  priorityScore: number;
  marginMonthly: number;
  marginOneOff: number;
  visibility: ProductStatus;
  notes: string;
  disclaimers: string;
  source: ProductSource;
}

export interface RetailCardDef {
  id: string;
  publicTitle: string;
  category: string;
  tagline: string;
  description: string;
  features: string[];
  speedLabel: string;
  eligibleProductIds: string[];
  popular: boolean;
  serviceType: ServiceFamily;
  publicPricePrefix: string;
  publicSetupText: string;
  publicTagline: string;
  publicFeatures: string[];
  publicDisclaimer: string;
}

export interface InstallScenario {
  id: string;
  label: string;
  retailCharge: number;
  wholesaleCharge: number;
  rebateAmount: number;
  effectiveCost: number;
}

export interface CareLevelConfig {
  id: string;
  label: string;
  monthlyUplift: number;
  internalSLA: string;
}

export interface VoiceCatalogueProduct {
  id: string;
  name: string;
  type: VoiceType;
  variant: VoiceVariant;
  wholesaleMonthly: number;
  retailMonthly: number;
  minutesIncluded: number | null;
  productStatus: ProductStatus;
  customerType: CustomerType;
  source: ProductSource;
}

export interface NumberType {
  id: string;
  tier: string;
  wholesaleMonthly: number;
  retailMonthly: number;
}

export interface PortingOption {
  id: string;
  type: string;
  wholesaleCharge: number;
  retailCharge: number;
  multiCap?: number;
}

export interface SmsTier {
  minVolume: number;
  maxVolume: number | null;
  retailPerMessage: number;
  internationalFormula: string;
}

export interface CallTariff {
  type: string;
  retailPerMinute: number;
  internationalMarkup?: number;
}

export interface AddonCatalogueItem {
  id: string;
  name: string;
  wholesaleMonthly: number;
  retailMonthly: number;
  retailOneOff: number;
  serviceType: ServiceFamily;
  productStatus: ProductStatus;
  icon: string;
  description: string;
  source: ProductSource;
  oneTime?: boolean;
}

export interface BundleConfig {
  id: string;
  name: string;
  discount: number;
  requiredServices: ServiceFamily[];
  eligibleBroadbandFamilies: string[];
  voiceType: VoiceType | null;
  voiceCount: number;
  includesFreeBronzeNumber: boolean;
  stackable: boolean;
  addonDiscountRules: string;
}

export type VatMode = 'residential' | 'business';

export interface OrderSummary {
  productSelected: string | null;
  supplierMapping: string | null;
  installScenario: string | null;
  monthlySubtotal: number;
  oneOffSubtotal: number;
  bundleDiscount: number;
  bundleName: string | null;
  addons: { id: string; monthly: number; oneOff: number }[];
  portingCharges: number;
  numberCharges: number;
  notes: string[];
  internalMarginSnapshot: { monthly: number; oneOff: number };
  rollingMonthly: boolean;
  vatMode: VatMode;
  hardwareCharges: { name: string; amount: number }[];
  consentRequired: string[];
}

export interface FromPrices {
  broadband: string;
  sim: string;
  landline: string;
}
