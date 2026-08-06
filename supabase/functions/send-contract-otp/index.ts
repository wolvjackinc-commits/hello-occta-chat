import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp, checkRateLimit } from "../_shared/quoteHelpers.ts";
import {
  MAX_SENDS_PER_HOUR,
  MIN_RESEND_SECONDS,
  OTP_SEND_URL,
  OTP_SENDER,
  OTP_TEMPLATE,
  OTP_VALIDITY_SECONDS,
  hashMobile,
  maskMobile,
  normaliseUkMobile,
  otpRequired,
  resolveJourneyContext,
  smsWorksJwt,
} from "../_shared/contractOtp.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  token: z.string().min(16),
  action: z.enum(["status", "send"]).default("send"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "invalid_request" }, 400);
  const { token, action } = parsed.data;

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(token);
  const ctx = await resolveJourneyContext(tokenHash);
  if (!ctx.ok) return jsonResponse({ error: ctx.error }, ctx.status);
  if (ctx.signed) return jsonResponse({ error: "already_signed" }, 409);

  const required = await otpRequired(supabase);
  const normalised = normaliseUkMobile(ctx.mobile);
  if (!normalised) {
    return jsonResponse({ error: "invalid_mobile", required }, 400);
  }
  const phoneMasked = maskMobile(normalised);
  const phoneHash = await hashMobile(normalised);

  // Latest challenge for this journey + this exact number.
  const { data: latest } = await supabase
    .from("sms_otp_challenges")
    .select("*")
    .eq("session_or_order_reference", ctx.journeyId)
    .eq("journey_type", ctx.journeyType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const active =
    latest && latest.phone_hash === phoneHash && new Date(latest.expires_at).getTime() > now
      ? latest
      : null;

  if (action === "status") {
    return jsonResponse({
      ok: true,
      required,
      phone_masked: phoneMasked,
      verified: !!(active?.verified_at),
      challenge_id: active && !active.verified_at ? active.challenge_id : null,
      expires_in: active ? Math.max(0, Math.floor((new Date(active.expires_at).getTime() - now) / 1000)) : 0,
      resend_in: active
        ? Math.max(0, MIN_RESEND_SECONDS - Math.floor((now - new Date(active.last_sent_at).getTime()) / 1000))
        : 0,
    });
  }

  if (active?.verified_at) {
    return jsonResponse({ ok: true, already_verified: true, phone_masked: phoneMasked, verified: true });
  }

  // Throttles: min gap between sends, and max sends per journey per hour.
  if (active) {
    const since = Math.floor((now - new Date(active.last_sent_at).getTime()) / 1000);
    if (since < MIN_RESEND_SECONDS) {
      return jsonResponse({ error: "too_soon", retry_after: MIN_RESEND_SECONDS - since }, 429);
    }
    if ((active.send_attempts ?? 1) >= MAX_SENDS_PER_HOUR) {
      return jsonResponse({ error: "send_limit_reached" }, 429);
    }
  }
  const hourAgo = new Date(now - 3600_000).toISOString();
  const { count: recentSends } = await supabase
    .from("sms_otp_challenges")
    .select("id", { count: "exact", head: true })
    .eq("session_or_order_reference", ctx.journeyId)
    .gte("last_sent_at", hourAgo);
  if ((recentSends ?? 0) >= MAX_SENDS_PER_HOUR && !active) {
    return jsonResponse({ error: "send_limit_reached" }, 429);
  }
  const ip = getRequestIp(req);
  if (ip) {
    const rl = await checkRateLimit(`otp:${ip}`, "send_contract_otp", 10, 60);
    if (!rl.allowed) return jsonResponse({ error: "send_limit_reached" }, 429);
  }

  const jwt = smsWorksJwt();
  if (!jwt) {
    console.error("[send-contract-otp] SMS_WORKS_JWT missing — cannot send");
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }

  const challengeId = active?.challenge_id ?? crypto.randomUUID();
  let providerMessageId: string | null = null;
  try {
    const res = await fetch(OTP_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: jwt },
      body: JSON.stringify({
        sender: OTP_SENDER,
        destination: normalised,
        length: 6,
        template: OTP_TEMPLATE,
        validity: OTP_VALIDITY_SECONDS,
        metadata: { challenge_id: challengeId, purpose: "contract-signing" },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log status only — never credentials or provider payloads containing codes.
      console.error("[send-contract-otp] provider error", res.status, String((body as { message?: string })?.message ?? "").slice(0, 120));
      return jsonResponse({ error: "provider_unavailable" }, 503);
    }
    providerMessageId = (body as { messageid?: string; messageId?: string }).messageid
      ?? (body as { messageId?: string }).messageId ?? null;
  } catch (e) {
    console.error("[send-contract-otp] provider request failed", (e as Error).message);
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }

  const expiresAt = new Date(now + OTP_VALIDITY_SECONDS * 1000).toISOString();
  if (active) {
    await supabase
      .from("sms_otp_challenges")
      .update({
        sms_message_id: providerMessageId,
        expires_at: expiresAt,
        last_sent_at: new Date(now).toISOString(),
        send_attempts: (active.send_attempts ?? 1) + 1,
      })
      .eq("id", active.id);
  } else {
    // One active challenge per journey: expire any older ones.
    await supabase
      .from("sms_otp_challenges")
      .update({ expires_at: new Date(now).toISOString() })
      .eq("session_or_order_reference", ctx.journeyId)
      .is("verified_at", null)
      .gt("expires_at", new Date(now).toISOString());
    const { error } = await supabase.from("sms_otp_challenges").insert({
      challenge_id: challengeId,
      journey_type: ctx.journeyType,
      session_or_order_reference: ctx.journeyId,
      phone_masked: phoneMasked,
      phone_hash: phoneHash,
      sms_message_id: providerMessageId,
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[send-contract-otp] challenge insert failed", error.message);
      return jsonResponse({ error: "send_failed" }, 500);
    }
  }

  return jsonResponse({
    ok: true,
    resent: !!active,
    challenge_id: challengeId,
    phone_masked: phoneMasked,
    expires_in: OTP_VALIDITY_SECONDS,
    resend_in: MIN_RESEND_SECONDS,
  });
});