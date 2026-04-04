import { getFromPrices, getRetailBroadbandCards, getRetailLandlineCard } from './pricing/engine';
import { calculateBundleDiscount as calcBundle } from './pricing/engine';
import { catalogueProducts } from './pricing/catalogue';
import type { ServiceFamily } from './pricing/types';

// Resolve cheapest eligible catalogue product ID for a set of IDs
function getCheapestEligibleId(eligibleIds: string[]): string | undefined {
  const eligible = catalogueProducts.filter(
    p => eligibleIds.includes(p.id) && p.productStatus === 'public' && p.wholesaleContractTerm === 1
  );
  if (eligible.length === 0) return undefined;
  eligible.sort((a, b) => a.retailMonthly - b.retailMonthly);
  return eligible[0].id;
}

export type ServiceType = 'broadband' | 'sim' | 'landline';

export interface Plan {
  id: string;
  name: string;
  price: string;
  priceNum: number;
  description: string;
  features: string[];
  popular: boolean;
  serviceType: ServiceType;
  requiresBroadband?: boolean;
  speed?: string;
  data?: string;
  callRate?: string;
  catalogueProductId?: string;
}

// ── Broadband plans derived from pricing engine ──
const bbCards = getRetailBroadbandCards();
export const broadbandPlans: Plan[] = bbCards.map(card => ({
  id: `broadband-${card.id}`,
  name: card.publicTitle,
  speed: String(card.maxSpeed),
  price: card.fromPrice,
  priceNum: card.fromPriceNum,
  description: card.tagline,
  features: card.publicFeatures,
  popular: card.popular,
  serviceType: 'broadband' as ServiceType,
}));

// ── SIM plans (no ICUK data — keep current prices) ──
export const simPlans: Plan[] = [
  {
    id: "sim-starter", name: "Starter", data: "5GB", price: "7.99", priceNum: 7.99,
    description: "For light users and second phones",
    features: ["5GB 5G data", "Unlimited UK calls", "Unlimited texts", "EU roaming included", "No contracts - cancel anytime", "Free SIM delivery"],
    popular: false, serviceType: "sim",
  },
  {
    id: "sim-essential", name: "Essential", data: "15GB", price: "11.99", priceNum: 11.99,
    description: "Perfect for everyday use",
    features: ["15GB 5G data", "Unlimited UK calls", "Unlimited texts", "EU roaming included", "No contracts - cancel anytime", "Data rollover"],
    popular: false, serviceType: "sim",
  },
  {
    id: "sim-plus", name: "Plus", data: "50GB", price: "17.99", priceNum: 17.99,
    description: "For the social media enthusiasts",
    features: ["50GB 5G data", "Unlimited UK calls", "Unlimited texts", "30GB EU roaming", "No contracts - cancel anytime", "Data rollover"],
    popular: true, serviceType: "sim",
  },
  {
    id: "sim-unlimited", name: "Unlimited", data: "∞", price: "27.99", priceNum: 27.99,
    description: "Never worry about data again",
    features: ["Unlimited 5G data", "Unlimited UK calls", "Unlimited texts", "50GB EU roaming", "No contracts - cancel anytime", "Free intl calls (50 countries)"],
    popular: false, serviceType: "sim",
  },
];

// ── Landline plan derived from pricing engine ──
const llCard = getRetailLandlineCard();
export const landlinePlans: Plan[] = [
  {
    id: "landline-digital-voice",
    name: llCard.publicTitle,
    price: llCard.fromPrice,
    priceNum: llCard.fromPriceNum,
    callRate: "Pay-as-you-go",
    description: llCard.tagline,
    requiresBroadband: true,
    features: llCard.publicFeatures,
    popular: llCard.popular,
    serviceType: "landline",
  },
];

export const allPlans = [...broadbandPlans, ...simPlans, ...landlinePlans];

export const getPlanById = (id: string): Plan | undefined => allPlans.find(plan => plan.id === id);

export const getPlansByService = (serviceType: ServiceType): Plan[] => {
  switch (serviceType) {
    case 'broadband': return broadbandPlans;
    case 'sim': return simPlans;
    case 'landline': return landlinePlans;
    default: return [];
  }
};

// Bundle discount — uses named bundle logic but returns same shape for backward compat
export const calculateBundleDiscount = (selectedPlans: Plan[]): {
  originalTotal: number;
  discountedTotal: number;
  discountPercentage: number;
  savings: number;
} => {
  const originalTotal = selectedPlans.reduce((sum, plan) => sum + plan.priceNum, 0);
  const uniqueServices = [...new Set(selectedPlans.map(p => p.serviceType))] as ServiceFamily[];
  const bundle = calcBundle(uniqueServices);

  const savings = bundle.valid ? bundle.discount : 0;
  const discountedTotal = originalTotal - savings;

  return {
    originalTotal,
    discountedTotal,
    discountPercentage: 0, // flat £ discount, not percentage
    savings,
  };
};
