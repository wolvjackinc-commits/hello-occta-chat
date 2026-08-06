import { corsHeaders, jsonResponse, getServiceClient, sha256Hex } from "../_shared/quoteHelpers.ts";
import {
  MAX_VERIFY_ATTEMPTS,
  OTP_VERIFY_URL,
  hashMobile,
  maskMobile,
  normaliseUkMobile,
  resolveJourneyContext,
  smsWorksJwt,
} from "../_shared/contractOtp.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  token: z.string().min(16),
  challenge_id: z.string().uuid(),
  passcode: z.string().trim().regex(/^\d{6}$/),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "invalid_code" }, 400);
  const { token, challenge_id, passcode } = parsed.data;

  const supabase = getServiceClient();
  const ctx = await resolveJourneyContext(await sha256Hex(token));
  if (!ctx.ok) return jsonResponse({ error: ctx.error }, ctx.status);
  if (ctx.signed) return jsonResponse({ error: "already_signed" }, 409);

  const normalised = normaliseUkMobile(ctx.mobile);
  if (!normalised) return jsonResponse({ error: "invalid_mobile" }, 400);
  const phoneHash = await hashMobile(normalised);

  const { data: ch } = await supabase
    .from("sms_otp_challenges")
    .select("*")
    .eq("challenge_id", challenge_id)
    .maybeSingle();
  if (!ch) return jsonResponse({ error: "expired" }, 410);
  if (ch.session_or_order_reference !== ctx.journeyId || ch.journey_type !== ctx.journeyType) {
    return jsonResponse({ error: "expired" }, 410);
  }
  if (ch.phone_hash !== phoneHash) return jsonResponse({ error: "mobile_changed" }, 409);
  if (ch.verified_at) {
    return jsonResponse({ ok: true, verified: true, phone_masked: ch.phone_masked });
  }
  if (new Date(ch.expires_at).getTime() <= Date.now()) return jsonResponse({ error: "expired" }, 410);
  if ((ch.verify_attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return jsonResponse({ error: "attempts_exceeded" }, 429);
  }

  const jwt = smsWorksJwt();
  if (!jwt) {
    console.error("[verify-contract-otp] SMS_WORKS_JWT missing");
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }

  // Count the attempt before calling out, so retries cannot be farmed.
  await supabase
    .from("sms_otp_challenges")
    .update({ verify_attempts: (ch.verify_attempts ?? 0) + 1 })
    .eq("id", ch.id);

  let body: Record<string, unknown> = {};
  try {
    const res = await fetch(OTP_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: jwt },
      // The passcode is forwarded only; never stored or logged.
      body: JSON.stringify({ passcode }),
    });
    body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok && res.status >= 500) {
      console.error("[verify-contract-otp] provider error", res.status);
      return jsonResponse({ error: "provider_unavailable" }, 503);
    }
  } catch (e) {
    console.error("[verify-contract-otp] provider request failed", (e as Error).message);
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }

  const status = String(body.status ?? "").toUpperCase();
  const returnedMessageId = String((body.messageid ?? body.messageId ?? "") as string);
  const meta = (body.metadata ?? {}) as Record<string, unknown>;
  const metaChallenge = String(meta.challenge_id ?? "");

  const matches =
    status === "VERIFIED" &&
    (!ch.sms_message_id || returnedMessageId === ch.sms_message_id) &&
    (!metaChallenge || metaChallenge === challenge_id);

  if (!matches) {
    return jsonResponse({ error: "incorrect_code" }, 400);
  }

  const verifiedAt = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("sms_otp_challenges")
    .update({ verified_at: verifiedAt })
    .eq("id", ch.id)
    .is("verified_at", null);
  if (upErr) return jsonResponse({ error: "verify_failed" }, 500);

  try {
    await supabase.from("audit_logs").insert({
      action: "contract_otp_verified",
      entity: "order_journey",
      entity_id: ctx.journeyId,
      metadata: {
        journey_type: ctx.journeyType,
        phone_masked: ch.phone_masked,
        sms_message_id: ch.sms_message_id,
        verified_at: verifiedAt,
      },
    });
  } catch { /* audit best-effort */ }

  return jsonResponse({ ok: true, verified: true, phone_masked: maskMobile(normalised) });
});