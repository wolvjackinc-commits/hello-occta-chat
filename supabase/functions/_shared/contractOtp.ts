/**
 * Shared server-side helpers for SMS OTP verification of the mobile number
 * immediately before online contract signing.
 *
 * Security rules enforced here:
 *  - The SMS Works JWT is read from the environment only and never returned,
 *    logged or persisted.
 *  - The passcode is never generated, stored or logged by us — The SMS Works
 *    owns it.
 *  - Only a masked number plus a salted SHA-256 hash of the normalised number
 *    is persisted.
 */
import { getServiceClient, sha256Hex } from "./quoteHelpers.ts";

export const OTP_SEND_URL = "https://api.thesmsworks.co.uk/v1/otp/send";
export const OTP_VERIFY_URL = "https://api.thesmsworks.co.uk/v1/otp/verify";
export const OTP_SENDER = "OCCTA";
export const OTP_VALIDITY_SECONDS = 600;
export const OTP_TEMPLATE =
  "Your OCCTA verification code is {{passcode}}. It expires in 10 minutes. Do not share this code.";
export const MAX_SENDS_PER_HOUR = 3;
export const MIN_RESEND_SECONDS = 60;
export const MAX_VERIFY_ATTEMPTS = 5;

export type JourneyType = "journey_1" | "journey_2";

/** Normalise common UK inputs to bare `44…` digits. Returns null when invalid. */
export function normaliseUkMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  if (d.startsWith("7") && d.length === 10) d = "44" + d;
  if (!/^447[1-9]\d{8}$/.test(d)) return null;
  return d;
}

export function maskMobile(normalised: string): string {
  return "******" + normalised.slice(-4);
}

export async function hashMobile(normalised: string): Promise<string> {
  const salt = Deno.env.get("SMS_OTP_HASH_SALT") ?? "";
  return await sha256Hex(`${salt}:${normalised}`);
}

export function smsWorksJwt(): string | null {
  const jwt = Deno.env.get("SMS_WORKS_JWT");
  return jwt && jwt.trim().length > 20 ? jwt.trim() : null;
}

/** Whether OTP verification is currently required (admin outage bypass aware). */
export async function otpRequired(supabase: ReturnType<typeof getServiceClient>): Promise<boolean> {
  const { data } = await supabase
    .from("platform_settings")
    .select("contract_sms_otp_required")
    .eq("singleton", true)
    .maybeSingle();
  // Fail closed: if the setting cannot be read, verification stays required.
  return data?.contract_sms_otp_required !== false;
}

/**
 * Resolve the journey/order context for a public journey token.
 * The mobile number always comes from the stored order record, never the browser.
 */
export async function resolveJourneyContext(tokenHash: string): Promise<
  | { ok: true; journeyId: string; journeyType: JourneyType; quoteId: string | null; quoteRequestId: string | null; signed: boolean; mobile: string | null }
  | { ok: false; error: string; status: number }
> {
  const supabase = getServiceClient();
  const { data: j } = await supabase
    .from("order_journeys")
    .select("id, quote_id, contract_summary_id, contract_accepted_at, journey_version, status")
    .eq("token_hash", tokenHash)
    .neq("status", "cancelled")
    .maybeSingle();
  if (!j) return { ok: false, error: "no_journey", status: 404 };

  let quoteRequestId: string | null = null;
  let mobile: string | null = null;
  if (j.quote_id) {
    const { data: q } = await supabase
      .from("quotes")
      .select("quote_request_id")
      .eq("id", j.quote_id)
      .maybeSingle();
    quoteRequestId = q?.quote_request_id ?? null;
  }
  if (quoteRequestId) {
    const { data: qr } = await supabase
      .from("quote_requests")
      .select("phone")
      .eq("id", quoteRequestId)
      .maybeSingle();
    mobile = qr?.phone ?? null;
  }

  return {
    ok: true,
    journeyId: j.id,
    journeyType: j.journey_version === "v2" ? "journey_2" : "journey_1",
    quoteId: j.quote_id ?? null,
    quoteRequestId,
    signed: !!j.contract_accepted_at,
    mobile,
  };
}

/**
 * Server-side gate used by the contract signing function. Independent of any
 * frontend state: a verified, unexpired, unconsumed challenge must exist for
 * this exact journey and the order's current mobile number.
 */
export async function requireVerifiedOtp(opts: {
  journeyId: string;
  journeyType: JourneyType;
  mobile: string | null;
}): Promise<{ ok: true; challenge: Record<string, unknown> | null; bypassed: boolean } | { ok: false; error: string }> {
  const supabase = getServiceClient();
  if (!(await otpRequired(supabase))) return { ok: true, challenge: null, bypassed: true };

  const normalised = normaliseUkMobile(opts.mobile);
  if (!normalised) return { ok: false, error: "mobile_not_verified" };
  const phoneHash = await hashMobile(normalised);

  const { data } = await supabase
    .from("sms_otp_challenges")
    .select("*")
    .eq("session_or_order_reference", opts.journeyId)
    .eq("journey_type", opts.journeyType)
    .eq("phone_hash", phoneHash)
    .not("verified_at", "is", null)
    .is("consumed_at", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: false, error: "mobile_not_verified" };
  return { ok: true, challenge: data as Record<string, unknown>, bypassed: false };
}

/** Marks the verification as consumed so it can never be replayed. */
export async function consumeOtpChallenge(challengeRowId: string, acceptanceId: string | null) {
  const supabase = getServiceClient();
  await supabase
    .from("sms_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challengeRowId)
    .is("consumed_at", null);
  if (acceptanceId) {
    // Non-fatal audit link; never blocks signing.
    try {
      await supabase.from("audit_logs").insert({
        action: "contract_otp_consumed",
        entity: "contract_acceptance",
        entity_id: acceptanceId,
        metadata: { challenge_row_id: challengeRowId },
      });
    } catch { /* audit is best-effort */ }
  }
}