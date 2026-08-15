/**
 * One-off admin remediation: Philip Banks (OCC67005705).
 *
 * The Ultrafast (550/75) product he signed for is NOT deliverable at
 * Flat 3, Larch Court, Commercial Street, Burslem, Stoke-On-Trent, ST6 3JR.
 * The best available product is BT/Openreach SOGEA 80/20.
 *
 * This issues a REVISED (superseding) Contract Summary — v2 — copied
 * field-for-field from his accepted v1, changing ONLY:
 *   plan / speed band / estimated speeds / speed notes / monthly price.
 * Router, setup, add-ons, term, notice period, cease charges, billing rules
 * and every other clause are carried over untouched.
 *
 * Actions:
 *   preview  — renders the email + shows the proposed diff. No writes, no email.
 *   prepare  — creates v2, generates the immutable PDF, mints the signing link.
 *              NO email.
 *   send     — emails the apology + signing link for the prepared v2.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, requireStaff,
  generateTokenPair, sendResendEmail, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  action: z.enum(["preview", "prepare", "send"]),
  confirm: z.boolean().optional(),
  expires_in_days: z.number().int().min(1).max(60).optional(),
});

const ACCOUNT = "OCC67005705";
const CUSTOMER_ID = "cc9412fb-7bf5-4c47-ac03-3ce5a0306e3f";
const SOURCE_CS_ID = "3095de20-8fc2-4423-843b-0d642b3138a9";
const NEW_PRICE_INCL_VAT = 44.00;

const SPEED_NOTES = [
  "Product: BT/Openreach SOGEA (Single Order Generic Ethernet Access) — FTTC-based broadband delivered over the existing copper line into your property, with no separate analogue phone line required.",
  "Estimated download up to 80 Mbps and estimated upload up to 20 Mbps. Speeds are estimates for your line and are not guaranteed.",
  "Openreach line estimate for this address: download 71–80 Mbps, upload 18–20 Mbps. Minimum guaranteed access line download speed: 55 Mbps.",
  "Technology: SOGEA / VDSL2 over Openreach copper. Full-fibre (FTTP) Ultrafast is NOT currently available at this address, so the 550/75 service originally quoted cannot be delivered.",
  "Latency typically 10–25 ms. Unlimited usage — no data caps, no traffic-shaping on normal residential use.",
  "Connection is not suitable as a guaranteed emergency-call service during a power cut. See the emergency-calls note in your contract information.",
  "If Openreach makes full fibre available at this address later, you can move onto an Ultrafast plan without an early-termination charge.",
].join("\n");

const PLAN_NAME = "Essential Fibre — Flex 30";

// Columns that must never be carried over to a new version.
const DROP = new Set([
  "id", "version", "status", "document_status", "supersedes_id", "cs_number",
  "public_token_hash", "token_expires_at", "issued_at", "issued_at_utc",
  "accepted_at", "accepted_at_utc", "accepted_ip", "accepted_user_agent",
  "superseded_at_utc", "cancelled_at_utc", "archived_at", "archived_reason",
  "pdf_url", "pdf_storage_key", "pdf_storage_path", "pdf_sha256", "pdf_hash",
  "pdf_generated_at", "pdf_generated_by", "emailed_at",
  "created_at", "created_at_utc", "updated_at",
]);

function buildEmail(opts: {
  firstName: string;
  csNumber: string;
  version: number;
  address: string;
  oldPrice: string;
  newPrice: string;
  csUrl: string;
  daysValid: number;
}) {
  const { firstName, csNumber, version, address, oldPrice, newPrice, csUrl, daysValid } = opts;
  return brutalistEmailShell(
    "We got your speed wrong — here's how we're fixing it",
    `<p>Hi ${escapeHtml(firstName)},</p>

     <p><strong>First of all, I'm sorry.</strong> When you placed your order with us you chose our Ultrafast
     plan at up to 550 Mbps. After your order went through to Openreach for line qualification, it came back
     confirming that <strong>full fibre is not currently available at your property</strong>. That means the
     Ultrafast service we quoted you simply cannot be delivered to Flat 3, Larch Court — and you should never
     have been shown it as an option at checkout. That's on us, not you.</p>

     <p><strong>What we can actually deliver.</strong> The best available product at your address today is
     <strong>BT/Openreach SOGEA — up to 80 Mbps download / up to 20 Mbps upload</strong>. It's a proper
     modern connection: no separate phone line needed, unlimited usage, no traffic shaping, and it uses the
     existing line straight into your flat.</p>

     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;border:3px solid #000;">
       <tr><td colspan="2" style="padding:10px 14px;background:#000;color:#facc15;font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">Your revised service — full specification</td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Plan</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;"><strong>${escapeHtml(PLAN_NAME)}</strong></td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Technology</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">BT/Openreach SOGEA (VDSL2 over Openreach copper) — no analogue phone line required</td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Estimated speeds</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;"><strong>Up to 80 Mbps down / up to 20 Mbps up</strong><br/><span style="color:#555;">Line estimate 71–80 down, 18–20 up. Minimum guaranteed download 55 Mbps.</span></td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Usage</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">Unlimited — no caps, no shaping on normal residential use. Latency typically 10–25 ms.</td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Term</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">Flex 30 — rolling monthly, 30 days notice. Unchanged.</td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Router, setup &amp; add-ons</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">Exactly as you ordered — Standard WiFi 6 router (£94.99 one-off), network activation / remote setup (£84.99 one-off), paper billing add-on. Nothing changed.</td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Monthly price</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;"><strong>£${escapeHtml(newPrice)}/mo incl. VAT</strong> <span style="color:#555;">(was £${escapeHtml(oldPrice)}/mo — reduced as a goodwill discount for the mix-up)</span></td></tr>
       <tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">Service address</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">${escapeHtml(address)}</td></tr>
     </table>

     <p><strong>The discount.</strong> Because we got this wrong, we've cut your monthly price from
     £${escapeHtml(oldPrice)} down to <strong>£${escapeHtml(newPrice)} a month including VAT</strong>, and held
     it there. Everything else — your router, your setup, your add-ons, your 30-day rolling term, your notice
     period and your cancellation terms — stays exactly as it already was.</p>

     <p><strong>What we need from you.</strong> Because the speed on your agreement has changed, we can't just
     amend it quietly — you need to read and sign a fresh Contract Summary
     (<strong>${escapeHtml(csNumber)}</strong>, v${version}). Your existing agreement stays in place until you
     sign this one, and is cancelled automatically the moment you do.</p>

     <p><strong>And if you'd rather not.</strong> Completely fair. If 80/20 isn't what you signed up for, tell
     us and we'll cancel the order in full with nothing to pay — no charges, no cease fee, no argument. Just
     reply to this email or call us. And if Openreach brings full fibre to your building later, you can move
     up to Ultrafast with no early-termination charge.</p>

     <p style="font-size:13px;">Helpful reading while you decide:</p>
     <ul style="font-size:13px;line-height:1.7;margin:0 0 16px 18px;padding:0;">
       <li><a href="https://www.occta.co.uk/help" style="color:#111;">Help &amp; support centre</a></li>
       <li><a href="https://www.occta.co.uk/learn/broadband-speed-guide" style="color:#111;">Broadband speeds explained — what "up to" really means</a></li>
       <li><a href="https://www.occta.co.uk/learn/upload-speed-explained" style="color:#111;">Upload speed explained</a></li>
       <li><a href="https://www.occta.co.uk/learn/slow-broadband-fixes" style="color:#111;">Getting the best out of your line</a></li>
       <li><a href="https://www.occta.co.uk/learn/router-buying-guide" style="color:#111;">Router &amp; WiFi setup guide</a></li>
       <li><a href="https://www.occta.co.uk/install" style="color:#111;">What happens on install day</a></li>
       <li><a href="https://www.occta.co.uk/legal/price-transparency" style="color:#111;">Our price transparency promise</a></li>
       <li><a href="https://www.occta.co.uk/dashboard" style="color:#111;">Your OCCTA dashboard</a></li>
     </ul>

     <p>Thanks for your patience with this, ${escapeHtml(firstName)} — and again, sorry we didn't catch it
     before you ordered.</p>

     <p style="font-size:12px;color:#555;">This signing link is private to you and expires in ${daysValid} days.</p>
     <p style="font-size:12px;color:#555;">Questions? Reply to this email or call us on 0800 260 6626.</p>`,
    { label: "Read and sign your revised Contract Summary", url: csUrl },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const internal = req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000");
  let actorId: string | null = null;
  if (!internal) {
    const auth = await requireStaff(req, ["admin", "super_admin"]);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    actorId = auth.userId;
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { action, confirm } = parsed.data;
  const daysValid = parsed.data.expires_in_days ?? 21;
  if (action !== "preview" && confirm !== true) {
    return jsonResponse({ error: "confirm_required", message: "Pass confirm:true for prepare/send." }, 400);
  }

  const supabase = getServiceClient();

  const { data: src } = await supabase
    .from("contract_summaries").select("*").eq("id", SOURCE_CS_ID).maybeSingle();
  if (!src) return jsonResponse({ error: "source_not_found" }, 404);
  if (src.customer_id !== CUSTOMER_ID) return jsonResponse({ error: "customer_mismatch" }, 409);

  const oldPrice = Number(src.monthly_price_incl_vat ?? 0).toFixed(2);
  const newPrice = NEW_PRICE_INCL_VAT.toFixed(2);
  const address = String(src.service_address ?? "");
  const firstName = String(src.customer_name_snapshot || "there").split(" ")[0];
  const recipient = String(src.customer_email_snapshot);

  // ── PREVIEW: no writes at all ──
  if (action === "preview") {
    return jsonResponse({
      ok: true, action: "preview", email_sent: false,
      account: ACCOUNT, recipient,
      diff: {
        plan_name: [src.plan_name, PLAN_NAME],
        speed_bucket: [src.speed_bucket, "essential"],
        estimated_download_speed: [src.estimated_download_speed, 80],
        estimated_upload_speed: [src.estimated_upload_speed, 20],
        monthly_price_incl_vat: [oldPrice, newPrice],
      },
      unchanged: {
        contract_length: src.contract_length,
        notice_period_days: src.notice_period_days,
        cease_cancellation_charges: src.cease_cancellation_charges,
        router_option: src.router_option,
        setup_option: src.setup_option,
        selected_addons: src.selected_addons,
        one_off_charges_json: src.one_off_charges_json,
        etf_policy_snapshot: src.etf_policy_snapshot,
      },
      new_speed_notes: SPEED_NOTES,
      email_html: buildEmail({
        firstName, csNumber: "CS-XXXX-preview", version: Number(src.version ?? 1) + 1,
        address, oldPrice, newPrice,
        csUrl: "https://www.occta.co.uk/quote/contract-summary/PREVIEW-TOKEN",
        daysValid,
      }),
    });
  }

  // ── Locate or create the revision ──
  const { data: existing } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("supersedes_id", src.id)
    .in("status", ["draft", "issued", "viewed"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  let created = existing;
  let raw: string | null = null;
  let tokenExpiresAt: string;

  const nowIso = new Date().toISOString();

  if (!created) {
    if (action === "send") {
      return jsonResponse({ error: "not_prepared", message: "Run action:prepare first." }, 409);
    }
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) if (!DROP.has(k)) row[k] = v;

    const pair = await generateTokenPair();
    raw = pair.raw;
    tokenExpiresAt = new Date(Date.now() + daysValid * 86_400_000).toISOString();

    Object.assign(row, {
      plan_name: PLAN_NAME,
      speed_bucket: "essential",
      estimated_download_speed: 80,
      estimated_upload_speed: 20,
      speed_notes: SPEED_NOTES,
      monthly_price_incl_vat: NEW_PRICE_INCL_VAT,
      version: Number(src.version ?? 1) + 1,
      status: "issued",
      document_status: "issued",
      supersedes_id: src.id,
      public_token_hash: pair.hash,
      token_expires_at: tokenExpiresAt,
      issued_at: nowIso,
      is_information_update: false,
    });

    const { data: ins, error: insErr } = await supabase
      .from("contract_summaries").insert(row).select("*").single();
    if (insErr) return jsonResponse({ error: "create_failed", details: insErr.message }, 500);
    created = ins;
  } else {
    // Re-mint a fresh signing token so the link is guaranteed live.
    const pair = await generateTokenPair();
    raw = pair.raw;
    tokenExpiresAt = new Date(Date.now() + daysValid * 86_400_000).toISOString();
    const { error: updErr } = await supabase
      .from("contract_summaries")
      .update({ public_token_hash: pair.hash, token_expires_at: tokenExpiresAt })
      .eq("id", created.id);
    if (updErr) return jsonResponse({ error: "token_rotate_failed", details: updErr.message }, 500);
  }

  // ── Immutable PDF ──
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const pdfRes = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
    body: JSON.stringify({ contract_summary_id: created.id, internal: true, actor_id: actorId }),
  });
  if (!pdfRes.ok) {
    const body = await pdfRes.text().catch(() => "");
    return jsonResponse({ error: "pdf_generation_failed", contract_summary_id: created.id, details: body.slice(0, 300) }, 502);
  }

  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";
  const csUrl = `${appBase}/quote/contract-summary/${raw}`;

  const html = buildEmail({
    firstName,
    csNumber: String(created.cs_number),
    version: Number(created.version),
    address, oldPrice, newPrice, csUrl, daysValid,
  });

  if (action === "prepare") {
    return jsonResponse({
      ok: true, action: "prepare", email_sent: false,
      contract_summary_id: created.id,
      cs_number: created.cs_number,
      version: created.version,
      signing_url: csUrl,
      token_expires_at: tokenExpiresAt,
      email_html: html,
    });
  }

  // ── SEND ──
  const send = await sendResendEmail({
    to: recipient,
    subject: `${firstName}, we got your broadband speed wrong — your revised OCCTA contract (and a discount)`,
    html,
    replyTo: "hello@occta.co.uk",
  });

  await supabase.from("communications_log").insert({
    user_id: created.customer_id,
    template_name: "contract_summary_revised_speed_apology",
    recipient_email: recipient,
    status: send.ok ? "sent" : "failed",
    sent_at: send.ok ? new Date().toISOString() : null,
    error_message: send.ok ? null : ((send as { error?: string }).error ?? "send_failed"),
    metadata: {
      account_number: ACCOUNT,
      contract_summary_id: created.id,
      cs_number: created.cs_number,
      cs_version: created.version,
      supersedes_id: src.id,
      supersedes_cs_number: src.cs_number,
      reason: "FTTP unavailable at address — moved to SOGEA 80/20 with goodwill discount",
      new_monthly_price_incl_vat: NEW_PRICE_INCL_VAT,
      sent_by_admin: actorId,
    },
  });

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: send.ok ? "contract_summary_revision_sent" : "contract_summary_revision_send_failed",
    _title: `Revised CS ${created.cs_number} v${created.version} — SOGEA 80/20 remediation (${ACCOUNT})`,
    _details: { supersedes_id: src.id, new_price: NEW_PRICE_INCL_VAT, emailed: send.ok },
    _source_module: "contract_summary",
    _quote_id: created.quote_id,
    _contract_summary_id: created.id,
    _customer_id: created.customer_id,
  }).then(() => {}).catch(() => {});

  if (!send.ok) {
    return jsonResponse({ error: "email_failed", contract_summary_id: created.id, details: (send as { error?: string }).error }, 502);
  }

  return jsonResponse({
    ok: true, action: "send", email_sent: true,
    contract_summary_id: created.id,
    cs_number: created.cs_number,
    version: created.version,
    signing_url: csUrl,
    recipient_masked: recipient.replace(/(.).+?(@.+)/, "$1***$2"),
    token_expires_at: tokenExpiresAt,
  });
});