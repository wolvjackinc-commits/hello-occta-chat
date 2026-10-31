import { supabase } from "@/integrations/supabase/client";

// Refer-a-friend link capture.
//
// A referral link is https://www.occta.co.uk/?cc=CODE&ref=CODE. The `cc`
// parameter is captured by campaignAttribution into the checkout session's
// utm_snapshot and pre-fills the order form's reference-code box; that is the
// evidence the database binds an order from, before the order exists.
//
// Here we only record the click itself (hashed IP, user agent, landing URL) so
// admins can see proof of it. A click grants nothing on its own.

const SEEN_KEY = "occta_ref_click_recorded";
const SAFE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,16}$/;

export function normaliseReferralCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return SAFE_RE.test(c) ? c : null;
}

/** Record a referral link click once per code per browser session. Never throws. */
export function captureReferralFromUrl() {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = normaliseReferralCode(url.searchParams.get("cc")) ?? normaliseReferralCode(url.searchParams.get("ref"));
    if (!code) return;
    let seen = "";
    try { seen = sessionStorage.getItem(SEEN_KEY) ?? ""; } catch { /* storage blocked */ }
    if (seen.split(",").includes(code)) return;
    try { sessionStorage.setItem(SEEN_KEY, [seen, code].filter(Boolean).join(",").slice(-200)); } catch { /* storage blocked */ }
    const landing = `${url.origin}${url.pathname}${url.search}`.slice(0, 500);
    void (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
      "referral_record_click",
      { p_code: code, p_landing_url: landing },
    ).catch(() => {});
  } catch {
    /* never break navigation */
  }
}

export type ReferralCodeCheck = {
  referral: boolean;
  code?: string;
  terms_version?: string;
  terms_url?: string;
  friend_reward?: { residential: { referrer: number; friend: number }; business: { referrer: number; friend: number } };
  qualify_days?: number;
  invoices_required?: number;
  stacking_allowed?: boolean;
};

/** Is this typed code a live refer-a-friend code? Reveals nothing about the referrer. */
export async function checkReferralCode(code: string): Promise<ReferralCodeCheck> {
  const c = normaliseReferralCode(code);
  if (!c) return { referral: false };
  try {
    const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
      "referral_check_code",
      { p_code: c },
    );
    if (error || !data || typeof data !== "object") return { referral: false };
    return data as ReferralCodeCheck;
  } catch {
    return { referral: false };
  }
}
