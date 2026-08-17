import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "occta_checkout_tracking_v1";
const STARTED_KEY = "occta_checkout_tracking_started_v1";

export type CheckoutEventType =
  | "session_start"
  | "route_change"
  | "stage_change"
  | "heartbeat"
  | "error"
  | "complete"
  | "cancel";

export type CheckoutTrackingEvent = {
  eventType: CheckoutEventType;
  route: string;
  stage?: string | null;
  progressPercent?: number | null;
  journeyToken?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export function getCheckoutTrackingId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function checkoutTrackingStarted(): boolean {
  try { return sessionStorage.getItem(STARTED_KEY) === "1"; } catch { return false; }
}

export function markCheckoutTrackingStarted() {
  try { sessionStorage.setItem(STARTED_KEY, "1"); } catch { /* no-op */ }
}

export function clearCheckoutTrackingId() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(STARTED_KEY);
  } catch { /* no-op */ }
}

/** Never send a dynamic order/quote/payment token or order id as a route. */
export function normalizeCheckoutRoute(pathname: string): string {
  const path = pathname.split("?")[0] || "/";
  if (/^\/order\/[^/]+\/complete\/?$/.test(path)) return "/order/:token/complete";
  if (/^\/order\/[^/]+\/?$/.test(path)) return "/order/:token";
  if (/^\/quote\/contract-summary\/[^/]+\/?$/.test(path)) return "/quote/contract-summary/:token";
  if (/^\/quote\/two-doc\/[^/]+\/?$/.test(path)) return "/quote/two-doc/:token";
  if (/^\/quote\/payment\/[^/]+\/?$/.test(path)) return "/quote/payment/:token";
  if (/^\/quote\/[^/]+\/?$/.test(path) && path !== "/quote/start" && path !== "/quote/thank-you") return "/quote/:token";
  if (/^\/sim\/order-success\/[^/]+\/?$/.test(path)) return "/sim/order-success/:orderId";
  return path.slice(0, 180);
}

export function journeyTokenFromCheckoutPath(pathname: string): string | null {
  const match = pathname.match(/^\/order\/([^/]+)(?:\/complete)?\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]).slice(0, 200) : null;
}

export function isCheckoutRoute(pathname: string): boolean {
  const p = normalizeCheckoutRoute(pathname);
  return p === "/order"
    || p === "/pre-checkout"
    || p === "/checkout"
    || p === "/thank-you"
    || p === "/business-checkout"
    || p === "/sim/checkout"
    || p === "/sim/order-success/:orderId"
    || p === "/quote/start"
    || p === "/quote/thank-you"
    || p.startsWith("/quote/")
    || p === "/order"
    || p === "/order/:token"
    || p === "/order/:token/complete";
}

function cleanText(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max) || null;
}

/**
 * Sends only route/stage/technical state. Never include form fields, contact
 * details, bank details, DOB, passwords or contract/payment tokens in metadata.
 */
export async function trackCheckoutEvent(event: CheckoutTrackingEvent): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const clientSessionId = getCheckoutTrackingId();
  try {
    const { error } = await (supabase as any).rpc("track_checkout_event", {
      _client_session_id: clientSessionId,
      _event_type: event.eventType,
      _route: cleanText(normalizeCheckoutRoute(event.route), 180) ?? "/",
      _stage: cleanText(event.stage, 80),
      _progress_percent: event.progressPercent == null ? null : Math.max(0, Math.min(100, Math.round(event.progressPercent))),
      _journey_token: event.journeyToken ?? null,
      _error_code: cleanText(event.errorCode, 120),
      _error_message: cleanText(event.errorMessage, 300),
      _metadata: {
        ...(event.metadata ?? {}),
        user_agent: navigator.userAgent.slice(0, 300),
      },
    });
    if (!error && event.eventType === "session_start") markCheckoutTrackingStarted();
    if (!error && event.eventType === "complete") clearCheckoutTrackingId();
    return !error;
  } catch {
    // Analytics must never block or break checkout.
    return false;
  }
}
