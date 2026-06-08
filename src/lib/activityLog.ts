import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side activity log helper.
 *
 * SECURITY: Only LOW-RISK events are accepted by the public `log-event` edge function.
 * Sensitive events (VAT changes, payment status, quote approval, invoice edits,
 * reward approval, campaign publishing) MUST be logged server-side only — never
 * trust a client payload for those.
 */
export type LowRiskEventType =
  | "page_view"
  | "cta_click"
  | "quote_start"
  | "postcode_check"
  | "form_submit"
  | "contract_summary_view"
  | "legal_view"
  | "dashboard_view"
  | "tab_view"
  | "quote_view_from_dashboard"
  | "contract_summary_view_from_dashboard"
  | "invoice_view_from_dashboard"
  | "support_cta_click"
  | "vulnerable_support_view"
  | "marketing_preference_change";

export interface ActivityLogPayload {
  event_type: LowRiskEventType;
  title: string;
  details?: Record<string, unknown>;
  source_module?: string;
}

export async function logClientEvent(payload: ActivityLogPayload): Promise<void> {
  try {
    await supabase.functions.invoke("log-event", {
      body: {
        event_type: payload.event_type,
        title: payload.title.slice(0, 200),
        details: payload.details ?? {},
        source_module: payload.source_module ?? "web",
      },
    });
  } catch {
    // Logging must never break user flows
  }
}
