import { classifyEmailType, legalFormFromHint, normaliseEmail } from "../../../supabase/functions/_shared/outreach.ts";

export type ImportRow = {
  business_name: string;
  email: string;
  email_type?: string;
  category?: string;
  subcategory?: string;
  address?: string;
  postcode?: string;
  area?: string;
  district?: string;
  phone?: string;
  website?: string;
  legal_form?: string;
  companies_house_number?: string;
  companies_house_verified?: boolean;
  companies_house_match_basis?: string;
  priority?: string;
  source?: string;
  source_urls?: string;
  why_good_fit?: string;
};

const TRUE = new Set(["true", "yes", "y", "1"]);

/**
 * Map a CSV row (OCCTA lead-list columns or the simple template) to an import
 * row. Companies House verification is only accepted when a company number is
 * present AND the row says it was verified (or the lead list marked the
 * address as safe for cold B2B email).
 */
export function mapImportRow(o: Record<string, string>): ImportRow | null {
  const email = normaliseEmail(o.email ?? o.public_email ?? "");
  const business_name = (o.business_name ?? o.company ?? o.name ?? "").trim();
  if (!email || !business_name) return null;

  const legalRaw = (o.legal_form ?? "").trim().toLowerCase();
  const legal_form = legalRaw && /^[a-z_]+$/.test(legalRaw) ? legalRaw : legalFormFromHint(o.legal_form_hint);
  const chNumber = (o.companies_house_number ?? "").trim().toUpperCase();
  const validCh = /^(?:[0-9]{8}|[A-Z]{2}[0-9]{6})$/.test(chNumber) ? chNumber : "";
  const verifiedFlag = TRUE.has((o.companies_house_verified ?? "").trim().toLowerCase())
    || TRUE.has((o.email_ok_for_cold_b2b ?? "").trim().toLowerCase());

  const emailTypeRaw = (o.email_type ?? "").trim().toLowerCase();
  return {
    business_name,
    email,
    email_type: ["role", "personal"].includes(emailTypeRaw) ? emailTypeRaw : classifyEmailType(email),
    category: o.category || undefined,
    subcategory: o.subcategory || undefined,
    address: o.address || undefined,
    postcode: o.postcode || undefined,
    area: o.area || undefined,
    district: o.district || undefined,
    phone: o.phone || undefined,
    website: o.website || undefined,
    legal_form,
    companies_house_number: validCh || undefined,
    companies_house_verified: Boolean(validCh) && verifiedFlag,
    companies_house_match_basis: o.companies_house_match_basis || undefined,
    priority: ["A", "B", "C"].includes((o.priority ?? "").trim().toUpperCase()) ? o.priority.trim().toUpperCase() : undefined,
    source: o.source || o.email_source || "lead list import",
    source_urls: o.source_urls || o.sources || undefined,
    why_good_fit: o.why_good_fit || undefined,
  };
}
