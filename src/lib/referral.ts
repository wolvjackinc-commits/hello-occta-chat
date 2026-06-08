import { supabase } from "@/integrations/supabase/client";

const KEY = "occta_ref_code";
const SAFE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,16}$/;

function normalize(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return SAFE_RE.test(c) ? c : null;
}

/**
 * Capture ?ref=CODE from the URL into sessionStorage (best-effort).
 * Never overwrites an existing stored code unless URL supplies a new VALID code.
 * Fires track-referral-click best-effort; failures are swallowed.
 */
export function captureReferralFromUrl() {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("ref");
    const code = normalize(raw);
    if (!code) return;
    const existing = sessionStorage.getItem(KEY);
    if (existing && existing === code) return;
    sessionStorage.setItem(KEY, code);
    // best-effort click tracking — never blocks
    void supabase.functions.invoke("track-referral-click", { body: { code } }).catch(() => {});
  } catch {
    /* never break navigation */
  }
}

export function getStoredReferralCode(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return normalize(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearStoredReferralCode() {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}