import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a UK postcode for comparison
 * Removes spaces and converts to uppercase
 */
export function normalizePostcode(postcode: string): string {
  if (!postcode) return "";
  return postcode.replace(/\s+/g, "").toUpperCase();
}
