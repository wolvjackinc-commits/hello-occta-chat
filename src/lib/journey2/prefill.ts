/**
 * Journey 2 — address prefill from the homepage availability check.
 *
 * The availability context stores the checked postcode and (when the customer
 * picked their exact address) the selected address in sessionStorage. Reusing it
 * means the first ordering step is already filled in.
 */
const SESSION_KEY = "occta_availability";

export type AddressPrefill = {
  postcode: string;
  line1: string;
  line2: string;
  town: string;
  county: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function getAvailabilityPrefill(): AddressPrefill | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      postcode?: string;
      selectedAddress?: Record<string, unknown> | null;
    };
    const postcode = str(parsed?.postcode).toUpperCase();
    const a = parsed?.selectedAddress ?? null;
    if (!postcode && !a) return null;

    const premises = [str(a?.sub_premises), str(a?.premises_name)].filter(Boolean).join(", ");
    const street = [str(a?.thoroughfare_number), str(a?.thoroughfare_name)].filter(Boolean).join(" ");
    const line1 = premises && street ? premises : premises || street;
    const line2 = premises && street ? street : "";

    return {
      postcode: str(a?.postcode).toUpperCase() || postcode,
      line1,
      line2,
      town: str(a?.post_town) || str(a?.locality),
      county: str(a?.county),
    };
  } catch {
    return null;
  }
}
