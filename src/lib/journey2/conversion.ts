import type { Catalogue, PlanTerm, PriceSnapshot } from "./client";

export function comparisonTerm(plan: Catalogue["plans"][number], requested: PlanTerm): PlanTerm | undefined {
  return plan.terms[requested] ? requested : plan.terms.price_lock_24 ? "price_lock_24" : plan.terms.flex_30 ? "flex_30" : undefined;
}

export function planSavings(flex?: number, lock?: number) {
  if (flex == null || lock == null || !Number.isFinite(flex) || !Number.isFinite(lock)) return null;
  const monthly = Math.round(flex * 100) - Math.round(lock * 100);
  return monthly > 0 ? { monthly: monthly / 100, over24Months: monthly * 24 / 100 } : null;
}

export function oneOffTotal(price: PriceSnapshot): number {
  return price.one_off_total_incl_vat ?? (price.setup?.oneOff ?? 0) + (price.router?.oneOff ?? 0);
}

export function contactError(field: string, value: string): string | null {
  if (field === "name" && value.trim().length < 2) return "Enter your full name.";
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) return "Enter a valid email address, like you@example.com.";
  if (field === "phone" && value.replace(/\D/g, "").length < 10) return "Enter a phone number with at least 10 digits.";
  return null;
}
