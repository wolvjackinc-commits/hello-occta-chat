/**
 * Fair Broadband Pricing — client-safe constants and types.
 *
 * IMPORTANT: This file holds DEFAULT display values used only when the
 * server-side resolver is unavailable. The authoritative numbers come from
 * `platform_settings.fair_pricing` via the `resolve-build-plan-price` edge
 * function. Never run margin / supplier-cost maths in the browser.
 */

export type SpeedBucket = 'essential' | 'superfast' | 'ultrafast' | 'gigabit';
export type PlanTerm = 'price_lock_24' | 'flex_30';
export type RouterChoice = 'own' | 'standard' | 'premium' | 'business';
export type RouterPaymentType = 'none' | 'one_off' | 'monthly';
export type SetupChoice = 'remote' | 'standard' | 'engineer' | 'complex';

export interface AddonChoice {
  id: 'priority_support' | 'static_ip' | 'digital_voice' | 'paper_billing';
  enabled: boolean;
}

/** Defaults shown before the server resolver responds. */
export const FAIR_PRICING_DEFAULTS = {
  headline: {
    essential: { lock24: 29.99, flex30: 32.99 },
    superfast: { lock24: 34.99, flex30: 37.99 },
    ultrafast: { lock24: 39.99, flex30: 44.99 },
    gigabit:   { lock24: 44.99, flex30: 49.99 },
  },
  router: {
    standardOneOff: 79.99, standardMonthly: 4.99,
    premiumOneOff: 129.99, premiumMonthly: 7.99,
  },
  setup: { remote: 0, standard: 49.99, engineer: 99.99 },
  addons: {
    priorityMonthly: 6.99,
    staticIpMonthly: 5.00,
    digitalVoiceMonthly: 5.99,
    paperBillingMonthly: 2.50,
  },
} as const;

export const SPEED_BUCKET_META: Record<SpeedBucket, {
  title: string;
  speedRange: string;
  tagline: string;
  badges: string[];
}> = {
  essential: {
    title: 'Essential Fibre',
    speedRange: 'Up to 80Mbps',
    tagline: 'Reliable everyday broadband for browsing, email and streaming.',
    badges: [
      'Price Lock 24 available',
      'Flex 30 rolling available',
      'Bring your own router for £0',
      'Router options at checkout',
      'Setup from £0 where available',
      'Final price confirmed before order',
    ],
  },
  superfast: {
    title: 'Superfast Fibre',
    speedRange: '150–330Mbps options',
    tagline: 'Great for streaming, home working and busy households.',
    badges: [
      'Price Lock or Flex 30',
      'No forced router bundle',
      'First bill preview',
      'Optional priority support',
      'Final price confirmed before order',
    ],
  },
  ultrafast: {
    title: 'Ultrafast Fibre',
    speedRange: '500Mbps–1Gbps where available',
    tagline: 'Built for busy homes and businesses that need headroom.',
    badges: [
      'Bring your own router or add premium WiFi',
      'Gigabit options where available',
      'Static IP available on selected services',
      'Clear setup and add-on pricing',
      'Final price confirmed before order',
    ],
  },
  gigabit: {
    title: 'Gigabit Fibre',
    speedRange: 'Up to 1Gbps where available',
    tagline: 'Top-tier full fibre for large households and small businesses.',
    badges: [
      'Gigabit speeds where available',
      'Static IP available',
      'Bring your own router for £0',
      'Final price confirmed before order',
    ],
  },
};

export const PRICE_LOCK_WORDING =
  'Your monthly broadband price stays the same for the agreed Price Lock term. Optional add-ons, usage charges, services added later, or charges outside the Price Lock scope may change only where shown or agreed.';

export const FLEX_30_WORDING =
  '30-day rolling broadband where available. If your monthly broadband price needs to change, we tell you first and you can leave before the change.';

export const FROM_PRICE_DISCLOSURE =
  'From prices depend on address availability, selected plan type, router choice, setup type and margin-safe availability. Final charges are confirmed before order.';

export const FIRST_BILL_PROMISE =
  'If it is not shown in your Contract Summary, we do not add it without your agreement.';
