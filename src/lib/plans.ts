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
  // Type-specific fields
  speed?: string;
  data?: string;
  callRate?: string;
}

// UK Market Reference Prices (2025):
// Broadband: Vodafone 150Mb ~£24/mo, BT Fibre ~£28/mo, Sky ~£27/mo, Virgin 362Mb ~£33/mo
// SIM Only: EE 5GB ~£10/mo, Vodafone 15GB ~£14/mo, Three Unlimited ~£30/mo
// Landline: BT Digital Voice ~£19-25/mo with calls

// Our prices are £1-2 cheaper than market average

export const broadbandPlans: Plan[] = [
  {
    id: "broadband-essential",
    name: "ESSENTIAL",
    speed: "36",
    price: "22.99",
    priceNum: 22.99,
    description: "Perfect for light browsing and the occasional Netflix binge",
    features: [
      "Up to 36Mbps download",
      "Unlimited usage",
      "Free router included",
      "No contracts - cancel anytime",
      "24/7 UK-based support",
      "Free installation",
    ],
    popular: false,
    serviceType: "broadband",
  },
  {
    id: "broadband-superfast",
    name: "SUPERFAST",
    speed: "150",
    price: "26.99",
    priceNum: 26.99,
    description: "For households that actually use the internet properly",
    features: [
      "Up to 150Mbps download",
      "Unlimited usage",
      "Premium router included",
      "No contracts - cancel anytime",
      "Priority 24/7 support",
      "Free installation",
    ],
    popular: true,
    serviceType: "broadband",
  },
  {
    id: "broadband-ultrafast",
    name: "ULTRAFAST",
    speed: "500",
    price: "38.99",
    priceNum: 38.99,
    description: "For gamers, streamers, and people who work from home",
    features: [
      "Up to 500Mbps download",
      "Unlimited usage",
      "WiFi 6 router included",
      "No contracts - cancel anytime",
      "Priority 24/7 support",
      "Free static IP included",
    ],
    popular: false,
    serviceType: "broadband",
  },
  {
    id: "broadband-gigabit",
    name: "GIGABIT",
    speed: "900",
    price: "52.99",
    priceNum: 52.99,
    description: "The fastest internet money can buy. Period.",
    features: [
      "Up to 900Mbps download",
      "Unlimited usage",
      "WiFi 6E mesh system",
      "No contracts - cancel anytime",
      "Dedicated support line",
      "Free static IP included",
    ],
    popular: false,
    serviceType: "broadband",
  },
];

export const simPlans: Plan[] = [
  {
    id: "sim-starter",
    name: "Starter",
    data: "5GB",
    price: "7.99",
    priceNum: 7.99,
    description: "For light users and second phones",
    features: [
      "5GB 5G data",
      "Unlimited UK calls",
      "Unlimited texts",
      "EU roaming included",
      "No contracts - cancel anytime",
      "Free SIM delivery",
    ],
    popular: false,
    serviceType: "sim",
  },
  {
    id: "sim-essential",
    name: "Essential",
    data: "15GB",
    price: "11.99",
    priceNum: 11.99,
    description: "Perfect for everyday use",
    features: [
      "15GB 5G data",
      "Unlimited UK calls",
      "Unlimited texts",
      "EU roaming included",
      "No contracts - cancel anytime",
      "Data rollover",
    ],
    popular: false,
    serviceType: "sim",
  },
  {
    id: "sim-plus",
    name: "Plus",
    data: "50GB",
    price: "17.99",
    priceNum: 17.99,
    description: "For the social media enthusiasts",
    features: [
      "50GB 5G data",
      "Unlimited UK calls",
      "Unlimited texts",
      "30GB EU roaming",
      "No contracts - cancel anytime",
      "Data rollover",
    ],
    popular: true,
    serviceType: "sim",
  },
  {
    id: "sim-unlimited",
    name: "Unlimited",
    data: "∞",
    price: "27.99",
    priceNum: 27.99,
    description: "Never worry about data again",
    features: [
      "Unlimited 5G data",
      "Unlimited UK calls",
      "Unlimited texts",
      "50GB EU roaming",
      "No contracts - cancel anytime",
      "Free intl calls (50 countries)",
    ],
    popular: false,
    serviceType: "sim",
  },
];

export const landlinePlans: Plan[] = [
  {
    id: "landline-payg",
    name: "Pay As You Go",
    price: "7.99",
    priceNum: 7.99,
    callRate: "8p/min",
    description: "For occasional callers",
    features: [
      "Line rental included",
      "8p per minute UK calls",
      "Caller display",
      "Free voicemail",
      "No contracts - cancel anytime",
      "24/7 UK support",
    ],
    popular: false,
    serviceType: "landline",
  },
  {
    id: "landline-evenings",
    name: "Evening & Weekend",
    price: "12.99",
    priceNum: 12.99,
    callRate: "Free evenings",
    description: "Perfect for chatting after work",
    features: [
      "Free UK calls 7pm-7am",
      "Free weekend calls",
      "Caller display",
      "Free voicemail",
      "No contracts - cancel anytime",
      "Anonymous call reject",
    ],
    popular: false,
    serviceType: "landline",
  },
  {
    id: "landline-anytime",
    name: "Anytime",
    price: "17.99",
    priceNum: 17.99,
    callRate: "Always free",
    description: "Unlimited calls, any time",
    features: [
      "Unlimited UK calls 24/7",
      "Caller display",
      "Free voicemail",
      "Call waiting",
      "No contracts - cancel anytime",
      "Anonymous call reject",
    ],
    popular: true,
    serviceType: "landline",
  },
  {
    id: "landline-international",
    name: "International",
    price: "26.99",
    priceNum: 26.99,
    callRate: "Worldwide",
    description: "For family abroad",
    features: [
      "Unlimited UK calls 24/7",
      "300 mins to 50+ countries",
      "Caller display",
      "Free voicemail",
      "No contracts - cancel anytime",
      "Priority fault repair",
    ],
    popular: false,
    serviceType: "landline",
  },
];

export const allPlans = [...broadbandPlans, ...simPlans, ...landlinePlans];

export const getPlanById = (id: string): Plan | undefined => {
  return allPlans.find(plan => plan.id === id);
};

export const getPlansByService = (serviceType: ServiceType): Plan[] => {
  switch (serviceType) {
    case 'broadband':
      return broadbandPlans;
    case 'sim':
      return simPlans;
    case 'landline':
      return landlinePlans;
    default:
      return [];
  }
};

// Bundle discount logic
// 2 services: 10% off total
// 3 services: 15% off total
export const calculateBundleDiscount = (selectedPlans: Plan[]): { 
  originalTotal: number; 
  discountedTotal: number; 
  discountPercentage: number;
  savings: number;
} => {
  const originalTotal = selectedPlans.reduce((sum, plan) => sum + plan.priceNum, 0);
  
  const uniqueServices = new Set(selectedPlans.map(p => p.serviceType));
  let discountPercentage = 0;
  
  if (uniqueServices.size >= 3) {
    discountPercentage = 15;
  } else if (uniqueServices.size === 2) {
    discountPercentage = 10;
  }
  
  const savings = originalTotal * (discountPercentage / 100);
  const discountedTotal = originalTotal - savings;
  
  return {
    originalTotal,
    discountedTotal,
    discountPercentage,
    savings,
  };
};
