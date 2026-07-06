import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { perfServe } from "../_shared/perfLog.ts";
import { renderBrandedEmail, escapeEmailHtml } from "../_shared/brandedEmailShell.ts";
import { fetchHelpfulLinks } from "../_shared/helpfulLinks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const escapeHtml = escapeEmailHtml;

const fmtMoney = (minor: number) =>
  `£${(Math.round(minor) / 100).toFixed(2)}`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
};

function buildEmailHtml(p: any, dashboardUrl: string, helpfulLinksHtml = "") {
  const speed = (p.estimated_download_speed
    ? `${p.estimated_download_speed} Mbps` : "");
  const supportEmail = "hello@occta.co.uk";
  const helpUrl = "https://www.occta.co.uk/help";
  const billingHelpUrl = "https://www.occta.co.uk/help/how-occta-billing-works";
  const gettingStartedUrl = "https://www.occta.co.uk/help/how-to-set-up-your-router";
  const slowWifiUrl = "https://www.occta.co.uk/help/slow-wifi-troubleshooting";
  const noInternetUrl = "https://www.occta.co.uk/help/router-lights-explained";
  const guidesUrl = "https://www.occta.co.uk/guides";
  const confettiUrl =
    "https://www.occta.co.uk/__l5e/assets-v1/fed0a658-1ea3-4379-a1bb-b8bb8e25374e/welcome-confetti.gif";

  const name = p.recipient_name || "there";
  const isDirectDebit = p.payment_method_label === "Direct Debit";

  const intro = `
    <p style="margin:0 0 12px 0">You did a smart thing. You picked the provider that doesn't believe in 24-month lock-ins, mid-contract price hikes, or chatbots that pretend to be human. Your service is now live and ready to use.</p>
    <p style="margin:0">Here's everything you need to manage it — bookmark this email, your account number on it is your reference for anything down the line.</p>
  `;

  const whyGoodHtml = `
    <p style="margin:0 0 8px 0">A few things you've quietly signed up to <em>not</em> deal with:</p>
    <ul style="margin:0;padding-left:18px">
      <li><strong>Flexible monthly options available.</strong> Rolling monthly. Leave with 30 days' notice, no exit fee.</li>
      <li><strong>No mid-contract price hikes.</strong> The price you saw is the price you pay.</li>
      <li><strong>UK humans on support.</strong> No offshore phone trees, no scripts.</li>
      <li><strong>VAT included.</strong> The total you see is the total you pay.</li>
      <li><strong>Move home with us, free.</strong> No transfer charge.</li>
    </ul>`;

  const serviceTableHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font:14px/1.55 Arial,Helvetica,sans-serif">
      <tr><td style="padding:6px 0;color:#666">Account number</td><td style="text-align:right"><strong>${escapeHtml(p.account_number || "")}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#666">Order number</td><td style="text-align:right"><strong>${escapeHtml(p.occta_order_number || "")}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#666">Plan</td><td style="text-align:right">${escapeHtml(p.plan_name || "")}${speed ? " · " + escapeHtml(speed) : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Activation date</td><td style="text-align:right">${escapeHtml(fmtDate(p.activation_date))}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Monthly price</td><td style="text-align:right"><strong>${fmtMoney(p.monthly_price_minor || 0)}</strong> <span style="color:#666">(incl. VAT)</span></td></tr>
      <tr><td style="padding:6px 0;color:#666">Payment method</td><td style="text-align:right">${escapeHtml(p.payment_method_label || "")}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Next billing date</td><td style="text-align:right">${escapeHtml(fmtDate(p.next_billing_date))}</td></tr>
    </table>`;

  const billingHtml = `
    <ul style="margin:0;padding-left:18px">
      <li>First invoice is raised on <strong>${escapeHtml(fmtDate(p.next_billing_date))}</strong> for <strong>${fmtMoney(p.monthly_price_minor || 0)}</strong>.</li>
      <li>Payment method on file: <strong>${escapeHtml(p.payment_method_label || "")}</strong>. ${isDirectDebit ? "We collect automatically — nothing for you to do. Fully protected by the Direct Debit Guarantee." : "Each invoice comes with a one-tap secure Worldpay link."}</li>
      <li>VAT is already included in your monthly price.</li>
      <li>Questions about a bill? See the <a href="${billingHelpUrl}" style="color:#111">billing guide</a> or email <a href="mailto:${supportEmail}" style="color:#111">${supportEmail}</a>.</li>
    </ul>`;

  const gettingStartedSection = `
    <ol style="margin:0;padding-left:20px">
      <li>Plug your router into the master socket and power it on. Most lines come up in under 10 minutes.</li>
      <li>Connect to the Wi-Fi using the name and password printed on the router.</li>
      <li>Run a <a href="https://www.speedtest.net" style="color:#111">speed test</a> after 24 hours — the line stabilises over the first 10 days.</li>
      <li>Read the <a href="${gettingStartedUrl}" style="color:#111"><strong>Getting Started guide</strong></a> for router placement, Wi-Fi tips and Digital Voice setup.</li>
    </ol>`;

  const helpHtml = `
    <ul style="margin:0;padding-left:18px">
      <li>Help centre: <a href="${helpUrl}" style="color:#111">occta.co.uk/help</a> — self-service for billing, Wi-Fi, moving home and more.</li>
      <li>Slow Wi-Fi? <a href="${slowWifiUrl}" style="color:#111">Fix it in 5 minutes</a>.</li>
      <li>No internet? <a href="${noInternetUrl}" style="color:#111">Run our 5-step check</a>.</li>
      <li>Guides &amp; blog: <a href="${guidesUrl}" style="color:#111">occta.co.uk/guides</a>.</li>
      <li>Talk to a human: <a href="mailto:${supportEmail}" style="color:#111">${supportEmail}</a> — we reply in hours, not days.</li>
    </ul>`;

  return renderBrandedEmail({
    preheader: `Welcome to OCCTA — your ${p.plan_name ?? "service"} is now live.`,
    eyebrow: "Welcome — Service Live",
    reference: p.occta_order_number || "",
    topImageUrl: confettiUrl,
    topImageAlt: "Welcome confetti animation",
    greeting: `Welcome, ${name} 🎉`,
    intro,
    sections: [
      { heading: "Why this was a good decision", html: whyGoodHtml },
      { heading: "Your service", html: serviceTableHtml },
      { heading: "How and when you'll be billed", html: billingHtml },
      { heading: "Getting started in 4 steps", html: gettingStartedSection },
      { heading: "Need a hand?", html: helpHtml },
      ...(helpfulLinksHtml ? [{ heading: "Helpful reading", html: helpfulLinksHtml }] : []),
    ],
    cta: { label: "Open your dashboard", url: dashboardUrl },
    closingHtml: `Keep this email — your account number <strong>${escapeHtml(p.account_number || "")}</strong> is your reference for anything in future. Welcome aboard.`,
  });
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
        .from("services").select("order_id, user_id")
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
        user_id: svc?.user_id ?? null,
      };

      const dashboardUrl = (Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk") + "/dashboard";
      const helpfulLinks = await fetchHelpfulLinks(supabase, "service_live", { max: 4 });
      const helpfulLinksInnerHtml = helpfulLinks.length
        ? `<ul style="margin:0;padding-left:18px">${helpfulLinks.map((l) => `<li><a href="${escapeHtml(l.url)}" style="color:#111"><strong>${escapeHtml(l.title)}</strong></a>${l.summary ? ` — <span style="color:#555">${escapeHtml(l.summary)}</span>` : ""}</li>`).join("")}</ul>`
        : "";
      const html = buildEmailHtml(payload, dashboardUrl, helpfulLinksInnerHtml);

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
            use_raw_html: true,
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