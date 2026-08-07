import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "occta_checkout_tracking_v1";

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

export function clearCheckoutTrackingId() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* no-op */ }
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
      _route: cleanText(event.route, 180) ?? "/",
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
    if (!error && event.eventType === "complete") clearCheckoutTrackingId();
    return !error;
  } catch {
    // Analytics must never block or break checkout.
    return false;
  }
}
