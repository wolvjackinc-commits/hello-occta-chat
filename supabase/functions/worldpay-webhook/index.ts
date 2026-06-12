import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wp-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -------------------- Access Enterprise (HMAC) legacy path --------------------
async function verifyHmacSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (signature.length !== expected.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return result === 0;
  } catch (err) {
    console.error("HMAC verify error:", err);
    return false;
  }
}

// -------------------- SMB event validation --------------------
type SmbAmount = { value: number; currencyCode: string };
type SmbValidated = {
  eventId: string;
  eventTimestamp: string;
  type: string;
  transactionReference: string;
  amount: SmbAmount | null;
};

// Events allowed on the SMB eCommerce webhook. Only `sentForSettlement`
// is permitted to mark a payment as paid.
const SETTLE_EVENT = "sentForSettlement";
const KNOWN_EVENTS = new Set([
  "sentForAuthorization",
  "authorized",
  SETTLE_EVENT,
  "refused",
  "cancelled",
  "expired",
  "error",
]);
const REQUIRES_AMOUNT = new Set([SETTLE_EVENT]);

function validateSmbShape(
  payload: unknown,
):
  | { ok: false; status: number; missing: string[] }
  | { ok: true; data: SmbValidated } {
  const missing: string[] = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, missing: ["body"] };
  }
  const p = payload as Record<string, any>;

  if (typeof p.eventId !== "string" || !p.eventId) missing.push("eventId");
  if (typeof p.eventTimestamp !== "string" || !p.eventTimestamp)
    missing.push("eventTimestamp");

  const details = p.eventDetails;
  if (!details || typeof details !== "object") {
    missing.push("eventDetails");
    return { ok: false, status: 400, missing };
  }
  if (details.classification !== "payment")
    missing.push("eventDetails.classification=payment");
  if (typeof details.type !== "string" || !details.type)
    missing.push("eventDetails.type");
  if (
    typeof details.transactionReference !== "string" ||
    !details.transactionReference
  )
    missing.push("eventDetails.transactionReference");

  if (missing.length) return { ok: false, status: 400, missing };

  let amount: SmbAmount | null = null;
  if (
    details.amount &&
    typeof details.amount === "object" &&
    typeof details.amount.value === "number" &&
    typeof details.amount.currencyCode === "string"
  ) {
    amount = {
      value: details.amount.value,
      currencyCode: details.amount.currencyCode,
    };
  }

  // Settlement event must carry amount/currency.
  if (REQUIRES_AMOUNT.has(details.type) && !amount) {
    return {
      ok: false,
      status: 400,
      missing: ["eventDetails.amount.value", "eventDetails.amount.currencyCode"],
    };
  }

  return {
    ok: true,
    data: {
      eventId: p.eventId,
      eventTimestamp: p.eventTimestamp,
      type: details.type,
      transactionReference: details.transactionReference,
      amount,
    },
  };
}

// -------------------- Server --------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const gateway = (Deno.env.get("WORLDPAY_GATEWAY_TYPE") || "smb_ecommerce")
    .toLowerCase();
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.text();
  const payloadSha256 = await sha256Hex(body);

  // Access Enterprise (HMAC) — preserved for forward compatibility.
  if (gateway === "access_enterprise") {
    const webhookSecret = Deno.env.get("WORLDPAY_WEBHOOK_SECRET");
    const signature =
      req.headers.get("x-wp-signature") || req.headers.get("X-WP-Signature");
    if (!webhookSecret) {
      await supabase.from("audit_logs").insert({
        action: "worldpay_webhook_missing_secret",
        entity: "payment",
        metadata: { gateway, payload_sha256: payloadSha256 },
      });
      return json(500, { error: "Webhook configuration error" });
    }
    const valid = await verifyHmacSignature(body, signature, webhookSecret);
    if (!valid) {
      await supabase.from("audit_logs").insert({
        action: "worldpay_webhook_invalid_signature",
        entity: "payment",
        metadata: { gateway, hasSignature: !!signature },
      });
      return json(401, { error: "Invalid signature" });
    }
    // Fall through to SMB-style processing for parity; both shapes now use
    // strict reference/amount validation. Worldpay Access uses a similar
    // event envelope.
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_malformed",
      entity: "payment",
      metadata: { gateway, payload_sha256: payloadSha256 },
    });
    return json(400, { error: "Malformed JSON" });
  }

  const shape = validateSmbShape(parsed);
  if (!shape.ok) {
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_invalid_shape",
      entity: "payment",
      metadata: { gateway, missing: shape.missing, payload_sha256: payloadSha256 },
    });
    return json(shape.status, { error: "Invalid payload", missing: shape.missing });
  }

  const ev = shape.data;

  // Unsupported event type → 200 no-op (safe).
  if (!KNOWN_EVENTS.has(ev.type)) {
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_unsupported_event",
      entity: "payment",
      metadata: {
        gateway,
        type: ev.type,
        eventId: ev.eventId,
        transactionReference: ev.transactionReference,
        payload_sha256: payloadSha256,
      },
    });
    return json(200, { received: true, ignored: true });
  }

  // Locate the payment request by exact provider_reference match.
  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .select(
      "id, status, amount, currency, contract_summary_id, webhook_verified, metadata",
    )
    .eq("provider_reference", ev.transactionReference)
    .maybeSingle();

  if (prErr) {
    console.error("payment_requests lookup error", prErr);
    return json(200, { received: true, error: "lookup_error" });
  }
  if (!pr) {
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_unknown_reference",
      entity: "payment",
      metadata: {
        gateway,
        eventId: ev.eventId,
        transactionReference: ev.transactionReference,
        type: ev.type,
        payload_sha256: payloadSha256,
      },
    });
    return json(200, { received: true, unknown_reference: true });
  }

  // CS-linked guard — all live PRs in this phase must be CS-linked.
  if (!pr.contract_summary_id) {
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_non_cs_linked_rejected",
      entity: "payment_request",
      entity_id: pr.id,
      metadata: {
        gateway,
        eventId: ev.eventId,
        type: ev.type,
        payload_sha256: payloadSha256,
      },
    });
    return json(200, { received: true, rejected: "non_cs_linked" });
  }

  // Idempotency: dedupe by eventId across this PR's event log.
  const { data: existingEvents } = await supabase
    .from("payment_request_events")
    .select("id, metadata")
    .eq("request_id", pr.id);
  const isDuplicateEventId = (existingEvents ?? []).some(
    (row: any) => row?.metadata?.eventId === ev.eventId,
  );
  if (isDuplicateEventId) {
    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "duplicate_webhook",
      metadata: {
        eventId: ev.eventId,
        type: ev.type,
        gateway,
      },
    });
    return json(200, { received: true, duplicate: true });
  }

  // Terminal-paid is immutable; record duplicate and return.
  const isTerminalPaid = pr.status === "paid" || pr.status === "completed";

  // Optional amount/currency check — strict only on settlement event.
  const expectedMinor = Math.round(Number(pr.amount || 0) * 100);
  const expectedCurrency = String(pr.currency || "GBP").toUpperCase();
  const providerMinor = ev.amount?.value ?? null;
  const providerCurrency = ev.amount?.currencyCode?.toUpperCase() ?? null;

  if (
    ev.amount &&
    (providerMinor !== expectedMinor || providerCurrency !== expectedCurrency)
  ) {
    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "webhook_amount_mismatch",
      metadata: {
        eventId: ev.eventId,
        type: ev.type,
        providerMinor,
        expectedMinor,
        providerCurrency,
        expectedCurrency,
        gateway,
      },
    });
    await supabase.from("audit_logs").insert({
      action: "worldpay_webhook_amount_mismatch",
      entity: "payment_request",
      entity_id: pr.id,
      metadata: {
        gateway,
        eventId: ev.eventId,
        type: ev.type,
        providerMinor,
        expectedMinor,
        providerCurrency,
        expectedCurrency,
        payload_sha256: payloadSha256,
      },
    });
    return json(200, { received: true, mismatch: true });
  }

  const nowIso = new Date().toISOString();
  const baseMeta = (pr.metadata && typeof pr.metadata === "object") ? pr.metadata : {};

  // ----- Event routing -----
  if (ev.type === "sentForAuthorization") {
    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "sent_for_authorization",
      metadata: {
        eventId: ev.eventId,
        gateway,
        eventTimestamp: ev.eventTimestamp,
      },
    });
    return json(200, { received: true });
  }

  if (ev.type === "authorized") {
    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "authorized_pending_settlement",
      metadata: {
        eventId: ev.eventId,
        gateway,
        eventTimestamp: ev.eventTimestamp,
        amount_minor: providerMinor,
        currency: providerCurrency,
      },
    });
    // Record provider state in metadata only; do not change status.
    if (!isTerminalPaid) {
      await supabase
        .from("payment_requests")
        .update({
          updated_at: nowIso,
          metadata: {
            ...baseMeta,
            last_provider_event: "authorized",
            last_event_id: ev.eventId,
          },
        })
        .eq("id", pr.id);
    }
    return json(200, { received: true, authorized: true });
  }

  if (ev.type === SETTLE_EVENT) {
    if (isTerminalPaid) {
      await supabase.from("payment_request_events").insert({
        request_id: pr.id,
        event_type: "duplicate_webhook",
        metadata: { eventId: ev.eventId, type: ev.type, gateway },
      });
      return json(200, { received: true, already_paid: true });
    }

    const { error: updErr } = await supabase
      .from("payment_requests")
      .update({
        status: "paid",
        paid_at: nowIso,
        completed_at: nowIso,
        webhook_verified: true,
        provider_payment_id: ev.transactionReference,
        updated_at: nowIso,
        metadata: {
          ...baseMeta,
          last_provider_event: SETTLE_EVENT,
          last_event_id: ev.eventId,
        },
      })
      .eq("id", pr.id)
      .not("status", "in", "(paid,completed)");

    if (updErr) {
      console.error("Failed to mark PR paid:", updErr);
      return json(200, { received: true, error: "update_failed" });
    }

    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "paid_via_webhook",
      metadata: {
        eventId: ev.eventId,
        transactionReference: ev.transactionReference,
        amount_minor: providerMinor,
        currency: providerCurrency,
        gateway,
        payload_sha256: payloadSha256,
      },
    });
    await supabase.from("audit_logs").insert({
      action: "payment_received_webhook",
      entity: "payment_request",
      entity_id: pr.id,
      metadata: {
        gateway,
        eventId: ev.eventId,
        amount_minor: providerMinor,
        currency: providerCurrency,
        cs_linked: true,
      },
    });

    // NOTE: Phase E payment verification only. DO NOT create invoices,
    // services, supplier orders, DD mandates, installation bookings or
    // provisioning rows here. DO NOT send automatic emails.
    return json(200, { received: true, paid: true });
  }

  // refused / cancelled / expired / error
  if (
    ev.type === "refused" ||
    ev.type === "cancelled" ||
    ev.type === "expired" ||
    ev.type === "error"
  ) {
    if (isTerminalPaid) {
      // Never override a paid terminal state.
      await supabase.from("payment_request_events").insert({
        request_id: pr.id,
        event_type: "post_paid_failure_ignored",
        metadata: { eventId: ev.eventId, type: ev.type, gateway },
      });
      return json(200, { received: true, already_paid: true });
    }
    const newStatus = ev.type === "cancelled" ? "cancelled" : "failed";
    await supabase
      .from("payment_requests")
      .update({
        status: newStatus,
        failed_at: nowIso,
        updated_at: nowIso,
        metadata: {
          ...baseMeta,
          last_provider_event: ev.type,
          last_event_id: ev.eventId,
        },
      })
      .eq("id", pr.id)
      .not("status", "in", "(paid,completed)");

    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type:
        ev.type === "cancelled" ? "cancelled_via_webhook" : "failed_via_webhook",
      metadata: {
        eventId: ev.eventId,
        type: ev.type,
        gateway,
        amount_minor: providerMinor,
        currency: providerCurrency,
      },
    });
    return json(200, { received: true, status: newStatus });
  }

  // Should be unreachable (KNOWN_EVENTS check above).
  return json(200, { received: true });
});