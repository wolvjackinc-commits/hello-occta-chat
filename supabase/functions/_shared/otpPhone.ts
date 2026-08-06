/**
 * Pure UK mobile normalisation/masking helpers for contract SMS OTP.
 * No Deno APIs here so the same code is unit-testable from vitest.
 */
export function normaliseUkMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  if (d.startsWith("7") && d.length === 10) d = "44" + d;
  if (!/^447[1-9]\d{8}$/.test(d)) return null;
  return d;
}

export function maskMobile(normalised: string): string {
  return "******" + normalised.slice(-4);
}
