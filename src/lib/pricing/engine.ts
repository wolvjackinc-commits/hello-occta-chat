import type { FromPrices, OrderSummary, ServiceFamily, VatMode } from './types';
import { catalogueProducts, voiceProducts, installScenarios, careLevels, bundleConfigs, addonCatalogue, portingOptions, numberTypes, smsTiers, callTariffs, GLOBAL_CEASE_FEE } from './catalogue';
import { broadbandRetailCards, landlineRetailCard } from './retailCards';
import { FAIR_PRICING_DEFAULTS, PUBLIC_SPEED_BUCKETS } from './fairPricing';

// ── Fair Pricing display map (Price Lock 24 / Flex 30) ──
// This is the public source of truth for "from" prices on cards.
// The server-side resolver remains authoritative for the final price.
// Four public bands: Essential, Superfast, Ultrafast and Gigabit.
const FAIR_DISPLAY: Record<string, { lock24: number; flex30: number; speedLabel: string }> = {
  essential: { lock24: FAIR_PRICING_DEFAULTS.headline.essential.lock24, flex30: FAIR_PRICING_DEFAULTS.headline.essential.flex30, speedLabel: 'Up to 80Mbps' },
  superfast: { lock24: FAIR_PRICING_DEFAULTS.headline.superfast.lock24, flex30: FAIR_PRICING_DEFAULTS.headline.superfast.flex30, speedLabel: 'Up to 330Mbps' },
  ultrafast: { lock24: FAIR_PRICING_DEFAULTS.headline.ultrafast.lock24, flex30: FAIR_PRICING_DEFAULTS.headline.ultrafast.flex30, speedLabel: 'Up to 550Mbps' },
  gigabit: { lock24: FAIR_PRICING_DEFAULTS.headline.gigabit.lock24, flex30: FAIR_PRICING_DEFAULTS.headline.gigabit.flex30, speedLabel: 'Up to 1000Mbps' },
};

// ── Resolve cheapest eligible product for a broadband card ──
function getCheapestForCard(eligibleIds: string[]): number | null {
  const eligible = catalogueProducts.filter(
    p => eligibleIds.includes(p.id) && (p.productStatus === 'public') && p.wholesaleContractTerm === 1
  );
  if (eligible.length === 0) return null;
  return Math.min(...eligible.map(p => p.retailMonthly));
}

// ── SIM fallback price ──────────────────────────────────────────────────────
// The live /sim journey reads sim_plans_public. This value is only a generic
// fallback for legacy "from" surfaces that cannot query the live catalogue.
// Keep it aligned to the lowest active consumer SIM-only headline price.
const SIM_FROM_FALLBACK = 12.00;

// ── The ONE helper all UI reads from ──
export function getFromPrices(): FromPrices {
  // Broadband: cheapest Price Lock 24 across Fair Pricing buckets (Essential = £34.99).
  const bbMin = Math.min(...Object.values(FAIR_DISPLAY).map(v => v.lock24));

  // SIM: live catalogue is authoritative; generic surfaces use this fallback.
  const simMin = SIM_FROM_FALLBACK;

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
  return broadbandRetailCards
    .filter(card => (PUBLIC_SPEED_BUCKETS as readonly string[]).includes(card.id))
    .map(card => {
    const fair = FAIR_DISPLAY[card.id];
    const fromPrice = fair?.lock24 ?? getCheapestForCard(card.eligibleProductIds) ?? 0;
    const flex30Price = fair?.flex30 ?? null;
    // Resolve speed from eligible products
    const eligible = catalogueProducts.filter(
      p => card.eligibleProductIds.includes(p.id) && p.productStatus === 'public' && p.wholesaleContractTerm === 1
    );
    const maxSpeed = eligible.length > 0 ? Math.max(...eligible.map(p => p.speedDown)) : 0;
    
    return {
      ...card,
      fromPrice: fromPrice.toFixed(2),
      fromPriceNum: fromPrice,
      flex30Price: flex30Price !== null ? flex30Price.toFixed(2) : null,
      flex30PriceNum: flex30Price,
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

// ── VAT utilities ──
export const VAT_RATE = 0.20;

export function applyVAT(amount: number, inclusive: boolean): number {
  // Residential prices already include VAT; business prices are net
  if (inclusive) return amount;
  return amount / (1 + VAT_RATE); // Strip VAT to show net
}

export function formatPriceWithVAT(amount: number, mode: VatMode): string {
  const suffix = mode === 'residential' ? '(inc. VAT)' : '(ex. VAT)';
  const displayed = mode === 'residential' ? amount : amount / (1 + VAT_RATE);
  return `£${displayed.toFixed(2)} ${suffix}`;
}

// ── Proration ──
export const PRORATION_ENABLED = true;

export function calculateProration(monthlyAmount: number, activationDate: Date, billingCycleDay: number): number {
  const daysInMonth = new Date(activationDate.getFullYear(), activationDate.getMonth() + 1, 0).getDate();
  const activationDay = activationDate.getDate();
  let remainingDays: number;
  if (activationDay <= billingCycleDay) {
    remainingDays = billingCycleDay - activationDay;
  } else {
    remainingDays = daysInMonth - activationDay + billingCycleDay;
  }
  return Math.round(((monthlyAmount / daysInMonth) * remainingDays) * 100) / 100;
}

// ── SOGEA fairness note ──
export function getSOGEANote(): string {
  return 'Setup may apply. If the service is ended or migrated, a separately valid network cease/migration charge may apply only where lawful, actually incurred and disclosed in the accepted terms.';
}

// ── Consent labels ──
const ORDER_CONSENT_LABELS = [
  'I understand the plan term and notice period shown in my order and Contract Summary',
  'I understand setup, equipment and any applicable network charges shown before acceptance',
  'I accept the charges shown for this order',
  'Service is subject to final availability at my address',
];

// ── Order summary builder ──
export function buildOrderSummary(params: {
  productId?: string;
  installScenarioId?: string;
  careLevelId?: string;
  addonIds?: string[];
  bundleServiceTypes?: ServiceFamily[];
  portingSelections?: { optionId: string; count: number }[];
  numberSelections?: { typeId: string; count: number }[];
  vatMode?: VatMode;
}): OrderSummary {
  const product = catalogueProducts.find(p => p.id === params.productId);
  const monthlyBase = product?.retailMonthly ?? 0;
  const setupCharge = params.installScenarioId ? calculateSetupCharge(params.installScenarioId) : 0;
  const careUplift = params.careLevelId ? calculateCareLevelUplift(params.careLevelId) : 0;
  const addonTotals = params.addonIds ? calculateAddonTotal(params.addonIds) : { monthly: 0, oneOff: 0 };
  const bundle = params.bundleServiceTypes ? calculateBundleDiscount(params.bundleServiceTypes) : { discount: 0, bundleName: null, valid: false };
  const portingTotal = params.portingSelections ? calculatePortingTotal(params.portingSelections) : 0;
  const numberTotal = params.numberSelections ? calculateNumberTotal(params.numberSelections) : 0;
  const vatMode = params.vatMode ?? 'residential';

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
    vatMode,
    hardwareCharges: [], // Hardware included in addons if applicable
    consentRequired: ORDER_CONSENT_LABELS,
  };
}
