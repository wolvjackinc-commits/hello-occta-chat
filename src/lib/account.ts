/**
 * Account number utilities for OCCTA admin panel.
 * Account numbers follow the format: OCC + 8 digits (e.g., OCC21463892)
 */

/**
 * Normalize an account number to uppercase and trimmed format.
 */
export function normalizeAccountNumber(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

/**
 * Validate that an account number matches the OCC######## format.
 */
export function isAccountNumberValid(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeAccountNumber(value);
  return /^OCC\d{8}$/.test(normalized);
}

/**
 * Format an account number for display (ensures uppercase).
 */
export function formatAccountNumber(value: string | null | undefined): string {
  if (!value) return "—";
  return normalizeAccountNumber(value);
}

/**
 * Generate a random account number in the OCC######## format.
 * Note: This is for client-side preview only. Actual generation should happen in DB trigger.
 */
export function generateAccountNumber(): string {
  const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, "0");
  return `OCC${digits}`;
}
