import { getCronSecret, isCronSecret } from "../_shared/cronSecret.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  itemiseInvoice,
  buildInvoicePdfBytes,
  customerPdfExtras,
  DD_MANDATE_PDF_COLUMNS,
  mandatePdfExtras,
  poundsToMinor,
  PROFILE_PDF_COLUMNS,
  sha256Hex,
  vatRatePercent,
  type RawLine,
  type VatMode,
} from "../_shared/billingHelpers.ts";
import { splitStoredDescription } from "../_shared/billingDocument.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const cronSecret = req.headers.get("x-cron-secret");
  let actorUserId: string | null = null;
  if (await isCronSecret(cronSecret)) {
    actorUserId = null; // admin task via cron secret
  } else if (jwt) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid_jwt" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" });
    if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);
    actorUserId = userData.user.id;
  } else {
    return json({ error: "missing_auth" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const invoiceId: string | undefined = body?.invoice_id;
  const reason: string = typeof body?.reason === "string" ? body.reason : "PDF regenerated";
  if (!invoiceId) return json({ error: "missing_invoice_id" }, 400);

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, user_id, invoice_number, issue_date, due_date, billing_period_start, billing_period_end, subtotal, vat_total, total, vat_rate, invoice_type, pdf_storage_key, status, notes, service_id, order_id")
    .eq("id", invoiceId).maybeSingle();
  if (invErr || !inv) return json({ error: "invoice_not_found" }, 404);
  if (!inv.pdf_storage_key) return json({ error: "no_storage_key" }, 400);

  const { data: profile } = await supabase
    .from("profiles").select(PROFILE_PDF_COLUMNS).eq("id", inv.user_id).maybeSingle();

  const { data: svc } = inv.service_id
    ? await supabase.from("services").select("plan_name, service_address").eq("id", inv.service_id).maybeSingle()
    : { data: null };
  const { data: ord } = inv.order_id
    ? await supabase.from("orders").select("payment_method_id").eq("id", inv.order_id).maybeSingle()
    : { data: null };
  const { data: pm } = ord?.payment_method_id
    ? await supabase.from("payment_methods").select("method, dd_setup_status").eq("id", ord.payment_method_id).maybeSingle()
    : { data: null };
  const { data: mandate } = pm?.method === "direct_debit"
    ? await supabase.from("dd_mandates").select(DD_MANDATE_PDF_COLUMNS)
      .eq("user_id", inv.user_id).eq("status", "active").limit(1).maybeSingle()
    : { data: null };
  const { data: receipts } = await supabase.from("receipts").select("amount").eq("invoice_id", invoiceId);
  const amountPaidMinor = (receipts ?? []).reduce((s: number, r: any) => s + poundsToMinor(r.amount), 0);

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("description, line_total")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  const rawLines: RawLine[] = (lines ?? []).map((l: any) => {
    const { description, period } = splitStoredDescription(String(l.description));
    return { description, period_label: period, amount_minor: poundsToMinor(l.line_total) };
  });

  // Rebuild totals from stored gross line amounts (VAT inclusive) — same math, same numbers.
  const totals = itemiseInvoice(rawLines, "inclusive" as VatMode, vatRatePercent(inv.vat_rate ?? 20));

  // Sanity: preserve the stored total exactly. Refuse to overwrite if any drift.
  const storedTotalMinor = poundsToMinor(inv.total);
  if (totals.total_gross_minor !== storedTotalMinor) {
    return json({
      error: "total_mismatch",
      stored_total_minor: storedTotalMinor,
      recomputed_total_minor: totals.total_gross_minor,
    }, 409);
  }

  const pdfBytes = buildInvoicePdfBytes({
    invoiceNumber: inv.invoice_number,
    accountNumber: profile?.account_number ?? "",
    customerName: profile?.full_name ?? "Customer",
    issueDate: inv.issue_date as string,
    dueDate: (inv.due_date as string) ?? (inv.issue_date as string),
    periodStart: inv.billing_period_start as string,
    periodEndExclusive: inv.billing_period_end as string,
    totals,
    isFirstInvoice: inv.invoice_type === "first_pro_rata",
    ...customerPdfExtras(profile),
    planName: svc?.plan_name ?? null,
    serviceAddress: svc?.service_address ?? null,
    status: inv.status,
    notes: null,
    amountPaidMinor,
    paymentMethod: pm?.method ?? null,
    ...mandatePdfExtras(mandate, !!mandate && pm?.dd_setup_status === "active"),
  });

  const { error: upErr } = await supabase.storage
    .from("invoice-pdfs")
    .upload(inv.pdf_storage_key, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) return json({ error: "upload_failed", details: upErr.message }, 500);

  const pdfHash = await sha256Hex(pdfBytes);
  await supabase.from("invoices").update({
    pdf_hash: pdfHash,
    pdf_generated_at: new Date().toISOString(),
  }).eq("id", invoiceId);

  await supabase.from("audit_logs").insert({
    action: "update",
    entity: "invoice",
    entity_id: invoiceId,
    actor_user_id: actorUserId,
    metadata: {
      invoice_number: inv.invoice_number,
      reason,
      pdf_hash: pdfHash,
      totals_preserved: true,
      note: "VAT number added to invoice PDF after VAT registration confirmation. No financial values, invoice number, issue date, billing period, payment status or customer balance changed.",
    },
  });

  const { data: signed } = await supabase.storage
    .from("invoice-pdfs").createSignedUrl(inv.pdf_storage_key, 60 * 60 * 24 * 14);

  return json({
    ok: true,
    invoice_number: inv.invoice_number,
    pdf_hash: pdfHash,
    storage_key: inv.pdf_storage_key,
    signed_url: signed?.signedUrl ?? null,
  });
});