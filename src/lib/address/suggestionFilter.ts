/**
 * Shared guard that keeps postcode-only, locality, town and route-only rows out
 * of the customer-selectable address list. Mirrors the server-side filter in
 * the places-autocomplete edge function (defence in depth).
 */

export const BANNED_SUGGESTION_TYPES = new Set([
  "postal_code",
  "postal_code_prefix",
  "postal_code_suffix",
  "postal_town",
  "locality",
  "sublocality",
  "neighborhood",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
  "political",
  "route",
  "intersection",
]);

export const PROPERTY_SUGGESTION_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "street_number",
  "establishment",
  "point_of_interest",
]);

const UK_POSTCODE_ONLY = /^[A-Z]{1,2}[0-9][0-9A-Z]?(\s?[0-9][A-Z]{2})?$/i;

export function normalisePostcode(value: string) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function samePostcode(a: string, b: string) {
  return normalisePostcode(a) === normalisePostcode(b);
}

export interface SuggestionLike {
  mainText?: string;
  fullText?: string;
  types?: string[];
}

/** True only when the suggestion can be an actual premise/street address. */
export function isSelectableAddressSuggestion(s: SuggestionLike): boolean {
  const types = Array.isArray(s.types) ? s.types : [];
  if (types.some((t) => BANNED_SUGGESTION_TYPES.has(t))) return false;

  const main = (s.mainText || s.fullText || "").trim();
  if (!main) return false;
  if (UK_POSTCODE_ONLY.test(main)) return false;

  if (types.length > 0) return types.some((t) => PROPERTY_SUGGESTION_TYPES.has(t));
  return /\d/.test(main);
}
