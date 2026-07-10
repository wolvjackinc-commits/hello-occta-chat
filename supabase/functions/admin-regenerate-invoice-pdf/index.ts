import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  itemiseInvoice,
  buildInvoicePdfBytes,
  poundsToMinor,
  sha256Hex,
  type RawLine,
  type VatMode,
} from "../_shared/billingHelpers.ts";

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
  const expectedCron = Deno.env.get("CRON_JOB_SECRET");
  let actorUserId: string | null = null;
  if (cronSecret && expectedCron && cronSecret === expectedCron) {
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
    .select("id, user_id, invoice_number, issue_date, due_date, billing_period_start, billing_period_end, subtotal, vat_total, total, vat_rate, invoice_type, pdf_storage_key")
    .eq("id", invoiceId).maybeSingle();
  if (invErr || !inv) return json({ error: "invoice_not_found" }, 404);
  if (!inv.pdf_storage_key) return json({ error: "no_storage_key" }, 400);

  const { data: profile } = await supabase
    .from("profiles").select("full_name, account_number").eq("id", inv.user_id).maybeSingle();

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("description, line_total")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  const rawLines: RawLine[] = (lines ?? []).map((l: any) => ({
    description: String(l.description),
    amount_minor: poundsToMinor(l.line_total),
  }));

  // Rebuild totals from stored gross line amounts (VAT inclusive) — same math, same numbers.
  const totals = itemiseInvoice(rawLines, "inclusive" as VatMode, Number(inv.vat_rate ?? 20));

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

  return json({ ok: true, invoice_number: inv.invoice_number, pdf_hash: pdfHash, storage_key: inv.pdf_storage_key });
});