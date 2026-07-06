// Phase B/C flow gate.
//
// The two-document contract flow ships behind two independent switches:
//   1. platform_settings.two_document_contract_flow_enabled — global kill switch
//   2. public.two_doc_pilot_allowlist                        — per-user staff pilot
//
// Any caller (edge function or client) that wants to use the new flow MUST
// pass this gate. When neither switch is on for the caller, the request is
// rejected with 409 feature_disabled and the attempt is logged.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PilotEventType =
  | "access_granted"
  | "access_denied"
  | "pdf_issued"
  | "accepted";

export async function isTwoDocEnabledFor(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<{ enabled: boolean; reason: "global" | "pilot" | "off" }> {
  const { data: ps } = await supabase
    .from("platform_settings")
    .select("two_document_contract_flow_enabled" as any)
    .limit(1)
    .maybeSingle();
  if ((ps as any)?.two_document_contract_flow_enabled) {
    return { enabled: true, reason: "global" };
  }
  if (!userId) return { enabled: false, reason: "off" };
  const { data: pilot } = await supabase
    .from("two_doc_pilot_allowlist")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (pilot?.id) return { enabled: true, reason: "pilot" };
  return { enabled: false, reason: "off" };
}

export async function logPilotEvent(
  supabase: SupabaseClient,
  event: {
    event_type: PilotEventType;
    user_id?: string | null;
    order_id?: string | null;
    document_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("two_doc_pilot_events").insert({
      event_type: event.event_type,
      user_id: event.user_id ?? null,
      order_id: event.order_id ?? null,
      document_id: event.document_id ?? null,
      metadata: event.metadata ?? {},
    });
  } catch { /* logging must never break the caller */ }
}

/**
 * Best-effort JWT decode to extract auth.uid() from the Authorization header.
 * Returns null when no session is present (e.g. token-only public endpoints).
 */
export function callerUserIdFromRequest(req: Request): string | null {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const bearer = auth.slice(7);
  // If caller presents the service role key (JWT or opaque sb_secret_*),
  // trust a signed x-pilot-caller-id header. This is what the bootstrap
  // sample generator uses to impersonate the pilot user for gate checks.
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isServiceRole = !!svcKey && bearer === svcKey;
  if (isServiceRole) {
    const pilot = req.headers.get("x-pilot-caller-id");
    if (pilot && /^[0-9a-f-]{36}$/i.test(pilot)) return pilot;
    return null;
  }
  const parts = bearer.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const sub = payload?.sub;
    return typeof sub === "string" && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}