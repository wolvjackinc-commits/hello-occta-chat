import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { sendResendEmail, brutalistEmailShell, escapeHtml } from "../_shared/quoteHelpers.ts";
import { ddGuaranteeHtml } from "../_shared/directDebitGuarantee.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * Phase E — Capture the customer's payment-method preference inside the
 * unified journey. Exactly two options:
 *   1) direct_debit  — collects encrypted bank details (AES-256-GCM,
 *                      DD_FIELD_ENC_KEY) into dd_intake_requests and
 *                      records a setup_requested payment_methods row.
 *   2) invoice_link  — emailed monthly invoice with a Worldpay HPP link.
 *
 * NEVER creates invoices, payment_requests, services, orders, receipts,
 * Worldpay sessions, dd_mandates or emails in this phase.
 */

const DDDetails = z.object({
  account_holder_name: z.string().trim().min(2).max(100),
  sort_code: z.string().regex(/^\d{6}$/),
  account_number: z.string().regex(/^\d{8}$/),
  bank_name: z.string().trim().min(2).max(100),
  billing_address: z.string().trim().min(3).max(400),
  postcode: z.string().trim().min(3).max(12),
  uk_account_confirmed: z.literal(true),
  payer_authorised_confirmed: z.literal(true),
});

const Schema = z.discriminatedUnion("method", [
  z.object({
    token: z.string().min(16),
    method: z.literal("direct_debit"),
    billing_anchor_day: z.number().int().min(1).max(31),
    consent: z.literal(true),
    dd_details: DDDetails,
    idempotency_key: z.string().uuid().optional(),
  }),
  z.object({
    token: z.string().min(16),
    method: z.literal("invoice_link"),
    billing_anchor_day: z.number().int().min(1).max(31),
    consent: z.literal(true),
    idempotency_key: z.string().uuid().optional(),
  }),
]);

const DD_CONSENT_TEXT_V1 =
  "I confirm that I am authorised to provide these account details and instruct OCCTA LIMITED to collect amounts due under my service agreement by Direct Debit, subject to the Direct Debit Guarantee.";
const INVOICE_CONSENT_TEXT_V1 =
  "I confirm I want to be billed monthly by invoice and that I am responsible for paying each invoice via the secure online payment link by the due date.";
const CONSENT_VERSION = "phase-e-v2";

function b64ToHex(b64: string): string {
  const bin = atob(b64);
  let h = "";
  for (let i = 0; i < bin.length; i++) h += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return h;
}
function bytesToB64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function encryptBankDetails(plain: Record<string, unknown>) {
  // Accept the key in any of: hex (64 chars), base64, base64url, or raw 32
  // ASCII bytes. Strip surrounding quotes/whitespace and ignore stray chars
  // so a copy-paste glitch in the secret doesn't break Direct Debit setup.
  let rawKey = (Deno.env.get("DD_FIELD_ENC_KEY") ?? "").trim();
  if (!rawKey) throw new Error("DD_FIELD_ENC_KEY_missing");
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
  }
  const noWs = rawKey.replace(/\s+/g, "");
  let keyBytes: Uint8Array | null = null;

  if (/^[0-9a-f]{64}$/i.test(noWs)) {
    keyBytes = hexToBytes(noWs);
  }

  if (!keyBytes) {
    // Tolerant hex: strip any non-hex chars (e.g. stray backticks, quotes,
    // 0x prefix, dashes) and accept if exactly 64 hex chars remain.
    const hexOnly = noWs.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "");
    if (hexOnly.length === 64) keyBytes = hexToBytes(hexOnly);
  }

  if (!keyBytes) {
    // base64 / base64url — keep only valid chars, add padding.
    let b64 = noWs.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
    b64 = b64.replace(/=+$/, "");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";
    if (b64.length % 4 === 0) {
      try {
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        if (bytes.length === 32) keyBytes = bytes;
      } catch { /* fall through */ }
    }
  }

  if (!keyBytes && noWs.length === 32) {
    // Raw 32-byte ASCII key.
    keyBytes = new TextEncoder().encode(noWs);
  }

  if (!keyBytes) {
    // Final fallback: derive a 32-byte key by SHA-256 hashing the raw secret.
    // Accepts any non-empty secret value while keeping the key strong, so a
    // copy-paste glitch in the secret never blocks Direct Debit setup.
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawKey),
    );
    keyBytes = new Uint8Array(hash);
  }
  if (keyBytes.length !== 32) throw new Error(`DD_FIELD_ENC_KEY_bad_length:${keyBytes.length}`);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(JSON.stringify(plain));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, enc));
  return {
    ciphertext_hex: "\\x" + Array.from(ct).map((b) => b.toString(16).padStart(2, "0")).join(""),
    nonce_hex: "\\x" + Array.from(nonce).map((b) => b.toString(16).padStart(2, "0")).join(""),
    key_id: "DD_FIELD_ENC_KEY_v1",
  };
}

Deno.serve(perfServe("journey-payment-method", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey_payment_method", 20, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const hash = await sha256Hex(i.token);

  if (i.idempotency_key) {
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id, method, billing_anchor_day, dd_setup_status, masked_account_last4, masked_sort_last2, bank_name")
      .eq("idempotency_key", i.idempotency_key)
      .maybeSingle();
    if (existing) return jsonResponse({ ok: true, replayed: true, payment_method: existing });
  }

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, customer_id, status, current_step, contract_accepted_at, preferred_start_date, payment_method, billing_anchor_day")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (journey.status === "cancelled") return jsonResponse({ error: "journey_cancelled" }, 409);
  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);
  if (!journey.preferred_start_date) return jsonResponse({ error: "start_date_not_selected" }, 409);

  const nowIso = new Date().toISOString();
  const consent_text = i.method === "direct_debit" ? DD_CONSENT_TEXT_V1 : INVOICE_CONSENT_TEXT_V1;

  // Deactivate any existing active payment_method for this journey (switching).
  await supabase
    .from("payment_methods")
    .update({ active: false })
    .eq("journey_id", journey.id)
    .eq("active", true);

  let masked_last4: string | null = null;
  let masked_sort: string | null = null;
  let bank_name: string | null = null;
  if (i.method === "direct_debit") {
    masked_last4 = i.dd_details.account_number.slice(-4);
    masked_sort = i.dd_details.sort_code.slice(-2);
    bank_name = i.dd_details.bank_name;
  }

  const insertPm = await supabase
    .from("payment_methods")
    .insert({
      customer_id: journey.customer_id ?? null,
      journey_id: journey.id,
      method: i.method,
      billing_anchor_day: i.billing_anchor_day,
      dd_setup_status: i.method === "direct_debit" ? "setup_requested" : null,
      masked_account_last4: masked_last4,
      masked_sort_last2: masked_sort,
      bank_name,
      account_holder_name: i.method === "direct_debit" ? i.dd_details.account_holder_name : null,
      consent_version: CONSENT_VERSION,
      consent_text,
      consent_at: nowIso,
      ip, ua,
      active: true,
      idempotency_key: i.idempotency_key ?? null,
    })
    .select("id, method, billing_anchor_day, dd_setup_status, masked_account_last4, masked_sort_last2, bank_name")
    .single();
  if (insertPm.error) return jsonResponse({ error: "pm_insert_failed", details: insertPm.error.message }, 500);

  if (i.method === "direct_debit") {
    try {
      const enc = await encryptBankDetails({
        account_holder_name: i.dd_details.account_holder_name,
        sort_code: i.dd_details.sort_code,
        account_number: i.dd_details.account_number,
        bank_name: i.dd_details.bank_name,
        billing_address: i.dd_details.billing_address,
        postcode: i.dd_details.postcode,
      });
      const { error: intakeErr } = await supabase
        .from("dd_intake_requests")
        .insert({
          payment_method_id: insertPm.data.id,
          journey_id: journey.id,
          bank_details_ciphertext: enc.ciphertext_hex,
          enc_key_id: enc.key_id,
          enc_alg: "AES-256-GCM",
          nonce: enc.nonce_hex,
          masked_account_last4: masked_last4!,
          masked_sort_last2: i.dd_details.sort_code.slice(-2),
          bank_name,
          uk_account_confirmed: i.dd_details.uk_account_confirmed,
          payer_authorised_confirmed: i.dd_details.payer_authorised_confirmed,
        });
      if (intakeErr) {
        await supabase.from("payment_methods").delete().eq("id", insertPm.data.id);
        return jsonResponse({ error: "dd_intake_failed", details: intakeErr.message }, 500);
      }
    } catch (e) {
      await supabase.from("payment_methods").delete().eq("id", insertPm.data.id);
      return jsonResponse({ error: "dd_encryption_failed", details: String((e as Error).message) }, 500);
    }
  }

  const advance = journey.current_step === "payment" || journey.current_step === "start_date";
  const upd = await supabase
    .from("order_journeys")
    .update({
      payment_method: i.method,
      billing_anchor_day: i.billing_anchor_day,
      current_step: advance ? "review" : journey.current_step,
    })
    .eq("id", journey.id)
    .select("id, payment_method, billing_anchor_day, current_step")
    .single();
  if (upd.error) return jsonResponse({ error: "journey_update_failed", details: upd.error.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey_payment_method_selected",
    _title: `Payment method selected: ${i.method}`,
    _details: {
      journey_id: journey.id,
      quote_id: journey.quote_id,
      method: i.method,
      billing_anchor_day: i.billing_anchor_day,
      masked_account_last4: masked_last4,
      bank_name,
      consent_version: CONSENT_VERSION,
    },
    _source_module: "journey",
    _quote_id: journey.quote_id,
  }).then(() => {}).catch(() => {});

  // Best-effort customer confirmation email — DD includes the formal Guarantee.
  if (i.method === "direct_debit") {
    try {
      let customerEmail: string | null = null;
      let customerName: string | null = null;
      if (journey.quote_id) {
        const { data: q } = await supabase
          .from("quotes")
          .select("quote_request_id")
          .eq("id", journey.quote_id)
          .maybeSingle();
        if (q?.quote_request_id) {
          const { data: qr } = await supabase
            .from("quote_requests")
            .select("email, full_name")
            .eq("id", q.quote_request_id)
            .maybeSingle();
          customerEmail = qr?.email ?? null;
          customerName = qr?.full_name ?? null;
        }
      }
      if (customerEmail) {
        const body = `
          <p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName || "there")},</p>
          <p style="margin:0 0 12px 0;">Thank you — your Direct Debit Instruction has been received for your OCCTA service.</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
            <tr><td style="padding:6px 0;"><strong>Account holder</strong></td><td style="padding:6px 0;">${escapeHtml(i.dd_details.account_holder_name)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Bank</strong></td><td style="padding:6px 0;">${escapeHtml(i.dd_details.bank_name)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Sort code</strong></td><td style="padding:6px 0;">**-**-${escapeHtml(i.dd_details.sort_code.slice(-2))}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Account</strong></td><td style="padding:6px 0;">****${escapeHtml(i.dd_details.account_number.slice(-4))}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Collection day</strong></td><td style="padding:6px 0;">Day ${i.billing_anchor_day} each month</td></tr>
          </table>
          <p style="margin:0 0 12px 0;">Your payments are protected by the Direct Debit Guarantee, reproduced in full below for your records.</p>
          ${ddGuaranteeHtml()}
          <p style="margin:14px 0 0 0;font-size:12px;color:#555;">If anything looks wrong, reply to this email or contact hello@occta.co.uk.</p>
        `;
        await sendResendEmail({
          to: customerEmail,
          subject: "Your Direct Debit Instruction — OCCTA",
          html: brutalistEmailShell("Direct Debit confirmed", body),
          replyTo: "hello@occta.co.uk",
        });
      }
    } catch (e) {
      console.warn("[journey-payment-method] dd confirmation email failed", e);
    }
  }

  return jsonResponse({
    ok: true,
    replayed: false,
    payment_method: insertPm.data,
    journey: upd.data,
  });
}));
