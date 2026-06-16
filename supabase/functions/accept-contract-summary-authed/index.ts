import { corsHeaders, jsonResponse, getServiceClient, getRequestIp, checkRateLimit, sendResendEmail, brutalistEmailShell, escapeHtml, maskEmail } from "../_shared/quoteHelpers.ts";
import { ACCEPTANCE_CHECKBOX_TEXT } from "../_shared/legalText.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  contract_summary_id: z.string().uuid(),
  checkbox_confirmed: z.literal(true),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const supabase = getServiceClient();
  const { data: u } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!u?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
  const userId = u.user.id;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(userId, "accept_cs_authed", 20, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? "";

  // Call the SECURITY DEFINER RPC under the user's JWT so auth.uid() == userId
  const userClient = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await userClient.rpc("customer_accept_contract_summary", {
    _cs_id: parsed.data.contract_summary_id,
    _acceptance_text: ACCEPTANCE_CHECKBOX_TEXT,
    _ip: ip,
    _user_agent: ua,
    _checkbox_confirmed: true,
  });

  if (error) {
    return jsonResponse({ error: "accept_failed", details: error.message }, 400);
  }

  const res = data as { ok: boolean; already_accepted: boolean; contract_summary_id: string; acceptance_id: string; accepted_at: string };

  // Best-effort confirmation emails (skip when already_accepted to avoid spam).
  // CORRECTION #4 — email failure must NOT undo acceptance. Wrapped in try/catch
  // and logged to communications_log with status='failed' so admin can resend.
  if (!res.already_accepted) {
    const { data: cs } = await supabase.from("contract_summaries")
      .select("id, cs_number, version, plan_name, customer_id, customer_type, customer_email_snapshot, customer_name_snapshot, monthly_price_incl_vat, business_monthly_incl_vat, accepted_at, pdf_sha256, pdf_storage_key")
      .eq("id", parsed.data.contract_summary_id).maybeSingle();
    if (cs) await sendAcceptanceWelcomeAuthed(supabase, cs);
  }

  return jsonResponse(res);
});

async function sendAcceptanceWelcomeAuthed(supabase: ReturnType<typeof getServiceClient>, cs: any) {
  try {
    const recipient = cs.customer_email_snapshot;
    if (!recipient) return;

    // Idempotency dedupe (handles double-click on dashboard)
    const { data: existing } = await supabase
      .from("communications_log")
      .select("id")
      .eq("template_name", "contract_summary_accepted_welcome")
      .eq("status", "sent")
      .contains("metadata", { contract_summary_id: cs.id })
      .limit(1)
      .maybeSingle();
    if (existing) return;

    // Signed URL for the IMMUTABLE PDF (never regenerated)
    let signedUrl: string | null = null;
    try {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${svcKey}`,
          "Content-Type": "application/json",
          "x-internal-service": "1",
        },
        body: JSON.stringify({ contract_summary_id: cs.id, internal: true }),
      });
      if (r.ok) {
        const j = await r.json();
        signedUrl = j?.signed_url ?? null;
      }
    } catch { /* noop */ }

    const firstName = (cs.customer_name_snapshot || "there").split(" ")[0];
    const priceLine = cs.customer_type === "business"
      ? `£${Number(cs.business_monthly_incl_vat ?? cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`
      : `£${Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`;

    const html = brutalistEmailShell(
      "Welcome to OCCTA",
      `<p>Hi ${escapeHtml(firstName)},</p>
       <p>Welcome aboard — the paperwork is officially behaving itself. Your Contract Summary has been accepted and your copy is safely stored below.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.cs_number)}</strong> (v${cs.version})</td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.plan_name)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Monthly price</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(priceLine)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Accepted</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(new Date(cs.accepted_at ?? Date.now()).toLocaleString("en-GB"))}</td></tr>
       </table>
       <p><strong>What happens next?</strong> Our team will follow up with a secure payment link — we never take card details over email. After payment we'll arrange your install / activation.</p>
       <p>Your signed copy is below — keep it for your records. The link refreshes for 7 days; you can always download a fresh copy from your OCCTA dashboard.</p>
       <p style="font-size:12px;color:#555;">Questions? Reply to this email or contact <a href="mailto:hello@occta.co.uk" style="color:#555;">hello@occta.co.uk</a>.</p>`,
      signedUrl ? { label: "Download signed copy", url: signedUrl } : undefined,
    );

    const send = await sendResendEmail({
      to: recipient,
      subject: `Welcome to OCCTA — your Contract Summary is accepted`,
      html,
    });

    await supabase.from("communications_log").insert({
      user_id: cs.customer_id,
      template_name: "contract_summary_accepted_welcome",
      recipient_email: recipient,
      status: send.ok ? "sent" : "failed",
      sent_at: send.ok ? new Date().toISOString() : null,
      error_message: send.ok ? null : (send.error ?? "send_failed"),
      metadata: {
        contract_summary_id: cs.id,
        cs_number: cs.cs_number,
        cs_version: cs.version,
        pdf_sha256: cs.pdf_sha256,
        has_signed_url: !!signedUrl,
        accepted_via: "dashboard",
      },
    });

    const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
    void sendResendEmail({
      to: adminEmail,
      subject: `[CS accepted] ${cs.cs_number}`,
      html: brutalistEmailShell(
        "Contract Summary accepted (dashboard)",
        `<p>CS <strong>${escapeHtml(cs.cs_number)}</strong> accepted by ${escapeHtml(maskEmail(recipient))}.</p>
         <p>PDF SHA-256: <code style="font-size:11px;">${escapeHtml(String(cs.pdf_sha256))}</code></p>`,
        { label: "Open admin", url: "https://www.occta.co.uk/admin/quote-requests" },
      ),
    });
  } catch (e) {
    try {
      await supabase.from("communications_log").insert({
        user_id: cs.customer_id,
        template_name: "contract_summary_accepted_welcome",
        recipient_email: cs.customer_email_snapshot,
        status: "failed",
        error_message: `exception: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`,
        metadata: { contract_summary_id: cs.id, accepted_via: "dashboard" },
      });
    } catch { /* swallow */ }
  }
}