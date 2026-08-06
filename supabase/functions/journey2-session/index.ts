/**
 * Journey 2 session orchestration — public, tokenised.
 *
 * Actions:
 *   start     → deterministic journey assignment for a NEW visitor, then
 *               create (or resume) a Journey 2 session and return its token.
 *   get       → current session state.
 *   save_step → validated autosave of one step, with server-resolved pricing.
 *   cancel    → customer abandons the session.
 *
 * Never creates customers, quotes, contracts, payment methods or orders — the
 * later Journey 2 functions do that through the existing shared services.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit,
  getRequestIp, generateTokenPair,
} from "../_shared/quoteHelpers.ts";
import {
  assignJourneyVersion, loadJourneySettings, hashAnon, resolveJourney2Price,
  JOURNEY2_SETUP, preflightPassed,
} from "../_shared/journey2.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const SESSION_COLS = `
  id, journey_version, status, current_step, last_completed_step, test_session,
  postcode, service_address, speed_bucket, plan_term, router_option, setup_option,
  selected_addons, customer_details, price_snapshot, pricing_version,
  quote_id, order_journey_id, order_id, guest_order_id, manual_review_reason,
  last_activity_at, expires_at, completed_at, created_at
`;

const AddressPayload = z.object({
  postcode: z.string().trim().min(5).max(10),
  address_line_1: z.string().trim().min(3).max(160),
  address_line_2: z.string().trim().max(160).optional().nullable(),
  town: z.string().trim().min(2).max(80),
  county: z.string().trim().max(80).optional().nullable(),
});
const PlanPayload = z.object({
  speed_bucket: z.enum(["essential", "superfast", "ultrafast", "gigabit"]),
  plan_term: z.enum(["price_lock_24", "flex_30"]),
});
const RouterPayload = z.object({
  router_option: z.enum(["own", "standard", "premium", "business"]),
  router_payment_type: z.enum(["none", "one_off", "monthly"]),
});
const ExtrasPayload = z.object({
  addons: z.array(z.enum(["priority_support", "static_ip", "digital_voice", "paper_billing"])).max(4),
});
const DetailsPayload = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(10).max(30),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  current_provider: z.string().trim().max(80).optional().nullable(),
  marketing_consent: z.boolean().default(false),
});

const Schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    anonymous_session_id: z.string().min(8).max(120),
    admin_test: z.boolean().optional(),
    utm: z.record(z.string().max(300)).optional(),
  }),
  z.object({ action: z.literal("get"), token: z.string().min(16) }),
  z.object({
    action: z.literal("save_step"),
    token: z.string().min(16),
    step: z.enum(["address", "plan", "router", "extras", "details"]),
    payload: z.record(z.unknown()),
  }),
  z.object({ action: z.literal("cancel"), token: z.string().min(16) }),
]);

// The contract must be prepared and accepted before the start date, billing
// day and Direct Debit are captured — this mirrors the existing order_journeys
// state machine that Journey 2 hands off to.
const STEP_ORDER = ["address", "plan", "router", "extras", "details", "contract", "start_date", "billing", "review", "complete"] as const;

function nextStep(step: string): string {
  const i = STEP_ORDER.indexOf(step as any);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : step;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, `journey2_${body.action}`, 60, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);

  // ── start ────────────────────────────────────────────────────────────────
  if (body.action === "start") {
    // Journey 2 can only be forced by an authenticated administrator.
    let adminTest = false;
    if (body.admin_test) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (data?.user) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
          adminTest = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
        }
      }
      if (!adminTest) return jsonResponse({ error: "forbidden" }, 403);
    }

    const anonHash = await hashAnon(body.anonymous_session_id);

    // Resume the visitor's existing live session before assigning anything.
    const { data: existing } = await supabase
      .from("customer_journey_sessions")
      .select("id, journey_version, status")
      .eq("anonymous_session_id_hash", anonHash)
      .in("status", ["active", "contract_prepared", "contract_accepted", "order_submitted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // The raw token is only ever known to the browser that created it, so a
      // resumed session is handed back by issuing a fresh token for the same row.
      const { raw, hash } = await generateTokenPair();
      await supabase
        .from("customer_journey_sessions")
        .update({ public_token_hash: hash, last_activity_at: new Date().toISOString() })
        .eq("id", existing.id);
      return jsonResponse({ ok: true, journey_version: existing.journey_version, resumed: true, token: raw });
    }

    const assignment = assignJourneyVersion(settings, anonHash, { adminTest });
    if (assignment.version === null) {
      return jsonResponse({
        ok: true,
        journey_version: null,
        unavailable: true,
        reason: assignment.reason,
        message: "Online ordering is briefly unavailable. Call 0800 260 6626 or email hello@occta.co.uk and we'll complete your order with you.",
      });
    }
    if (assignment.version === "v1") {
      return jsonResponse({ ok: true, journey_version: "v1", reason: assignment.reason, redirect: "/build-plan" });
    }

    const { raw, hash } = await generateTokenPair();
    const expiryDays = Math.max(1, Math.min(90, Number(settings.customer_journey_v2_session_expiry_days ?? 30)));
    const insert = await supabase
      .from("customer_journey_sessions")
      .insert({
        journey_version: "v2",
        public_token_hash: hash,
        anonymous_session_id_hash: anonHash,
        status: "active",
        current_step: "address",
        test_session: adminTest || !!settings.customer_journey_v2_test_mode,
        setup_option: { option: JOURNEY2_SETUP },
        journey_assigned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + expiryDays * 86400_000).toISOString(),
        ip, user_agent: ua,
        utm_snapshot: body.utm ?? null,
      })
      .select(SESSION_COLS)
      .single();
    if (insert.error) return jsonResponse({ error: "session_create_failed", details: insert.error.message }, 500);

    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_session_started",
      _title: "Journey 2 session started",
      _details: { reason: assignment.reason, admin_test: adminTest, step: "address" },
      _source_module: "journey2",
    }).then(() => {}).catch(() => {});

    return jsonResponse({ ok: true, journey_version: "v2", token: raw, session: insert.data, reason: assignment.reason });
  }

  // ── token-bound actions ──────────────────────────────────────────────────
  const tokenHash = await sha256Hex(body.token);
  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select(SESSION_COLS)
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);

  const expired = new Date(session.expires_at).getTime() < Date.now();
  if (expired && !["completed", "order_submitted"].includes(session.status)) {
    return jsonResponse({ error: "session_expired" }, 410);
  }

  if (body.action === "get") {
    return jsonResponse({
      ok: true,
      session,
      quote_token_available: !!session.quote_id,
      v2_test_mode: !!settings.customer_journey_v2_test_mode,
      preflight_ok: preflightPassed(settings),
    });
  }

  if (body.action === "cancel") {
    await supabase
      .from("customer_journey_sessions")
      .update({ status: "cancelled", last_activity_at: new Date().toISOString() })
      .eq("id", session.id)
      .in("status", ["active", "contract_prepared"]);
    return jsonResponse({ ok: true, cancelled: true });
  }

  // save_step
  if (!["active", "contract_prepared"].includes(session.status)) {
    return jsonResponse({ error: "session_locked", status: session.status }, 409);
  }

  const patch: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    abandoned_at: null,
  };

  if (body.step === "address") {
    const p = AddressPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    patch.postcode = p.data.postcode.toUpperCase();
    patch.service_address = p.data;
  } else if (body.step === "plan") {
    const p = PlanPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    patch.speed_bucket = p.data.speed_bucket;
    patch.plan_term = p.data.plan_term;
  } else if (body.step === "router") {
    const p = RouterPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    patch.router_option = p.data;
  } else if (body.step === "extras") {
    const p = ExtrasPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    patch.selected_addons = p.data.addons;
  } else {
    const p = DetailsPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    patch.customer_details = p.data;
  }

  // Re-resolve the authoritative price whenever a commercial selection changes.
  const merged = { ...session, ...patch } as any;
  if (merged.speed_bucket && merged.plan_term) {
    const priced = await resolveJourney2Price(supabase, settings, {
      speed_bucket: merged.speed_bucket,
      plan_term: merged.plan_term,
      router_option: merged.router_option?.router_option ?? "own",
      router_payment_type: merged.router_option?.router_payment_type ?? "none",
      addons: (merged.selected_addons ?? []) as any,
      customer_type: "residential",
    });
    if (!priced) {
      return jsonResponse({
        error: "not_orderable_online",
        message: "This combination needs a person to price it exactly. Continue on our Build your plan route and we'll confirm your price.",
        redirect: "/build-plan",
      }, 409);
    }
    const { internal: _internal, ...safe } = priced as any;
    patch.price_snapshot = safe;
    patch.pricing_version = "journey2";
  }

  patch.last_completed_step = body.step;
  const currentIndex = STEP_ORDER.indexOf(session.current_step as any);
  const savedIndex = STEP_ORDER.indexOf(body.step as any);
  if (savedIndex >= currentIndex) patch.current_step = nextStep(body.step);

  const upd = await supabase
    .from("customer_journey_sessions")
    .update(patch)
    .eq("id", session.id)
    .select(SESSION_COLS)
    .single();
  if (upd.error) return jsonResponse({ error: "save_failed", details: upd.error.message }, 500);

  return jsonResponse({ ok: true, session: upd.data });
});