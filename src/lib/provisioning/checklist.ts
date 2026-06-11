import type { ReadinessStatus } from "./status";

export interface ChecklistInputs {
  pr: {
    id: string;
    status: string;
    webhook_verified: boolean;
    paid_at: string | null;
    contract_summary_id: string | null;
    quote_id: string | null;
    quote_request_id: string | null;
    user_id: string | null;
    customer_email: string | null;
    customer_name: string | null;
  } | null;
  cs: {
    id: string;
    status: string;
    pdf_storage_key: string | null;
    pdf_sha256: string | null;
    service_address: string | null;
    customer_email_snapshot: string | null;
  } | null;
  quote: {
    id: string;
    status: string;
    supplier_product_id: string | null;
  } | null;
  qr: { id: string; status: string } | null;
  profile: { id: string; account_number: string | null } | null;
  acceptance: { id: string } | null;
  readiness: {
    installation_confirmed: boolean;
    router_confirmed: boolean;
    internal_notes_reviewed: boolean;
    admin_review_complete: boolean;
  } | null;
  hasDraftPack: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  adminTickable?: boolean;
}

export function computeChecklist(i: ChecklistInputs): ChecklistItem[] {
  const pr = i.pr;
  const cs = i.cs;
  return [
    { key: "profile", label: "Customer profile exists", ok: !!i.profile },
    { key: "account", label: "Account number assigned", ok: !!i.profile?.account_number },
    { key: "qr_link", label: "Quote request linked", ok: !!i.qr },
    { key: "quote_accepted", label: "Final quote accepted (contract_summary_accepted)", ok: i.quote?.status === "contract_summary_accepted" },
    { key: "cs_accepted", label: "Contract Summary accepted", ok: cs?.status === "accepted" },
    { key: "cs_pdf", label: "Accepted CS PDF present (storage_key + sha256)", ok: !!cs?.pdf_storage_key && !!cs?.pdf_sha256 },
    { key: "acceptance_row", label: "Contract acceptance record exists", ok: !!i.acceptance },
    { key: "pr_exists", label: "Payment request exists", ok: !!pr },
    { key: "pr_paid", label: "Payment status = paid", ok: pr?.status === "paid" },
    { key: "pr_verified", label: "webhook_verified = true", ok: pr?.webhook_verified === true },
    { key: "pr_paid_at", label: "paid_at not null", ok: !!pr?.paid_at },
    { key: "supplier_product", label: "Supplier product assigned", ok: !!i.quote?.supplier_product_id },
    { key: "address", label: "Address/postcode confirmed", ok: !!cs?.service_address },
    { key: "contact", label: "Customer contact confirmed", ok: !!pr?.customer_email && !!pr?.customer_name },
    { key: "tick_install", label: "Installation/setup choice confirmed", ok: !!i.readiness?.installation_confirmed, adminTickable: true },
    { key: "tick_router", label: "Router choice confirmed", ok: !!i.readiness?.router_confirmed, adminTickable: true },
    { key: "tick_notes", label: "Internal admin notes reviewed", ok: !!i.readiness?.internal_notes_reviewed, adminTickable: true },
    { key: "tick_review", label: "Admin final review complete", ok: !!i.readiness?.admin_review_complete, adminTickable: true },
  ];
}

export function paymentVerified(i: ChecklistInputs): boolean {
  return (
    i.pr?.status === "paid" &&
    i.pr?.webhook_verified === true &&
    !!i.pr?.paid_at
  );
}

export function allTicksComplete(i: ChecklistInputs): boolean {
  const r = i.readiness;
  return !!(r && r.installation_confirmed && r.router_confirmed && r.internal_notes_reviewed && r.admin_review_complete);
}

export function deriveStatus(i: ChecklistInputs): ReadinessStatus {
  if (!paymentVerified(i)) return "awaiting_verified_payment";
  if (i.hasDraftPack) return "draft_order_pack_prepared";
  if (allTicksComplete(i)) return "admin_review_complete";
  return "payment_verified_ready_for_review";
}

export function canGenerateDraftPack(i: ChecklistInputs): boolean {
  // Hard gate (frontend mirror of DB trigger).
  return (
    paymentVerified(i) &&
    i.cs?.status === "accepted" &&
    !!i.cs?.pdf_storage_key &&
    !!i.cs?.pdf_sha256 &&
    !!i.acceptance &&
    i.quote?.status === "contract_summary_accepted" &&
    i.qr?.status === "contract_summary_accepted" &&
    allTicksComplete(i)
  );
}