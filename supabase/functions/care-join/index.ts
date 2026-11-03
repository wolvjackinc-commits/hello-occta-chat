// OCCTA Care sign-up. Signed-in customers only; every decision is re-made on
// the server (eligibility, price, first payment date, terms hash), and the
// subscription is created only by public.care_submit_application.
//
// Actions:
//   invite       — read a phone-assisted invite (pre-fills the choices)
//   start        — create a draft application; returns price, first payment
//                  date and the key facts, which are hashed and recorded as shown
//   send_code    — one-time code by SMS (The SMS Works) or email
//   verify_code  — check it
//   submit       — encrypt bank details and create the subscription
import { getServiceClient, jsonResponse, corsHeaders, getRequestIp, checkRateLimit, sha256Hex, sendTrackedCommunication, maskEmail } from "../_shared/quoteHelpers.ts";
import { OTP_SEND_URL, OTP_VERIFY_URL, OTP_SENDER, smsWorksJwt, maskMobile, normaliseUkMobile } from "../_shared/contractOtp.ts";
import { encryptJson } from "../_shared/ddCrypto.ts";
import { getCronSecret } from "../_shared/cronSecret.ts";
import { renderBrandedEmail } from "../_shared/brandedEmailShell.ts";
import { careKeyFacts, careTermsCanonicalText, CARE_TERMS_VERSION } from "../_shared/careTerms.ts";
import { longDate } from "../_shared/careLetters.ts";
import { careProvider } from "../_shared/careProvider.ts";

const CODE_TTL_SECONDS = 600;
const MIN_RESEND_SECONDS = 60;
const MAX_SENDS = 3;
const MAX_ATTEMPTS = 5;

async function userFrom(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data } = await getServiceClient().auth.getUser(auth.slice(7));
  return data?.user ?? null;
}

const hashOf = (s: string) => sha256Hex(`${Deno.env.get("SMS_OTP_HASH_SALT") ?? "care"}:${s}`);

async function kick() {
  try {
    const secret = await getCronSecret();
    if (!secret) return;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/care-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret, Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}` },
      body: "{}",
    });
  } catch { /* the 5-minute cron picks it up */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const user = await userFrom(req);
  if (!user) return jsonResponse({ error: "sign_in_required" }, 401);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const svc = getServiceClient();
  const ip = getRequestIp(req);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 500);

  if (!(await checkRateLimit(`care:${user.id}`, `care_join_${action}`, action === "verify_code" ? 15 : 20, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  // ------------------------------------------------------------------ invite
  if (action === "invite") {
    const token = String(body.invite_token ?? "");
    if (token.length < 20) return jsonResponse({ error: "invite_invalid" }, 400);
    const { data: inv } = await svc.from("care_invites").select("id, customer_id, plan_code, frequency, collection_day, expires_at, used_at, revoked_at")
      .eq("token_hash", await sha256Hex(token)).maybeSingle();
    if (!inv || inv.revoked_at || inv.used_at || new Date(inv.expires_at) < new Date()) return jsonResponse({ error: "invite_invalid" }, 404);
    if (inv.customer_id !== user.id) return jsonResponse({ error: "invite_other_account" }, 403);
    return jsonResponse({ ok: true, plan_code: inv.plan_code, frequency: inv.frequency, collection_day: inv.collection_day, expires_at: inv.expires_at });
  }

  // ------------------------------------------------------------------- start
  if (action === "start") {
    const token = body.invite_token ? String(body.invite_token) : null;
    const { data, error } = await svc.rpc("care_start_application", {
      p_customer: user.id, p_plan: String(body.plan ?? ""), p_frequency: String(body.frequency ?? ""),
      p_day: Number(body.collection_day ?? 1), p_invite_hash: token ? await sha256Hex(token) : null, p_ip: ip, p_ua: ua,
    });
    if (error) return jsonResponse({ error: "start_failed", detail: error.message }, 500);
    const r = data as Record<string, unknown>;
    if (!r?.ok) return jsonResponse(r, 400);
    const { data: appRow } = await svc.from("care_applications").select("provider_code").eq("id", r.application_id).maybeSingle();
    const prov = await careProvider(svc, appRow?.provider_code);
    const keyFacts = careKeyFacts({
      planCode: String(body.plan), frequency: String(body.frequency), priceMinor: Number(r.price_minor),
      collectionDay: Number(body.collection_day), firstCollectionDate: longDate(String(r.first_collection_date)), ddName: prov.name,
    });
    const sha = await sha256Hex(JSON.stringify(keyFacts));
    const { data: recorded } = await svc.rpc("care_record_key_facts", { p_application: r.application_id, p_customer: user.id, p_key_facts: keyFacts, p_sha: sha });
    if (!recorded) return jsonResponse({ error: "key_facts_not_recorded" }, 500);

    const { data: profile } = await svc.from("profiles").select("phone, email").eq("id", user.id).maybeSingle();
    const mobile = normaliseUkMobile(profile?.phone ?? null);
    return jsonResponse({
      dd: { name: prov.name, sun: prov.sun },
      ok: true, application_id: r.application_id, price_minor: r.price_minor, first_collection_date: r.first_collection_date,
      channel: r.channel, key_facts: keyFacts, key_facts_sha256: sha, terms_version: r.terms_version,
      date_of_birth_known: r.date_of_birth_known,
      verification: {
        sms: mobile && smsWorksJwt() ? maskMobile(mobile) : null,
        email: profile?.email ? maskEmail(profile.email) : null,
      },
    });
  }

  // --------------------------------------------------------------- send_code
  if (action === "send_code") {
    const appId = String(body.application_id ?? "");
    const method = body.method === "sms" ? "sms_otp" : "email_code";
    const { data: app } = await svc.from("care_applications").select("id, customer_id, status, expires_at").eq("id", appId).maybeSingle();
    if (!app || app.customer_id !== user.id || app.status !== "draft" || new Date(app.expires_at) < new Date()) return jsonResponse({ error: "application_not_found" }, 404);
    const { data: profile } = await svc.from("profiles").select("phone, email").eq("id", user.id).maybeSingle();

    const { data: prior } = await svc.from("care_verifications").select("*").eq("application_id", appId).eq("method", method)
      .is("verified_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (prior) {
      const since = (Date.now() - new Date(prior.last_sent_at).getTime()) / 1000;
      if (since < MIN_RESEND_SECONDS) return jsonResponse({ error: "too_soon", retry_after: Math.ceil(MIN_RESEND_SECONDS - since) }, 429);
      if (prior.send_count >= MAX_SENDS) return jsonResponse({ error: "send_limit_reached" }, 429);
    }

    if (method === "sms_otp") {
      const mobile = normaliseUkMobile(profile?.phone ?? null);
      const jwt = smsWorksJwt();
      if (!mobile || !jwt) return jsonResponse({ error: "sms_unavailable" }, 400);
      const challenge = crypto.randomUUID();
      const res = await fetch(OTP_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: jwt },
        body: JSON.stringify({
          sender: OTP_SENDER, destination: mobile, length: 6, validity: CODE_TTL_SECONDS,
          template: "Your OCCTA Care code is {{passcode}}. It confirms you want to join OCCTA Care. Expires in 10 minutes.",
          metadata: { challenge_id: challenge, purpose: "care-join" },
        }),
      }).catch(() => null);
      const pb = res ? await res.json().catch(() => ({})) as Record<string, unknown> : {};
      if (!res || !res.ok) return jsonResponse({ error: "provider_unavailable" }, 503);
      const messageId = String(pb.messageid ?? pb.messageId ?? "");
      if (prior) {
        await svc.from("care_verifications").update({ provider_challenge_id: messageId, send_count: prior.send_count + 1, last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(), verify_attempts: 0 }).eq("id", prior.id);
        return jsonResponse({ ok: true, verification_id: prior.id, destination: maskMobile(mobile), resend_in: MIN_RESEND_SECONDS });
      }
      const { data: row } = await svc.from("care_verifications").insert({
        application_id: appId, customer_id: user.id, method, destination_masked: maskMobile(mobile), destination_hash: await hashOf(mobile),
        provider_challenge_id: messageId, expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
      }).select("id").single();
      return jsonResponse({ ok: true, verification_id: row?.id, destination: maskMobile(mobile), resend_in: MIN_RESEND_SECONDS });
    }

    // Email code: we generate it, store only a salted hash, and send it.
    const email = profile?.email ?? user.email;
    if (!email) return jsonResponse({ error: "email_unavailable" }, 400);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const html = renderBrandedEmail({
      preheader: `Your OCCTA Care code is ${code}`,
      eyebrow: "OCCTA Care",
      greeting: "Your one-time code",
      intro: `<p style="margin:0 0 12px 0">Use this code to confirm you want to join OCCTA Care:</p><p style="font:700 32px/1 Arial,sans-serif;letter-spacing:6px;margin:0 0 12px 0">${code}</p><p style="margin:0">It expires in 10 minutes. If you didn't ask for this, you can ignore this email: nothing has been set up.</p>`,
      sections: [],
    });
    const sent = await sendTrackedCommunication(svc, {
      template_name: "care_join_code", recipient_email: email, subject: "Your OCCTA Care code", html, user_id: user.id,
      metadata: { application_id: appId },
    });
    if (!sent.ok) return jsonResponse({ error: "email_failed" }, 503);
    const codeHash = await hashOf(`${appId}:${code}`);
    if (prior) {
      await svc.from("care_verifications").update({ code_hash: codeHash, send_count: prior.send_count + 1, last_sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(), verify_attempts: 0 }).eq("id", prior.id);
      return jsonResponse({ ok: true, verification_id: prior.id, destination: maskEmail(email), resend_in: MIN_RESEND_SECONDS });
    }
    const { data: row } = await svc.from("care_verifications").insert({
      application_id: appId, customer_id: user.id, method, destination_masked: maskEmail(email), destination_hash: await hashOf(email.toLowerCase()),
      code_hash: codeHash, expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
    }).select("id").single();
    return jsonResponse({ ok: true, verification_id: row?.id, destination: maskEmail(email), resend_in: MIN_RESEND_SECONDS });
  }

  // ------------------------------------------------------------- verify_code
  if (action === "verify_code") {
    const vid = String(body.verification_id ?? "");
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return jsonResponse({ error: "invalid_code" }, 400);
    const { data: v } = await svc.from("care_verifications").select("*").eq("id", vid).maybeSingle();
    if (!v || v.customer_id !== user.id) return jsonResponse({ error: "not_found" }, 404);
    if (v.verified_at) return jsonResponse({ ok: true, verified: true });
    if (new Date(v.expires_at) < new Date()) return jsonResponse({ error: "code_expired" }, 400);
    if (v.verify_attempts >= MAX_ATTEMPTS) return jsonResponse({ error: "too_many_attempts" }, 429);
    await svc.from("care_verifications").update({ verify_attempts: v.verify_attempts + 1 }).eq("id", v.id);

    let good = false;
    if (v.method === "email_code") {
      good = (await hashOf(`${v.application_id}:${code}`)) === v.code_hash;
    } else {
      const jwt = smsWorksJwt();
      if (!jwt) return jsonResponse({ error: "provider_unavailable" }, 503);
      const res = await fetch(OTP_VERIFY_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: jwt }, body: JSON.stringify({ passcode: code }) }).catch(() => null);
      const pb = res ? await res.json().catch(() => ({})) as Record<string, unknown> : {};
      const mid = String(pb.messageid ?? pb.messageId ?? "");
      good = String(pb.status ?? "").toUpperCase() === "VERIFIED" && (!v.provider_challenge_id || mid === v.provider_challenge_id);
    }
    if (!good) return jsonResponse({ error: "incorrect_code", attempts_left: Math.max(0, MAX_ATTEMPTS - v.verify_attempts - 1) }, 400);
    await svc.from("care_verifications").update({ verified_at: new Date().toISOString() }).eq("id", v.id).is("verified_at", null);
    return jsonResponse({ ok: true, verified: true });
  }

  // ------------------------------------------------------------------ submit
  if (action === "submit") {
    const bank = (body.bank ?? {}) as Record<string, unknown>;
    const sort = String(bank.sort_code ?? "").replace(/\D/g, "");
    let acct = String(bank.account_number ?? "").replace(/\D/g, "");
    if (acct.length === 7) acct = `0${acct}`;
    const holder = String(bank.account_holder_name ?? "").trim().replace(/\s+/g, " ");
    if (sort.length !== 6 || acct.length !== 8) return jsonResponse({ error: "bank_details_invalid" }, 400);
    if (holder.length < 2 || holder.length > 120) return jsonResponse({ error: "account_holder_required" }, 400);

    let enc;
    try {
      enc = await encryptJson({ account_holder_name: holder, sort_code: sort, account_number: acct, bank_name: String(bank.bank_name ?? "").slice(0, 120), purpose: "occta_care" });
    } catch (e) {
      console.error("[care-join] encryption unavailable", (e as Error).message);
      return jsonResponse({ error: "encryption_unavailable" }, 503);
    }
    const termsSha = await sha256Hex(careTermsCanonicalText());
    const ticks = (body.ticks ?? {}) as Record<string, unknown>;
    const needs = Array.isArray(body.support_needs) ? (body.support_needs as unknown[]).map(String).filter((n) =>
      ["large_print", "braille", "carer_copy", "extra_time", "phone_preferred", "email_preferred", "no_sales_contact", "other"].includes(n)) : [];

    const { data, error } = await svc.rpc("care_submit_application", {
      p_application: String(body.application_id ?? ""), p_customer: user.id,
      p: {
        terms_sha256: termsSha, terms_version_client: String(body.terms_version ?? CARE_TERMS_VERSION),
        tick_terms: ticks.terms === true, tick_dd: ticks.dd === true, tick_account_holder: ticks.account_holder === true,
        tick_early_start: ticks.early_start === true, declared_over_18: ticks.over_18 === true,
        ticked_terms_at: ticks.terms_at ?? null, ticked_dd_at: ticks.dd_at ?? null, ticked_account_holder_at: ticks.account_holder_at ?? null,
        ticked_early_start_at: ticks.early_start === true ? (ticks.early_start_at ?? new Date().toISOString()) : null,
        verification_id: String(body.verification_id ?? ""),
        bank_ciphertext: enc.ciphertext_hex, bank_nonce: enc.nonce_hex, enc_key_id: enc.key_id,
        masked_account_last4: acct.slice(-4), masked_sort_last2: sort.slice(-2), account_holder_name: holder,
        bank_name: String(bank.bank_name ?? "").slice(0, 120) || null,
        date_of_birth: typeof body.date_of_birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth) ? body.date_of_birth : null,
        support_needs: needs, support_needs_consent: body.support_needs_consent === true,
        support_other: body.support_other ? String(body.support_other).slice(0, 500) : null,
        carer_name: body.carer_name ? String(body.carer_name).slice(0, 120) : null,
        carer_contact: body.carer_contact ? String(body.carer_contact).slice(0, 300) : null,
        ip, user_agent: ua, page_url: String(body.page_url ?? "").slice(0, 300),
        client_snapshot: body.client_snapshot ?? null,
      },
    });
    if (error) return jsonResponse({ error: "submit_failed", detail: error.message }, 500);
    const r = data as Record<string, unknown>;
    if (!r?.ok) return jsonResponse(r, 400);
    await kick();
    return jsonResponse(r);
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});
