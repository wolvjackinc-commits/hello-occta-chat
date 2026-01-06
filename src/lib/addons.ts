import { ServiceType } from './plans';

export interface Addon {
  id: string;
  name: string;
  price: number;
  description: string;
  serviceType: ServiceType;
  icon: string;
}

export const broadbandAddons: Addon[] = [
  {
    id: 'addon-wifi-extender',
    name: 'WiFi Extender',
    price: 3.99,
    description: 'Boost signal to every corner of your home',
    serviceType: 'broadband',
    icon: 'wifi',
  },
  {
    id: 'addon-mesh-node',
    name: 'Mesh WiFi Node',
    price: 5.99,
    description: 'Seamless whole-home coverage with mesh technology',
    serviceType: 'broadband',
    icon: 'router',
  },
  {
    id: 'addon-static-ip',
    name: 'Static IP Address',
    price: 4.99,
    description: 'Fixed IP for remote access, gaming servers & security cameras',
    serviceType: 'broadband',
    icon: 'server',
  },
  {
    id: 'addon-security-suite',
    name: 'Norton Security Suite',
    price: 2.99,
    description: 'Complete online protection for all devices',
    serviceType: 'broadband',
    icon: 'shield',
  },
  {
    id: 'addon-parental-controls',
    name: 'Advanced Parental Controls',
    price: 1.99,
    description: 'Keep your family safe online with content filtering',
    serviceType: 'broadband',
    icon: 'user-check',
  },
];

export const simAddons: Addon[] = [
  {
    id: 'addon-esim',
    name: 'eSIM',
    price: 0,
    description: 'Digital SIM - no physical card needed, instant activation',
    serviceType: 'sim',
    icon: 'smartphone',
  },
  {
    id: 'addon-physical-sim',
    name: 'Physical SIM',
    price: 0,
    description: 'Traditional SIM card posted to your address',
    serviceType: 'sim',
    icon: 'credit-card',
  },
  {
    id: 'addon-international-calls',
    name: 'International Calls Pack',
    price: 5.99,
    description: '100 mins to 50+ countries including USA, India, Pakistan',
    serviceType: 'sim',
    icon: 'globe',
  },
  {
    id: 'addon-roaming-pass',
    name: 'Global Roaming Pass',
    price: 7.99,
    description: 'Use your allowance in 80+ destinations worldwide',
    serviceType: 'sim',
    icon: 'plane',
  },
  {
    id: 'addon-data-boost',
    name: 'Data Boost 10GB',
    price: 4.99,
    description: 'Extra 10GB data when you need it most',
    serviceType: 'sim',
    icon: 'zap',
  },
  {
    id: 'addon-insurance',
    name: 'Device Insurance',
    price: 8.99,
    description: 'Cover for loss, theft, and accidental damage',
    serviceType: 'sim',
    icon: 'shield-check',
  },
];

export const landlineAddons: Addon[] = [
  {
    id: 'addon-intl-calls-100',
    name: 'International 100',
    price: 4.99,
    description: '100 mins to 30 countries including Europe & USA',
    serviceType: 'landline',
    icon: 'globe',
  },
  {
    id: 'addon-intl-calls-300',
    name: 'International 300',
    price: 8.99,
    description: '300 mins to 50+ countries including India & Pakistan',
    serviceType: 'landline',
    icon: 'globe-2',
  },
  {
    id: 'addon-call-barring',
    name: 'Premium Call Barring',
    price: 0,
    description: 'Block expensive premium rate numbers',
    serviceType: 'landline',
    icon: 'ban',
  },
  {
    id: 'addon-call-divert',
    name: 'Call Divert',
    price: 1.99,
    description: 'Forward calls to your mobile when you\'re away',
    serviceType: 'landline',
    icon: 'phone-forwarded',
  },
  {
    id: 'addon-1571-plus',
    name: '1571 Plus Voicemail',
    price: 1.49,
    description: 'Extended voicemail with email notifications',
    serviceType: 'landline',
    icon: 'voicemail',
  },
  {
    id: 'addon-caller-display',
    name: 'Caller Display',
    price: 0,
    description: 'See who\'s calling before you answer',
    serviceType: 'landline',
    icon: 'user',
  },
];

export const getAddonsByService = (serviceType: ServiceType): Addon[] => {
  switch (serviceType) {
    case 'broadband':
      return broadbandAddons;
    case 'sim':
      return simAddons;
    case 'landline':
      return landlineAddons;
    default:
      return [];
  }
};

export const getAddonById = (id: string): Addon | undefined => {
  return [...broadbandAddons, ...simAddons, ...landlineAddons].find(addon => addon.id === id);
};

// UK Major Telecom Providers
export const ukProviders = [
  'BT',
  'Sky',
  'Virgin Media',
  'TalkTalk',
  'EE',
  'Vodafone',
  'Three',
  'Plusnet',
  'NOW Broadband',
  'Hyperoptic',
  'Community Fibre',
  'Zen Internet',
  'Shell Energy',
  'O2',
  'Utility Warehouse',
  'KCOM',
  'John Lewis Broadband',
  'Post Office Broadband',
  'SSE Energy',
  'Other',
  'None (New Connection)',
];
