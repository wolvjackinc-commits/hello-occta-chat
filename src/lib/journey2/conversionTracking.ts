import { trackCheckoutEvent } from "@/lib/checkoutTracking";
import { getConsent } from "@/lib/consent";
import type { Journey2Session } from "./client";

export type ConversionAction = "view" | "saved" | "validation_error" | "save_error" | "resumed" | "submitted";
const sources = new Set(["direct", "campaign", "referral", "qr_flyer", "google_ads", "meta_ads", "microsoft_ads", "tiktok_ads"]);
const stages = ["address", "plan", "router", "extras", "details", "start_date", "billing", "contract", "quote", "agreement", "payment", "review", "complete"];

// Uses the existing first-party event store. New conversion analytics are opt-in;
// operational tracking and server-side funnel counts continue unchanged.
export async function trackConversion(session: Journey2Session, token: string, stage: string, action: ConversionAction) {
  if (getConsent() !== "granted" || session.test_session || !stages.includes(stage)) return false;
  const source = session.utm_snapshot?.source_type;
  return trackCheckoutEvent({
    eventType: action === "validation_error" || action === "save_error" ? "error" : "stage_change",
    route: "/order/:token",
    stage,
    journeyToken: token,
    errorCode: action === "validation_error" || action === "save_error" ? action : null,
    metadata: {
      surface: "journey2_conversion",
      schema_version: 1,
      action,
      device_type: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop",
      source_type: typeof source === "string" && sources.has(source) ? source : "unknown",
    },
  });
}
