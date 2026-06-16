import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Phase D — Capture the customer's preferred service start date inside the
 * unified journey, applying the 14-day cooling-off gate.
 *
 * Behaviour:
 *  - Requires an existing journey at step `start_date` (i.e. CS already accepted).
 *  - `preferred_start_date` must be today (UTC) or later, and at most +60 days.
 *  - If the chosen date is BEFORE `cooling_off_ends_at`, an explicit
 *    early-start waiver is required (`early_start_waived: true` + the
 *    canonical waiver wording confirmation).
 *  - If the chosen date is on/after `cooling_off_ends_at`, no waiver needed
 *    but the customer must acknowledge the cooling-off info.
 *  - Idempotent: if the date is already locked, returns the existing record
 *    and refuses to overwrite without an explicit `change=true` flag.
 *
 * Never creates orders, services, invoices, payment requests or supplier work.
 */

export const EARLY_START_WAIVER_TEXT =
  "I expressly request that my OCCTA service begins before the end of my 14-day cooling-off period. I understand that I am giving up my right to cancel free of charge for the portion of the service supplied before I cancel, and that any installation, equipment or one-off charges already incurred remain payable.";

const Schema = z.object({
  token: z.string().min(16),
  preferred_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cooling_off_acknowledged: z.boolean(),
  early_start_waived: z.boolean().optional(),
  waiver_text_confirmed: z.string().optional(),
  change: z.boolean().optional(),
});

function ymdUtcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey_start_date", 20, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const hash = await sha256Hex(i.token);

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, current_step, status, contract_accepted_at, cooling_off_ends_at, preferred_start_date, start_date_selected_at, early_start_waived")
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);
  if (!journey.cooling_off_ends_at) return jsonResponse({ error: "cooling_off_not_initialised" }, 500);

  // Date sanity: must be today..today+60 days (UTC).
  const today = ymdUtcToday();
  const max = addDays(today, 60);
  if (i.preferred_start_date < today) return jsonResponse({ error: "date_in_past" }, 400);
  if (i.preferred_start_date > max) return jsonResponse({ error: "date_too_far", max_date: max }, 400);

  // Idempotent lock — already chosen.
  if (journey.preferred_start_date && !i.change) {
    return jsonResponse({
      ok: true,
      already_set: true,
      preferred_start_date: journey.preferred_start_date,
      start_date_selected_at: journey.start_date_selected_at,
      early_start_waived: journey.early_start_waived,
      cooling_off_ends_at: journey.cooling_off_ends_at,
    });
  }

  // Determine cooling-off vs early-start.
  const cooEndsYmd = journey.cooling_off_ends_at.slice(0, 10);
  const isEarlyStart = i.preferred_start_date < cooEndsYmd;

  if (!i.cooling_off_acknowledged) {
    return jsonResponse({ error: "cooling_off_ack_required", cooling_off_ends_at: journey.cooling_off_ends_at }, 400);
  }

  let waiverHash: string | null = null;
  if (isEarlyStart) {
    if (i.early_start_waived !== true) {
      return jsonResponse({
        error: "early_start_waiver_required",
        cooling_off_ends_at: journey.cooling_off_ends_at,
        canonical_waiver_text: EARLY_START_WAIVER_TEXT,
      }, 400);
    }
    if (!i.waiver_text_confirmed || i.waiver_text_confirmed !== EARLY_START_WAIVER_TEXT) {
      return jsonResponse({ error: "waiver_text_mismatch", canonical_waiver_text: EARLY_START_WAIVER_TEXT }, 400);
    }
    waiverHash = await sha256Hex(EARLY_START_WAIVER_TEXT);
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    preferred_start_date: i.preferred_start_date,
    start_date_selected_at: nowIso,
    cooling_off_acknowledged: true,
    cooling_off_acknowledged_at: nowIso,
    current_step: "payment",
  };
  if (isEarlyStart) {
    update.early_start_waived = true;
    update.early_start_waived_at = nowIso;
    update.early_start_waiver_text = EARLY_START_WAIVER_TEXT;
    update.early_start_waiver_text_hash = waiverHash;
    update.early_start_waiver_ip = ip;
  }

  const { error: uErr, data: updated } = await supabase
    .from("order_journeys")
    .update(update)
    .eq("id", journey.id)
    .select("id, preferred_start_date, start_date_selected_at, cooling_off_ends_at, cooling_off_acknowledged, early_start_waived, early_start_waived_at, current_step")
    .single();
  if (uErr) return jsonResponse({ error: "update_failed", details: uErr.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: isEarlyStart ? "journey_early_start_waived" : "journey_start_date_selected",
    _title: isEarlyStart
      ? `Customer waived 14-day cooling-off, start ${i.preferred_start_date}`
      : `Start date selected ${i.preferred_start_date}`,
    _details: {
      journey_id: journey.id,
      quote_id: journey.quote_id,
      preferred_start_date: i.preferred_start_date,
      cooling_off_ends_at: journey.cooling_off_ends_at,
      early_start: isEarlyStart,
      waiver_hash: waiverHash,
      ua_short: ua.slice(0, 120),
    },
    _source_module: "journey",
    _quote_id: journey.quote_id,
  }).then(() => {}).catch(() => {});

  await supabase.from("quote_events").insert({
    quote_id: journey.quote_id,
    event_type: isEarlyStart ? "early_start_waived" : "start_date_selected",
    title: isEarlyStart
      ? `Early-start waiver accepted (${i.preferred_start_date})`
      : `Start date selected (${i.preferred_start_date})`,
    details: { preferred_start_date: i.preferred_start_date, early_start: isEarlyStart },
    actor_type: "public",
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok: true,
    already_set: false,
    preferred_start_date: updated.preferred_start_date,
    start_date_selected_at: updated.start_date_selected_at,
    cooling_off_ends_at: updated.cooling_off_ends_at,
    early_start_waived: updated.early_start_waived,
    current_step: updated.current_step,
  });
});