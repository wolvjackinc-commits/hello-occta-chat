import type { FromPrices, OrderSummary, ServiceFamily, VatMode } from './types';
import { catalogueProducts, voiceProducts, installScenarios, careLevels, bundleConfigs, addonCatalogue, portingOptions, numberTypes, smsTiers, callTariffs, GLOBAL_CEASE_FEE } from './catalogue';
import { broadbandRetailCards, landlineRetailCard, simRetailCards } from './retailCards';

// ── Resolve cheapest eligible product for a broadband card ──
function getCheapestForCard(eligibleIds: string[]): number | null {
  const eligible = catalogueProducts.filter(
    p => eligibleIds.includes(p.id) && (p.productStatus === 'public') && p.wholesaleContractTerm === 1
  );
  if (eligible.length === 0) return null;
  return Math.min(...eligible.map(p => p.retailMonthly));
}

// ── SIM prices (no ICUK data — hardcoded from current site) ──
const SIM_PRICES: Record<string, number> = {
  'sim-starter': 7.99,
  'sim-essential': 11.99,
  'sim-plus': 17.99,
  'sim-unlimited': 27.99,
};

// ── The ONE helper all UI reads from ──
export function getFromPrices(): FromPrices {
  // Broadband: cheapest across all public retail cards
  const bbPrices = broadbandRetailCards
    .map(c => getCheapestForCard(c.eligibleProductIds))
    .filter((p): p is number => p !== null);
  const bbMin = bbPrices.length > 0 ? Math.min(...bbPrices) : 26.95;

  // SIM: cheapest SIM card
  const simMin = Math.min(...Object.values(SIM_PRICES));

  // Landline: from voice catalogue
  const homePayg = voiceProducts.find(v => v.id === 'home-phone-payg');
  const llMin = homePayg?.retailMonthly ?? 4.95;

  return {
    broadband: bbMin.toFixed(2),
    sim: simMin.toFixed(2),
    landline: llMin.toFixed(2),
  };
}

// ── Retail broadband cards with resolved "from" prices ──
export function getRetailBroadbandCards() {
  return broadbandRetailCards.map(card => {
    const fromPrice = getCheapestForCard(card.eligibleProductIds);
    // Resolve speed from eligible products
    const eligible = catalogueProducts.filter(
      p => card.eligibleProductIds.includes(p.id) && p.productStatus === 'public' && p.wholesaleContractTerm === 1
    );
    const maxSpeed = eligible.length > 0 ? Math.max(...eligible.map(p => p.speedDown)) : 0;
    
    return {
      ...card,
      fromPrice: fromPrice?.toFixed(2) ?? '0.00',
      fromPriceNum: fromPrice ?? 0,
      maxSpeed,
    };
  });
}

// ── Retail landline card ──
export function getRetailLandlineCard() {
  const homePayg = voiceProducts.find(v => v.id === 'home-phone-payg');
  return {
    ...landlineRetailCard,
    fromPrice: homePayg?.retailMonthly.toFixed(2) ?? '4.95',
    fromPriceNum: homePayg?.retailMonthly ?? 4.95,
  };
}

// ── Setup charge ──
export function calculateSetupCharge(scenarioId: string): number {
  const scenario = installScenarios.find(s => s.id === scenarioId);
  return scenario?.retailCharge ?? 0;
}

// ── Care level uplift ──
export function calculateCareLevelUplift(levelId: string): number {
  const level = careLevels.find(l => l.id === levelId);
  return level?.monthlyUplift ?? 0;
}

// ── Bundle discount ──
export function calculateBundleDiscount(selectedServiceTypes: ServiceFamily[]): { discount: number; bundleName: string | null; valid: boolean } {
  const uniqueTypes = new Set(selectedServiceTypes);
  
  // Check each bundle config
  for (const bundle of bundleConfigs) {
    const allRequired = bundle.requiredServices.every(s => {
      if (s === 'voice') return uniqueTypes.has('voice') || uniqueTypes.has('landline');
      if (s === 'sip') return uniqueTypes.has('sip');
      return uniqueTypes.has(s);
    });
    if (allRequired) {
      return { discount: bundle.discount, bundleName: bundle.name, valid: true };
    }
  }
  
  return { discount: 0, bundleName: null, valid: false };
}

// ── Addon totals ──
export function calculateAddonTotal(addonIds: string[]): { monthly: number; oneOff: number } {
  let monthly = 0;
  let oneOff = 0;
  for (const id of addonIds) {
    const addon = addonCatalogue.find(a => a.id === id);
    if (addon) {
      monthly += addon.retailMonthly;
      oneOff += addon.retailOneOff;
    }
  }
  return { monthly, oneOff };
}

// ── Porting total ──
export function calculatePortingTotal(selections: { optionId: string; count: number }[]): number {
  let total = 0;
  for (const sel of selections) {
    const opt = portingOptions.find(p => p.id === sel.optionId);
    if (!opt) continue;
    if (opt.multiCap && sel.count > 1) {
      total += Math.min(opt.retailCharge * sel.count, opt.multiCap);
    } else {
      total += opt.retailCharge * sel.count;
    }
  }
  return total;
}

// ── Number total ──
export function calculateNumberTotal(selections: { typeId: string; count: number }[]): number {
  let total = 0;
  for (const sel of selections) {
    const nt = numberTypes.find(n => n.id === sel.typeId);
    if (nt) total += nt.retailMonthly * sel.count;
  }
  return total;
}

// ── SMS pricing ──
export function getSmsPricing(volume: number): number {
  const tier = smsTiers.find(t => volume >= t.minVolume && (t.maxVolume === null || volume <= t.maxVolume));
  return tier?.retailPerMessage ?? 0.06;
}

// ── Call rate ──
export function getCallRate(type: string): number {
  const tariff = callTariffs.find(t => t.type === type);
  return tariff?.retailPerMinute ?? 0;
}

// ── SOGEA fairness note ──
export function getSOGEANote(): string {
  return '30-day rolling. One-off setup applies. If service is ended within 12 months, upstream install subsidy conditions may affect internal costs.';
}

// ── Order summary builder ──
export function buildOrderSummary(params: {
  productId?: string;
  installScenarioId?: string;
  careLevelId?: string;
  addonIds?: string[];
  bundleServiceTypes?: ServiceFamily[];
  portingSelections?: { optionId: string; count: number }[];
  numberSelections?: { typeId: string; count: number }[];
}): OrderSummary {
  const product = catalogueProducts.find(p => p.id === params.productId);
  const monthlyBase = product?.retailMonthly ?? 0;
  const setupCharge = params.installScenarioId ? calculateSetupCharge(params.installScenarioId) : 0;
  const careUplift = params.careLevelId ? calculateCareLevelUplift(params.careLevelId) : 0;
  const addonTotals = params.addonIds ? calculateAddonTotal(params.addonIds) : { monthly: 0, oneOff: 0 };
  const bundle = params.bundleServiceTypes ? calculateBundleDiscount(params.bundleServiceTypes) : { discount: 0, bundleName: null, valid: false };
  const portingTotal = params.portingSelections ? calculatePortingTotal(params.portingSelections) : 0;
  const numberTotal = params.numberSelections ? calculateNumberTotal(params.numberSelections) : 0;

  const monthlySubtotal = monthlyBase + careUplift + addonTotals.monthly + numberTotal;
  const oneOffSubtotal = setupCharge + addonTotals.oneOff + portingTotal;

  const notes: string[] = [];
  if (product?.technology === 'SOGEA') {
    notes.push(getSOGEANote());
  }

  return {
    productSelected: params.productId ?? null,
    supplierMapping: product?.supplier ?? null,
    installScenario: params.installScenarioId ?? null,
    monthlySubtotal,
    oneOffSubtotal,
    bundleDiscount: bundle.discount,
    bundleName: bundle.bundleName,
    addons: (params.addonIds ?? []).map(id => {
      const a = addonCatalogue.find(x => x.id === id);
      return { id, monthly: a?.retailMonthly ?? 0, oneOff: a?.retailOneOff ?? 0 };
    }),
    portingCharges: portingTotal,
    numberCharges: numberTotal,
    notes,
    internalMarginSnapshot: {
      monthly: product ? product.marginMonthly : 0,
      oneOff: product ? product.marginOneOff : 0,
    },
    rollingMonthly: product?.wholesaleContractTerm === 1,
  };
}
