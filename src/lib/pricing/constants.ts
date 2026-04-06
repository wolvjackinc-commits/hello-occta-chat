/**
 * Static pricing constants for build-time contexts (SSG, prerender)
 * that cannot import the dynamic engine.
 * 
 * These MUST match the output of getFromPrices() in engine.ts.
 * When catalogue prices change, update these too.
 */
export const SEO_PRICES = {
  broadband: '22.99',
  sim: '7.99',
  landline: '4.95',
} as const;
