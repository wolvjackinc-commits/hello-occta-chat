import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const fmtDate = (d: string | Date | null) => {
  if (!d) return "TBC";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const fmtMoney = (n: number) => `£${Number(n || 0).toFixed(2)}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const TARGET_USER_ID = "8962f90e-b142-4582-b1dc-14d372894691";
  const TO_EMAIL = "previnamistry67@gmail.com";
  const BCC_EMAIL = "jpbaker2019@gmail.com";
  const CUSTOMER_NAME = "Dullabhbhai Mistry";
  const ACCOUNT_NUMBER = "OCC70547490";
  const SITE_URL = Deno.env.get("SITE_URL") || "https://www.occta.co.uk";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500, headers: corsHeaders });
  }

  // 1. Pull billing settings + most recent invoice
  const { data: billing } = await supabase
    .from("billing_settings")
    .select("billing_day, billing_mode, next_invoice_date, payment_terms_days")
    .eq("user_id", TARGET_USER_ID)
    .maybeSingle();

  const { data: lastInvoice } = await supabase
    .from("invoices")
    .select("invoice_number, total, status, issue_date, due_date, pdf_url")
    .eq("user_id", TARGET_USER_ID)
    .order("issue_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextInvoiceDate = billing?.next_invoice_date || null;
  const termsDays = billing?.payment_terms_days ?? 14;
  const nextCollection = nextInvoiceDate
    ? new Date(new Date(nextInvoiceDate).getTime() + termsDays * 86400000)
    : null;

  // 2. Mint DD setup payment_request
  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const rawToken = btoa(String.fromCharCode(...rawBytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 21 * 86400000).toISOString();

  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .insert({
      user_id: TARGET_USER_ID,
      type: "dd_setup",
      status: "sent",
      amount: 0,
      currency: "GBP",
      customer_email: TO_EMAIL,
      customer_name: CUSTOMER_NAME,
      account_number: ACCOUNT_NUMBER,
      notes: "Admin-initiated DD facility activation notice",
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id, payment_request_number")
    .single();
  if (prErr || !pr) {
    return new Response(JSON.stringify({ error: prErr?.message || "Failed to mint DD link" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const ddLink = `${SITE_URL}/dd/setup?token=${encodeURIComponent(rawToken)}`;
  const invoiceLink = lastInvoice?.pdf_url || `${SITE_URL}/dashboard?tab=invoices`;

  // 3. Build branded email
  const subject = "Your OCCTA Direct Debit facility is now active";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
  <style>
    body{margin:0;padding:0;background:#f5f4ef;font-family:'Inter',Arial,sans-serif;color:#0d0d0d;}
    .wrap{padding:40px 16px;}
    .card{max-width:620px;margin:0 auto;background:#fff;border:4px solid #0d0d0d;box-shadow:8px 8px 0 0 #0d0d0d;}
    .hd{background:#0d0d0d;color:#fff;padding:28px 32px;position:relative;overflow:hidden;}
    .hd::after{content:'';position:absolute;top:-30px;right:-30px;width:110px;height:110px;background:#facc15;transform:rotate(45deg);}
    .logo{font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;letter-spacing:5px;}
    .tag{font-size:11px;letter-spacing:3px;color:#facc15;text-transform:uppercase;margin-top:4px;font-weight:600;}
    .banner{background:#22c55e;color:#fff;padding:14px 32px;border-bottom:4px solid #0d0d0d;font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;letter-spacing:2px;text-transform:uppercase;}
    .body{padding:30px 32px;font-size:15px;line-height:1.65;}
    h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;letter-spacing:2px;text-transform:uppercase;margin:24px 0 8px;}
    .panel{background:#f5f4ef;border:3px solid #0d0d0d;padding:18px;margin:18px 0;}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ccc;font-size:14px;}
    .row:last-child{border-bottom:none;}
    .row .l{color:#666;text-transform:uppercase;letter-spacing:1px;font-size:12px;font-weight:600;}
    .row .v{font-weight:700;text-align:right;}
    .ctaWrap{text-align:center;margin:28px 0;}
    .cta{display:inline-block;background:#facc15;color:#0d0d0d;text-decoration:none;padding:16px 38px;font-family:'Bebas Neue',Impact,sans-serif;font-size:18px;letter-spacing:2px;text-transform:uppercase;border:3px solid #0d0d0d;box-shadow:5px 5px 0 0 #0d0d0d;}
    .cta.dark{background:#0d0d0d;color:#facc15;box-shadow:5px 5px 0 0 #facc15;margin-left:8px;}
    .small{font-size:12px;color:#666;}
    .ft{background:#0d0d0d;color:#888;padding:24px 32px;text-align:center;font-size:11px;line-height:1.6;}
    .ft a{color:#facc15;text-decoration:none;}
  </style></head><body>
  <div class="wrap"><div class="card">
    <div class="hd"><div class="logo">OCCTA</div><div class="tag">Telecom • Connected</div></div>
    <div class="banner">✓ Direct Debit Facility Active</div>
    <div class="body">
      <p>Hi ${esc(CUSTOMER_NAME)},</p>
      <p>Great news — your account <strong>${esc(ACCOUNT_NUMBER)}</strong> is now fully enabled for <strong>Direct Debit</strong>. From now on, your monthly invoices will be collected automatically, so you never have to worry about missing a payment.</p>

      <h2>Set up your mandate</h2>
      <p>To activate collections, please complete the secure Direct Debit mandate using the button below. It takes under 2 minutes — you'll just need your sort code and account number.</p>
      <div class="ctaWrap">
        <a href="${esc(ddLink)}" class="cta">Sign Direct Debit Mandate →</a>
      </div>
      <p class="small" style="text-align:center;">Secure link expires ${esc(fmtDate(expiresAt))}. Protected by the <strong>Direct Debit Guarantee</strong>.</p>

      <h2>Your billing schedule</h2>
      <div class="panel">
        <div class="row"><span class="l">Next Invoice Issued</span><span class="v">${esc(fmtDate(nextInvoiceDate))}</span></div>
        <div class="row"><span class="l">Next Payment Collected</span><span class="v">${esc(nextCollection ? fmtDate(nextCollection) : "TBC")}</span></div>
        <div class="row"><span class="l">Billing Day</span><span class="v">${esc(billing?.billing_day ?? "—")} of each month</span></div>
        <div class="row"><span class="l">Payment Terms</span><span class="v">${esc(termsDays)} days from invoice</span></div>
      </div>
      <p class="small">You'll always receive your invoice by email <strong>at least 10 working days</strong> before any Direct Debit is collected, in line with the Bacs scheme rules.</p>

      ${lastInvoice ? `
      <h2>Your latest invoice</h2>
      <div class="panel">
        <div class="row"><span class="l">Invoice</span><span class="v">${esc(lastInvoice.invoice_number)}</span></div>
        <div class="row"><span class="l">Status</span><span class="v">${esc(String(lastInvoice.status).toUpperCase())}</span></div>
        <div class="row"><span class="l">Total</span><span class="v">${esc(fmtMoney(Number(lastInvoice.total)))}</span></div>
        <div class="row"><span class="l">Issued</span><span class="v">${esc(fmtDate(lastInvoice.issue_date))}</span></div>
      </div>
      <div class="ctaWrap"><a href="${esc(invoiceLink)}" class="cta dark">View Invoice</a></div>
      ` : ""}

      <h2>What happens next</h2>
      <ol style="padding-left:20px;">
        <li>You sign the mandate using the link above.</li>
        <li>We confirm the mandate (1–3 working days) and email you the Direct Debit Guarantee.</li>
        <li>From your next invoice, OCCTA will collect automatically — no action needed from you.</li>
      </ol>

      <p>If you have any questions, just reply to this email or call us on <strong>0800 260 6626</strong> (Mon–Fri 9–6, Sat 9–1).</p>
      <p>Thank you for choosing OCCTA.<br/><strong>The OCCTA Billing Team</strong></p>
    </div>
    <div class="ft">
      © ${new Date().getFullYear()} OCCTA Limited · Company No. 13828933 · 22 Pavilion View, Huddersfield, HD3 3WU<br/>
      <a href="${esc(SITE_URL)}/dashboard">Dashboard</a> · <a href="${esc(SITE_URL)}/support">Support</a> · <a href="mailto:billing@occta.co.uk">billing@occta.co.uk</a>
    </div>
  </div></div></body></html>`;

  const text = `Hi ${CUSTOMER_NAME},\n\nYour OCCTA Direct Debit facility is now active for account ${ACCOUNT_NUMBER}.\n\nSet up your mandate: ${ddLink}\n(Expires ${fmtDate(expiresAt)})\n\nBilling schedule:\n- Next invoice issued: ${fmtDate(nextInvoiceDate)}\n- Next payment collected: ${nextCollection ? fmtDate(nextCollection) : "TBC"}\n- Billing day: ${billing?.billing_day ?? "—"}\n- Payment terms: ${termsDays} days\n\n${lastInvoice ? `Latest invoice: ${lastInvoice.invoice_number} — ${fmtMoney(Number(lastInvoice.total))} (${lastInvoice.status}).\nView: ${invoiceLink}\n\n` : ""}Once your mandate is signed, we'll email you the Direct Debit Guarantee (PDF) and start collecting automatically.\n\nQuestions? billing@occta.co.uk · 0800 260 6626\n\n— OCCTA Billing Team`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "OCCTA Billing <billing@occta.co.uk>",
      to: [TO_EMAIL],
      bcc: [BCC_EMAIL],
      reply_to: "billing@occta.co.uk",
      subject,
      html,
      text,
    }),
  });

  const respBody = await resp.text();
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: "Resend failed", status: resp.status, body: respBody }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try { await supabase.from("communications_log").insert({
    user_id: TARGET_USER_ID,
    payment_request_id: pr.id,
    template_name: "dd_facility_active_notice",
    recipient_email: TO_EMAIL,
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: { bcc: BCC_EMAIL, dd_link_pr: pr.payment_request_number },
  }); } catch (_e) { /* non-fatal */ }

  try { await supabase.from("payment_request_events").insert({
    request_id: pr.id,
    event_type: "admin_dd_link_sent",
    metadata: { source: "oneshot-dd-active-notice", recipient: TO_EMAIL, bcc: BCC_EMAIL },
  }); } catch (_e) { /* non-fatal */ }

  return new Response(JSON.stringify({
    success: true,
    payment_request_number: pr.payment_request_number,
    dd_link: ddLink,
    resend: JSON.parse(respBody),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});