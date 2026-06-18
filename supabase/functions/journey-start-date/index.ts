import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * Phase D (corrected) — Capture the customer's preferred service start date
 * inside the unified journey. There is NO early-start waiver: the chosen date
 * must be on or after `earliest_selectable_start_date` (computed in Europe/London
 * by the DB helper) and on or before today + `platform_settings.start_date_max_days`.
 * The customer must acknowledge that the date is preferred and OCCTA will
 * confirm the actual activation date.
 *
 * Never creates orders, services, invoices, payment requests or supplier work.
 */

const Schema = z.object({
  token: z.string().min(16),
  preferred_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cooling_off_acknowledged: z.boolean(),
  change: z.boolean().optional(),
});

function ymdInLondon(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(perfServe("journey-start-date", async (req) => {
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
    .select("id, quote_id, current_step, status, contract_accepted_at, cooling_off_ends_at, earliest_selectable_start_date, preferred_start_date, start_date_selected_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (journey.status === "cancelled") return jsonResponse({ error: "journey_cancelled" }, 409);
  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);
  if (!journey.cooling_off_ends_at || !journey.earliest_selectable_start_date) {
    return jsonResponse({ error: "cooling_off_not_initialised" }, 500);
  }

  // Admin-configurable maximum window.
  const { data: ps } = await supabase
    .from("platform_settings")
    .select("start_date_max_days")
    .limit(1).maybeSingle();
  const maxDays = Math.max(1, Number(ps?.start_date_max_days ?? 90));

  // Server-side validation using Europe/London "today".
  const todayLondon = ymdInLondon(new Date());
  const earliest = journey.earliest_selectable_start_date as string; // YYYY-MM-DD
  const maxDate = addDays(todayLondon, maxDays);

  if (i.preferred_start_date < earliest) {
    return jsonResponse({
      error: "date_before_earliest",
      earliest_selectable_start_date: earliest,
      cooling_off_ends_at: journey.cooling_off_ends_at,
    }, 400);
  }
  if (i.preferred_start_date > maxDate) {
    return jsonResponse({ error: "date_too_far", max_date: maxDate }, 400);
  }
  if (!i.cooling_off_acknowledged) {
    return jsonResponse({
      error: "acknowledgement_required",
      earliest_selectable_start_date: earliest,
      cooling_off_ends_at: journey.cooling_off_ends_at,
    }, 400);
  }

  // Idempotent — already chosen.
  if (journey.preferred_start_date && !i.change) {
    return jsonResponse({
      ok: true,
      already_set: true,
      preferred_start_date: journey.preferred_start_date,
      start_date_selected_at: journey.start_date_selected_at,
      earliest_selectable_start_date: earliest,
      cooling_off_ends_at: journey.cooling_off_ends_at,
    });
  }

  const nowIso = new Date().toISOString();
  const { error: uErr, data: updated } = await supabase
    .from("order_journeys")
    .update({
      preferred_start_date: i.preferred_start_date,
      start_date_selected_at: nowIso,
      cooling_off_acknowledged: true,
      cooling_off_acknowledged_at: nowIso,
      current_step: "payment",
    })
    .eq("id", journey.id)
    .select("id, preferred_start_date, start_date_selected_at, cooling_off_ends_at, earliest_selectable_start_date, cooling_off_acknowledged, current_step")
    .single();
  if (uErr) return jsonResponse({ error: "update_failed", details: uErr.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey_start_date_selected",
    _title: `Preferred start date selected ${i.preferred_start_date}`,
    _details: {
      journey_id: journey.id,
      quote_id: journey.quote_id,
      preferred_start_date: i.preferred_start_date,
      earliest_selectable_start_date: earliest,
      cooling_off_ends_at: journey.cooling_off_ends_at,
      ua_short: ua.slice(0, 120),
    },
    _source_module: "journey",
    _quote_id: journey.quote_id,
  }).then(() => {}).catch(() => {});

  await supabase.from("quote_events").insert({
    quote_id: journey.quote_id,
    event_type: "start_date_selected",
    title: `Preferred start date selected (${i.preferred_start_date})`,
    details: { preferred_start_date: i.preferred_start_date, earliest_selectable_start_date: earliest },
    actor_type: "public",
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok: true,
    already_set: false,
    preferred_start_date: updated.preferred_start_date,
    start_date_selected_at: updated.start_date_selected_at,
    cooling_off_ends_at: updated.cooling_off_ends_at,
    earliest_selectable_start_date: updated.earliest_selectable_start_date,
    current_step: updated.current_step,
  });
}));