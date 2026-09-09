/**
 * Journey 2 — lightweight prefill from the public broadband journey.
 *
 * The availability context stores the checked postcode and (when the customer
 * picked their exact address) the selected address in sessionStorage. Reusing it
 * means the first ordering step is already filled in. A clicked public speed
 * card is also carried into the plan step so "Choose plan" never silently loses
 * the customer's selection.
 */
const SESSION_KEY = "occta_availability";
const SPEED_KEY = "occta_preferred_speed_bucket";

export type AddressPrefill = {
  postcode: string;
  line1: string;
  line2: string;
  town: string;
  county: string;
};

export type PreferredSpeedBucket = "essential" | "superfast" | "ultrafast" | "gigabit";
const SPEED_BUCKETS: PreferredSpeedBucket[] = ["essential", "superfast", "ultrafast", "gigabit"];

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function setPreferredSpeedBucket(bucket: string): void {
  try {
    if ((SPEED_BUCKETS as string[]).includes(bucket)) sessionStorage.setItem(SPEED_KEY, bucket);
  } catch { /* storage is best-effort */ }
}

export function getPreferredSpeedBucket(): PreferredSpeedBucket | null {
  try {
    const value = sessionStorage.getItem(SPEED_KEY);
    return (SPEED_BUCKETS as string[]).includes(value ?? "") ? value as PreferredSpeedBucket : null;
  } catch {
    return null;
  }
}

export function clearPreferredSpeedBucket(): void {
  try { sessionStorage.removeItem(SPEED_KEY); } catch { /* storage is best-effort */ }
}

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
