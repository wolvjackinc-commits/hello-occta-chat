import type { Technology } from './types';
import { catalogueProducts } from './catalogue';
import { broadbandRetailCards } from './retailCards';

// ── Postcode availability (stub — returns all technologies) ──
export function checkPostcodeAvailability(_postcode: string): Technology[] {
  return ['FTTP', 'SOGEA', 'SOGFast', 'SOADSL'];
}

// ── Resolve the best catalogue product for a retail card ──
export function resolveCardProduct(cardId: string, availableTechs: Technology[]) {
  const card = broadbandRetailCards.find(c => c.id === cardId);
  if (!card) return null;

  const eligible = catalogueProducts
    .filter(p =>
      card.eligibleProductIds.includes(p.id) &&
      p.productStatus === 'public' &&
      p.wholesaleContractTerm === 1 &&
      availableTechs.includes(p.technology)
    )
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return eligible[0] ?? null;
}

// ── Get available cards with resolved products ──
export function getAvailableCards(postcode?: string) {
  const techs = postcode ? checkPostcodeAvailability(postcode) : (['FTTP', 'SOGEA', 'SOGFast', 'SOADSL'] as Technology[]);
  
  return broadbandRetailCards.map(card => {
    const product = resolveCardProduct(card.id, techs);
    return {
      ...card,
      resolvedProduct: product,
      resolvedPrice: product?.retailMonthly ?? null,
      available: product !== null,
    };
  });
}
