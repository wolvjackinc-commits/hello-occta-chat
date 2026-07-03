import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtDate = (iso: string) => {
  try {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB",
      { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch { return iso; }
};
const fmtInclusivePeriod = (startIso: string, endExclusiveIso: string) => {
  const end = new Date(endExclusiveIso + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() - 1);
  return `${fmtDate(startIso)} to ${fmtDate(end.toISOString().slice(0, 10))}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing_jwt" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "invalid_jwt" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" });
  if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const invoiceId: string | undefined = body?.invoice_id;
  const note: string = typeof body?.note === "string" ? body.note : "corrected invoice payment link sent";
  if (!invoiceId) return json({ error: "missing_invoice_id" }, 400);

  const appOrigin = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";
  const dashboardUrl = `${appOrigin}/dashboard`;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, user_id, invoice_number, issue_date, due_date, total, subtotal, vat_total, billing_period_start, billing_period_end, pdf_storage_key")
    .eq("id", invoiceId).maybeSingle();
  if (invErr || !inv) return json({ error: "invoice_not_found" }, 404);

  const { data: profile } = await supabase
    .from("profiles").select("full_name, email, account_number")
    .eq("id", inv.user_id).maybeSingle();
  const recipientEmail = (body?.override_to as string) || profile?.email;
  if (!recipientEmail) return json({ error: "customer_email_missing" }, 400);

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("description, qty, line_total")
    .eq("invoice_id", invoiceId);

  const { data: pr } = await supabase
    .from("payment_requests")
    .select("id, status, expires_at, provider_checkout_url, type")
    .eq("invoice_id", invoiceId).maybeSingle();

  let payNowUrl: string | null = null;
  let tokenRotated = false;
  if (pr && pr.type === "card_payment") {
    if (pr.provider_checkout_url) {
      payNowUrl = pr.provider_checkout_url;
    } else {
      const newToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      const newHash = await sha256Hex(newToken);
      const nowMs = Date.now();
      const existingExpiry = pr.expires_at ? new Date(pr.expires_at).getTime() : 0;
      const minExpiryMs = nowMs + 14 * 24 * 3600 * 1000;
      const newExpiry = existingExpiry > minExpiryMs
        ? new Date(existingExpiry) : new Date(minExpiryMs);
      const { error: upErr } = await supabase.from("payment_requests")
        .update({ token_hash: newHash, expires_at: newExpiry.toISOString(), status: "sent" })
        .eq("id", pr.id);
      if (upErr) return json({ error: "token_rotate_failed", details: upErr.message }, 500);
      payNowUrl = `${appOrigin}/pay?token=${newToken}`;
      tokenRotated = true;
    }
  }

  let pdfSignedUrl: string | null = null;
  if (inv.pdf_storage_key) {
    const { data: signed } = await supabase.storage
      .from("invoice-pdfs").createSignedUrl(inv.pdf_storage_key, 60 * 60 * 24 * 14);
    pdfSignedUrl = signed?.signedUrl ?? null;
  }

  const sendResp = await supabase.functions.invoke("send-email", {
    body: {
      type: "invoice_sent",
      to: recipientEmail,
      invoiceId: inv.id,
      paymentRequestId: pr?.id ?? null,
      logToCommunications: true,
      userId: inv.user_id,
      data: {
        customer_name: profile?.full_name ?? "there",
        account_number: profile?.account_number ?? "",
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
        issue_date: fmtDate(inv.issue_date as string),
        due_date: inv.due_date ? fmtDate(inv.due_date as string) : "",
        billing_period: inv.billing_period_start && inv.billing_period_end
          ? fmtInclusivePeriod(inv.billing_period_start as string, inv.billing_period_end as string)
          : "",
        lines: (lines ?? []).map((l) => ({
          description: l.description, qty: l.qty ?? 1, line_total: l.line_total,
        })),
        subtotal: inv.subtotal,
        vat_total: inv.vat_total,
        total: inv.total,
        pay_now_url: payNowUrl ?? `${appOrigin}/pay-invoice?id=${inv.id}`,
        invoice_pdf_url: pdfSignedUrl,
        dashboard_url: dashboardUrl,
      },
    },
  });
  if (sendResp.error) return json({ error: "email_failed", details: String(sendResp.error?.message ?? sendResp.error) }, 502);

  const messageId =
    (sendResp.data as any)?.data?.data?.id ??
    (sendResp.data as any)?.data?.id ??
    (sendResp.data as any)?.id ?? null;

  await supabase.from("communications_log").insert({
    invoice_id: inv.id,
    user_id: inv.user_id,
    payment_request_id: pr?.id ?? null,
    template_name: "invoice_resend_corrected",
    recipient_email: recipientEmail,
    status: "sent",
    provider_message_id: messageId,
    sent_at: new Date().toISOString(),
    metadata: {
      invoice_number: inv.invoice_number,
      note,
      pay_now_url: payNowUrl,
      token_rotated: tokenRotated,
      resent_by_admin_id: userData.user.id,
    },
  });

  return json({
    ok: true,
    message_id: messageId,
    pay_now_url: payNowUrl,
    token_rotated: tokenRotated,
    recipient: recipientEmail,
  });
});