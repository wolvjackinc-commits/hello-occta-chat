import { supabase } from "@/integrations/supabase/client";
import { normaliseReferenceCode } from "@/lib/campaignAttribution";

/** Public origin used in partner links and QR codes. */
export const PARTNER_SITE_ORIGIN = "https://www.occta.co.uk";

/** Attribution stamped on the tenant landing page so the order journey records the partner. */
export const PARTNER_UTM = {
  utm_source: "partner",
  utm_medium: "letting_agent",
  utm_campaign: "lettings-partners",
} as const;

export type PartnerType = "letting_agent" | "landlord" | "other";
export type PartnerStatus = "active" | "paused" | "ended";

export type Partner = {
  id: string;
  code: string;
  display_name: string;
  partner_type: PartnerType;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  postcode: string | null;
  commission_amount: number;
  payout_note: string | null;
  status: PartnerStatus;
  notes: string | null;
  created_at: string;
};

export type CommissionStatus = "awaiting_payments" | "eligible" | "on_hold" | "not_eligible" | "paid";

export type PartnerReferral = {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  order_id: string;
  order_number: string | null;
  order_created_at: string;
  customer_id: string | null;
  plan_name: string | null;
  order_status: string | null;
  lifecycle_status: string | null;
  attributed_by: "link" | "typed_code";
  paid_invoices: number;
  in_arrears: boolean;
  cancelled: boolean;
  commission_amount: number;
  commission_status: CommissionStatus;
  status_reason: string;
  paid_on: string | null;
  bank_reference: string | null;
};

const STOP_WORDS = new Set([
  "LTD", "LIMITED", "LLP", "PLC", "AND", "THE", "OF", "CO", "COMPANY",
  "LETTINGS", "LETTING", "ESTATE", "ESTATES", "AGENTS", "AGENT", "PROPERTY", "PROPERTIES", "SALES", "HOMES",
]);

/**
 * Suggest a short, typeable partner code from a business name,
 * e.g. "Vanilla Lettings Ltd" -> "VANILLA", "Harvey & Ryall" -> "HARVEYRYALL".
 * Always satisfies the order form's reference-code rule (3–24 of A–Z, 0–9, -).
 */
export function suggestPartnerCode(name: string): string {
  const words = name
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  const base = (meaningful.length ? meaningful : words).join("").slice(0, 12);
  if (base.length >= 3) return base;
  return `${base}AGENT`.slice(0, 12).padEnd(3, "X");
}

/** Returns the normalised code, or null when it would be rejected by the order form. */
export function validPartnerCode(raw: string): string | null {
  return normaliseReferenceCode(raw);
}

/** Short link printed on flyers and QR codes. The landing page adds the tracking parameters. */
export function partnerShortUrl(code: string): string {
  return `${PARTNER_SITE_ORIGIN}/p/${encodeURIComponent(code)}`;
}

/** Query string the landing page applies so first-touch attribution records the partner. */
export function partnerAttributionSearch(code: string): string {
  const params = new URLSearchParams({ cc: code, ...PARTNER_UTM });
  return `?${params.toString()}`;
}

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  awaiting_payments: "Awaiting payments",
  eligible: "Ready to pay",
  on_hold: "On hold",
  not_eligible: "Not eligible",
  paid: "Paid",
};

export function summariseReferrals(rows: readonly PartnerReferral[]) {
  let due = 0;
  let paid = 0;
  let pending = 0;
  for (const r of rows) {
    const amount = Number(r.commission_amount) || 0;
    if (r.commission_status === "eligible") due += amount;
    else if (r.commission_status === "paid") paid += amount;
    else if (r.commission_status === "awaiting_payments" || r.commission_status === "on_hold") pending += amount;
  }
  return { referrals: rows.length, due, paid, pending };
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

/* ---------------- data access (tables are not in the generated types yet) ---------------- */

const partnersTable = () => supabase.from("partners" as never);

export async function listPartners(): Promise<Partner[]> {
  const { data, error } = await partnersTable()
    .select("id, code, display_name, partner_type, contact_name, contact_email, contact_phone, website, address, postcode, commission_amount, payout_note, status, notes, created_at")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Partner[]).map((p) => ({ ...p, commission_amount: Number(p.commission_amount) }));
}

export type PartnerInput = Omit<Partner, "id" | "created_at">;

export async function savePartner(input: PartnerInput, id?: string): Promise<void> {
  const row = {
    ...input,
    code: input.code.trim().toUpperCase(),
    display_name: input.display_name.trim(),
    contact_email: input.contact_email ? input.contact_email.trim().toLowerCase() : null,
  };
  const query = id ? partnersTable().update(row as never).eq("id", id) : partnersTable().insert(row as never);
  const { error } = await query;
  if (error) throw error;
}

export async function listPartnerReferrals(partnerId?: string): Promise<PartnerReferral[]> {
  const { data, error } = await supabase.rpc("admin_list_partner_referrals" as never, { p_partner_id: partnerId ?? null } as never);
  if (error) throw error;
  return ((data ?? []) as unknown as PartnerReferral[]).map((r) => ({
    ...r,
    commission_amount: Number(r.commission_amount),
    paid_invoices: Number(r.paid_invoices),
  }));
}

export async function recordPartnerPayout(orderId: string, paidOn: string, bankReference: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_record_partner_payout" as never, {
    p_order_id: orderId,
    p_paid_on: paidOn,
    p_bank_reference: bankReference,
    p_note: note ?? null,
  } as never);
  if (error) throw error;
}

export type PartnerLanding = { code: string; display_name: string; partner_type: PartnerType };

export async function getPartnerLanding(code: string): Promise<PartnerLanding | null> {
  const clean = validPartnerCode(code);
  if (!clean) return null;
  const { data, error } = await supabase.rpc("get_partner_landing" as never, { p_code: clean } as never);
  if (error) return null;
  const rows = (data ?? []) as unknown as PartnerLanding[];
  return rows[0] ?? null;
}

/** Turns a database error into something an admin can act on. */
export function partnerErrorMessage(error: unknown): string {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
  if (message.includes("partner_code_reserved_by_offer")) return "That code is already used by a promotion. Pick another.";
  if (message.includes("partners_code_key") || message.includes("duplicate key")) return "Another partner already uses that code.";
  if (message.includes("partner_code_locked_after_payout")) return "This partner has been paid, so its code can't change.";
  if (message.includes("not_eligible")) return `Not eligible yet: ${message.split("not_eligible:")[1]?.trim() ?? "check the referral status"}.`;
  if (message.includes("already_paid")) return "This referral has already been paid.";
  if (message.includes("payout_date_invalid")) return "The payment date can't be in the future.";
  if (message.includes("bank_reference_required")) return "Enter the bank transfer reference.";
  if (message.includes("forbidden")) return "You need admin access for this.";
  return message || "Something went wrong.";
}
