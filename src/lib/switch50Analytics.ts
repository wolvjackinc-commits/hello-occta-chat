import { getConsent } from "@/lib/consent";
type Completed = { test_session?: boolean; order_number?: string | null; monthly_incl_vat: number; promotion?: { code: string; eligible: boolean } | null };
export function trackSwitch50(event: string, properties: Record<string, unknown> = {}) {
  if (getConsent() !== "granted" || typeof window.gtag !== "function") return false;
  window.gtag("event", event, { promotion_id: "SWITCH50", promotion_name: "£50 Switch Cash", ...properties });
  return true;
}
export function trackSwitch50Purchase(order: Completed) {
  if (order.test_session || !order.order_number || order.promotion?.code !== "SWITCH50" || !order.promotion.eligible) return;
  const key="occta.switch50.purchase."+order.order_number;
  try { if(sessionStorage.getItem(key)) return; } catch { return; }
  if(trackSwitch50("purchase", { transaction_id: order.order_number, currency: "GBP", value: order.monthly_incl_vat,
    items: [{ item_id: "essential_price_lock_24", item_name: "Essential Fibre Price Lock 24", quantity: 1 }] }))
    try { sessionStorage.setItem(key,"1"); } catch { /* next delivery retains the same transaction ID */ }
}
