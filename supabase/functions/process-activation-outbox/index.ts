import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { perfServe } from "../_shared/perfLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c],
  );

const fmtMoney = (minor: number) =>
  `£${(Math.round(minor) / 100).toFixed(2)}`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
};

function buildEmailHtml(p: any, dashboardUrl: string) {
  const speed = (p.estimated_download_speed
    ? `${p.estimated_download_speed} Mbps` : "");
  const supportEmail = "support@occta.co.uk";
  const billingEmail = "billing@occta.co.uk";
  const supportPhone = "0330 822 0123";
  const helpUrl = "https://www.occta.co.uk/help";
  const billingHelpUrl = "https://www.occta.co.uk/help/billing";
  const gettingStartedUrl = "https://www.occta.co.uk/help/getting-started";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#fff">
  <div style="max-width:600px;margin:0 auto;padding:24px;border:4px solid #111">
    <h1 style="font-size:22px;margin:0 0 12px">Your OCCTA service is live</h1>
    <p>Hi ${escapeHtml(p.recipient_name || "there")},</p>
    <p>Good news — your service has been activated. Everything you need to manage it is below. No contracts. No pressure.</p>
    <h2 style="font-size:16px;margin:20px 0 8px;border-top:2px solid #111;padding-top:14px">Your service</h2>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#555">Account number</td><td style="text-align:right"><b>${escapeHtml(p.account_number || "")}</b></td></tr>
      <tr><td style="padding:6px 0;color:#555">Order number</td><td style="text-align:right"><b>${escapeHtml(p.occta_order_number || "")}</b></td></tr>
      <tr><td style="padding:6px 0;color:#555">Plan</td><td style="text-align:right">${escapeHtml(p.plan_name || "")}${speed ? " · " + escapeHtml(speed) : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Activation date</td><td style="text-align:right">${escapeHtml(fmtDate(p.activation_date))}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Monthly price</td><td style="text-align:right">${fmtMoney(p.monthly_price_minor || 0)}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Payment method</td><td style="text-align:right">${escapeHtml(p.payment_method_label || "")}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Next billing date</td><td style="text-align:right">${escapeHtml(fmtDate(p.next_billing_date))}</td></tr>
    </table>
    <h2 style="font-size:16px;margin:20px 0 8px;border-top:2px solid #111;padding-top:14px">How and when you'll be billed</h2>
    <ul style="padding-left:18px;font-size:14px;line-height:1.55;margin:8px 0">
      <li>Your first invoice will be raised on <b>${escapeHtml(fmtDate(p.next_billing_date))}</b> for <b>${fmtMoney(p.monthly_price_minor || 0)}</b>.</li>
      <li>Payment method on file: <b>${escapeHtml(p.payment_method_label || "")}</b>. ${p.payment_method_label === "Direct Debit" ? "We'll collect automatically — no action needed." : "You'll receive a secure pay-link with each invoice."}</li>
      <li>VAT is already included in your monthly price.</li>
      <li>Questions about a bill? Email <a href="mailto:${billingEmail}">${billingEmail}</a> or see our <a href="${billingHelpUrl}">billing guide</a>.</li>
    </ul>
    <h2 style="font-size:16px;margin:20px 0 8px;border-top:2px solid #111;padding-top:14px">Getting started</h2>
    <ul style="padding-left:18px;font-size:14px;line-height:1.55;margin:8px 0">
      <li>Plug your router into the master socket and power on — most lines connect in under 10 minutes.</li>
      <li>Run a <a href="https://www.speedtest.net">speed test</a> after 24 hours so the line can stabilise.</li>
      <li>Read our <a href="${gettingStartedUrl}">getting started guide</a> for router placement, Wi-Fi tips and Digital Voice setup.</li>
    </ul>
    <h2 style="font-size:16px;margin:20px 0 8px;border-top:2px solid #111;padding-top:14px">Need a hand?</h2>
    <ul style="padding-left:18px;font-size:14px;line-height:1.55;margin:8px 0">
      <li>Support email: <a href="mailto:${supportEmail}">${supportEmail}</a></li>
      <li>Support phone: <b>${supportPhone}</b> (Mon–Fri 9–6)</li>
      <li>Help centre: <a href="${helpUrl}">${helpUrl}</a></li>
    </ul>
    <p style="margin-top:20px"><a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border:2px solid #111;font-weight:bold">Open your dashboard</a></p>
    <p style="font-size:12px;color:#666;margin-top:24px">Keep this email for your records — your account number is your reference for any future contact.</p>
  </div></body></html>`;
}

Deno.serve(perfServe("process-activation-outbox", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_JOB_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader && cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Claim a batch of due rows. NOTE: we never INSERT another outbox row —
  // we only update the single row created by confirm_service_live_tx.
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("service_activation_outbox")
    .select("id, service_id, payload, attempts, status")
    .in("status", ["pending", "retry_scheduled"])
    .lte("next_attempt_at", nowIso)
    .limit(25);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of due ?? []) {
    // Mark processing first (single-flight). If another worker already moved
    // it, skip silently.
    const { data: claimed } = await supabase
      .from("service_activation_outbox")
      .update({ status: "processing", last_attempted_at: nowIso })
      .eq("id", row.id)
      .in("status", ["pending", "retry_scheduled"])
      .select("id")
      .maybeSingle();
    if (!claimed) { results.push({ id: row.id, skipped: true }); continue; }

    try {
      // Enrich payload with the canonical payment method type (no bank details).
      const { data: svc } = await supabase
        .from("services").select("order_id")
        .eq("id", row.service_id).maybeSingle();
      let paymentLabel = "Direct Debit / Invoice link";
      let speedDown: number | null = null;
      if (svc?.order_id) {
        const { data: ord } = await supabase
          .from("orders")
          .select("payment_method_id, contract_summary_id")
          .eq("id", svc.order_id).maybeSingle();
        if (ord?.payment_method_id) {
          const { data: pm } = await supabase
            .from("payment_methods").select("method")
            .eq("id", ord.payment_method_id).maybeSingle();
          if (pm?.method === "direct_debit") paymentLabel = "Direct Debit";
          else if (pm?.method === "invoice_link") paymentLabel = "Invoice with secure payment link";
        }
        if (ord?.contract_summary_id) {
          const { data: cs } = await supabase
            .from("contract_summaries").select("estimated_download_speed")
            .eq("id", ord.contract_summary_id).maybeSingle();
          speedDown = cs?.estimated_download_speed ?? null;
        }
      }
      const payload = {
        ...row.payload,
        payment_method_label: paymentLabel,
        estimated_download_speed: speedDown,
      };

      const dashboardUrl = (Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk") + "/dashboard";
      const html = buildEmailHtml(payload, dashboardUrl);

      // Send via existing send-email function (custom_admin renders any html_body
      // inside the OCCTA branded shell). Service role bypasses admin role check.
      const subjectLine = `Your OCCTA service is live${payload.occta_order_number ? " — " + payload.occta_order_number : ""}`.trim();
      const sendResp = await supabase.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: payload.recipient_email,
          userId: payload.user_id ?? undefined,
          logToCommunications: true,
          data: {
            subject: subjectLine,
            title: "Your service is live",
            title_banner: true,
            preheader: `Welcome to OCCTA — your ${payload.plan_name ?? "service"} is now active.`,
            greeting: `Hi ${payload.recipient_name || "there"}`,
            html_body: html,
          },
        },
      });

      if (sendResp.error) throw new Error(sendResp.error.message || "send_failed");

      await supabase.from("service_activation_outbox")
        .update({
          status: "sent",
          processed_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          provider_message_id: (sendResp.data as any)?.message_id ?? null,
          last_error: null,
        })
        .eq("id", row.id);
      results.push({ id: row.id, sent: true });
    } catch (e) {
      const attempts = (row.attempts ?? 0) + 1;
      const giveUp = attempts >= 8;
      const backoffMin = Math.min(60, Math.pow(2, attempts));
      const next = new Date(Date.now() + backoffMin * 60_000).toISOString();
      await supabase.from("service_activation_outbox")
        .update({
          status: giveUp ? "failed" : "retry_scheduled",
          attempts,
          last_error: String((e as Error)?.message ?? e).slice(0, 1000),
          next_attempt_at: next,
        })
        .eq("id", row.id);
      results.push({ id: row.id, error: String((e as Error)?.message ?? e), retry_in_minutes: giveUp ? null : backoffMin });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));