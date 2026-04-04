import { ServiceType } from './plans';
import { addonCatalogue } from './pricing/catalogue';

export interface Addon {
  id: string;
  name: string;
  price: number;
  description: string;
  serviceType: ServiceType;
  icon: string;
  oneTime?: boolean;
}

function mapAddons(svcType: string): Addon[] {
  return addonCatalogue
    .filter(a => a.serviceType === svcType && a.productStatus === 'public')
    .map(a => ({
      id: a.id,
      name: a.name,
      price: a.oneTime ? a.retailOneOff : a.retailMonthly,
      description: a.description,
      serviceType: svcType as ServiceType,
      icon: a.icon,
      oneTime: a.oneTime,
    }));
}

export const broadbandAddons: Addon[] = mapAddons('broadband');
export const simAddons: Addon[] = mapAddons('sim');
export const landlineAddons: Addon[] = mapAddons('landline');

export const getAddonsByService = (serviceType: ServiceType): Addon[] => {
  switch (serviceType) {
    case 'broadband': return broadbandAddons;
    case 'sim': return simAddons;
    case 'landline': return landlineAddons;
    default: return [];
  }
};

export const getAddonById = (id: string): Addon | undefined => {
  return [...broadbandAddons, ...simAddons, ...landlineAddons].find(addon => addon.id === id);
};

// UK Major Telecom Providers
export const ukProviders = [
  'BT', 'Sky', 'Virgin Media', 'TalkTalk', 'EE', 'Vodafone', 'Three',
  'Plusnet', 'NOW Broadband', 'Hyperoptic', 'Community Fibre', 'Zen Internet',
  'Shell Energy', 'O2', 'Utility Warehouse', 'KCOM', 'John Lewis Broadband',
  'Post Office Broadband', 'SSE Energy', 'Other', 'None (New Connection)',
];
