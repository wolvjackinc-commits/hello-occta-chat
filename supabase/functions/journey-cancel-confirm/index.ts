import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp, sendResendEmail, brutalistEmailShell, escapeHtml } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Phase G — Step 2 of cancellation.
 * Validates the single-use cancellation token, confirms the cooling-off window
 * is still open server-side, flips the journey to `cancelled`, writes an
 * immutable `confirmed` evidence event, and sends exactly one confirmation
 * email (best-effort). The DB trigger handles guest_orders status + admin task.
 *
 * Idempotent: a second call after the journey is already cancelled returns
 * `{ ok: true, already: true }` without re-sending email or creating events.
 */

const ALLOWED_REASONS = new Set([
  "changed_mind", "too_expensive", "found_alternative",
  "speed_too_slow", "address_not_ready", "contract_concerns",
  "no_longer_needed", "other",
]);

const CONFIRM_TEXT =
  "I confirm I want to cancel my OCCTA order during my 14-day cooling-off period.";
const CONFIRM_TEXT_VERSION = "v1.2026-06-16";

const Schema = z.object({
  token: z.string().min(16),
  cancellation_token: z.string().min(16),
  reason_code: z.string().min(1).max(64),
  reason_text: z.string().max(2000).optional().nullable(),
  confirm_text: z.literal(CONFIRM_TEXT),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { token, cancellation_token, reason_code, reason_text } = parsed.data;
  if (!ALLOWED_REASONS.has(reason_code)) return jsonResponse({ error: "invalid_reason" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey_cancel_confirm", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const journeyHash = await sha256Hex(token);
  const cancelHash = await sha256Hex(cancellation_token);

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, status, cooling_off_ends_at, cancellation_token_hash, cancellation_token_expires_at, cancellation_token_used_at")
    .eq("token_hash", journeyHash)
    .maybeSingle();

  if (!journey) return jsonResponse({ error: "not_found" }, 404);
  if (journey.status === "cancelled") return jsonResponse({ ok: true, already: true });
  if (journey.status !== "completed") return jsonResponse({ error: "not_cancellable" }, 409);

  const endsAt = journey.cooling_off_ends_at ? new Date(journey.cooling_off_ends_at).getTime() : 0;
  if (!endsAt || endsAt < Date.now()) {
    return jsonResponse({ error: "cooling_off_expired" }, 409);
  }
  if (!journey.cancellation_token_hash || journey.cancellation_token_hash !== cancelHash) {
    return jsonResponse({ error: "invalid_cancellation_token" }, 401);
  }
  if (journey.cancellation_token_used_at) {
    return jsonResponse({ error: "cancellation_token_used" }, 401);
  }
  const tokenExp = journey.cancellation_token_expires_at ? new Date(journey.cancellation_token_expires_at).getTime() : 0;
  if (!tokenExp || tokenExp < Date.now()) {
    return jsonResponse({ error: "cancellation_token_expired" }, 401);
  }

  // Atomic flip: only succeeds if status still 'completed' (guards against race).
  const flip = await supabase
    .from("order_journeys")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason_code,
      cancellation_notes: reason_text ?? null,
      cancellation_token_used_at: new Date().toISOString(),
      // wipe the token hash so it can never be replayed
      cancellation_token_hash: null,
      cancellation_token_expires_at: null,
    })
    .eq("id", journey.id)
    .eq("status", "completed")
    .select("id, cancelled_at, status")
    .maybeSingle();

  if (flip.error) return jsonResponse({ error: "cancel_failed", details: flip.error.message }, 500);
  if (!flip.data) return jsonResponse({ ok: true, already: true });

  // Evidence event (append-only).
  await supabase.from("journey_cancellation_events").insert({
    journey_id: journey.id,
    event_type: "confirmed",
    reason_code,
    reason_text: reason_text ?? null,
    confirmation_text_version: CONFIRM_TEXT_VERSION,
    ip, ua,
    actor_type: "public",
    details: { confirm_text_hash: await sha256Hex(CONFIRM_TEXT) },
  });

  // Resolve customer/order metadata for email (best-effort).
  let orderNumber: string | null = null;
  let customerName: string | null = null;
  let customerEmail: string | null = null;
  try {
    const { data: order } = await supabase
      .from("guest_orders")
      .select("order_number, email, full_name")
      .ilike("admin_notes", `%journey:${journey.id}%`)
      .maybeSingle();
    if (order) {
      orderNumber = order.order_number;
      customerName = order.full_name;
      customerEmail = order.email;
    }
  } catch (_) { /* swallow */ }

  // Single confirmation email.
  if (customerEmail) {
    try {
      const whenLondon = new Date(flip.data.cancelled_at as string)
        .toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" });
      const body = `
        <p>Hi ${escapeHtml(customerName ?? "there")},</p>
        <p>We've recorded your cancellation request${orderNumber ? ` for order <strong>${escapeHtml(orderNumber)}</strong>` : ""}.</p>
        <p><strong>Cancelled:</strong> ${escapeHtml(whenLondon)} (UK time)</p>
        <p>No further action is needed from you. If anything else is required, the OCCTA team will contact you directly.</p>
        <p style="font-size:13px;color:#444;">If you didn't request this cancellation, please reply to this email straight away.</p>
      `;
      const html = brutalistEmailShell("Your OCCTA order has been cancelled", body, {
        label: "Open your account",
        url: "https://www.occta.co.uk/dashboard",
      });
      const res = await sendResendEmail({
        to: customerEmail,
        subject: `Cancellation confirmed${orderNumber ? ` — ${orderNumber}` : ""} — OCCTA`,
        html,
        replyTo: "hello@occta.co.uk",
      });
      await supabase.from("journey_cancellation_events").insert({
        journey_id: journey.id,
        event_type: res.ok ? "email_sent" : "email_failed",
        actor_type: "system",
        details: res.ok ? null : { error: res.error },
      });
    } catch (e) {
      await supabase.from("journey_cancellation_events").insert({
        journey_id: journey.id,
        event_type: "email_failed",
        actor_type: "system",
        details: { error: String((e as Error).message).slice(0, 200) },
      });
    }
  }

  // Internal admin notification (best-effort).
  try {
    await supabase.functions.invoke("admin-notify", {
      body: {
        type: "customer_cancelled_order",
        data: {
          journey_id: journey.id,
          order_number: orderNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          reason_code,
          reason_text,
          cancelled_at: flip.data.cancelled_at,
          source: "unified_journey",
        },
      },
    });
  } catch (_) { /* swallow */ }

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey_cancelled",
    _title: `Cooling-off cancellation${orderNumber ? ` — ${orderNumber}` : ""}`,
    _details: { journey_id: journey.id, reason_code, order_number: orderNumber },
    _source_module: "journey",
  }).then(() => {}).catch(() => {});

  return jsonResponse({ ok: true, cancelled_at: flip.data.cancelled_at });
});
