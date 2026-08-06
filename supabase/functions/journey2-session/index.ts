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
  JOURNEY2_SETUP, preflightPassed, JOURNEY2_STEPS,
} from "../_shared/journey2.ts";
import { RESOLVER_VERSION } from "../_shared/buildPlanResolver.ts";
import { encryptJson } from "../_shared/ddCrypto.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const SESSION_COLS = `
  id, journey_version, status, current_step, last_completed_step, test_session,
  postcode, service_address, speed_bucket, plan_term, router_option, setup_option,
  selected_addons, customer_details, price_snapshot, pricing_version,
  preferred_start_date, cooling_off_acknowledged, billing_anchor_day, dd_masked, dd_status,
  digital_voice_acknowledged, checkout_session_id, contract_snapshot_id,
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
  /**
   * Digital Voice is a broadband add-on only and depends on power and
   * broadband, so the emergency-call limitation must be acknowledged.
   */
  digital_voice_acknowledged: z.boolean().optional(),
});

const AddressBlock = z.object({
  address_line_1: z.string().trim().min(3).max(160),
  address_line_2: z.string().trim().max(160).optional().nullable(),
  town: z.string().trim().min(2).max(80),
  county: z.string().trim().max(80).optional().nullable(),
  postcode: z.string().trim().min(5).max(10),
});

const DetailsPayload = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(10).max(30),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  age_18_confirmed: z.literal(true),
  billing_address_same: z.boolean().default(true),
  billing_address: AddressBlock.optional().nullable(),
  current_provider: z.string().trim().max(80).optional().nullable(),
  current_contract_status: z.enum(["out_of_contract", "in_contract", "unknown", "new_line"]),
  current_contract_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  number_action: z.enum(["none", "keep_existing", "port_in", "new_number"]).default("none"),
  number_to_port: z.string().trim().max(30).optional().nullable(),
  accessibility_needs: z.string().trim().max(600).optional().nullable(),
  vulnerability_support_needs: z.string().trim().max(600).optional().nullable(),
  marketing_consent: z.boolean().default(false),
  privacy_acknowledged: z.literal(true),
});

const StartDatePayload = z.object({
  preferred_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cooling_off_acknowledged: z.literal(true),
});

const DDDetails = z.object({
  account_holder_name: z.string().trim().min(2).max(100),
  sort_code: z.string().regex(/^\d{6}$/),
  account_number: z.string().regex(/^\d{8}$/),
  bank_name: z.string().trim().min(2).max(100),
  billing_address: z.string().trim().min(3).max(400),
  postcode: z.string().trim().min(3).max(12),
  uk_account_confirmed: z.literal(true),
  payer_authorised_confirmed: z.literal(true),
});
const BillingPayload = z.object({
  billing_anchor_day: z.number().int().min(1).max(31),
  dd_consent: z.literal(true),
  dd_details: DDDetails,
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
    step: z.enum(["address", "plan", "router", "extras", "details", "start_date", "billing"]),
    payload: z.record(z.unknown()),
  }),
  z.object({ action: z.literal("cancel"), token: z.string().min(16) }),
]);

/**
 * Required Journey 2 sequence. Start date and billing are captured BEFORE the
 * contract is generated, so the documents the customer signs already contain
 * the start date, billing day and first-collection wording.
 */
const STEP_ORDER = JOURNEY2_STEPS;
/** Steps the customer completes before any contract document exists. */
const PRE_CONTRACT_STEPS = ["address", "plan", "router", "extras", "details", "start_date", "billing"] as const;
/** Selections that materially change the agreement once accepted. */
const MATERIAL_STEPS = ["address", "plan", "router", "extras", "start_date", "billing"] as const;

function nextStep(step: string): string {
  const i = STEP_ORDER.indexOf(step as never);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : step;
}

function ymdInLondon(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  return `${p.year}-${p.month}-${p.day}`;
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
    // The public journey never creates a test session. Isolated test journeys
    // run only through journey2-test-runner, against journey2_test_* tables.
    if (body.admin_test) {
      return jsonResponse({
        error: "use_isolated_test_runner",
        message: "Isolated Journey 2 tests run through journey2-test-runner, never through the public session path.",
      }, 400);
    }

    const anonHash = await hashAnon(body.anonymous_session_id);

    // Resume the visitor's existing live session before assigning anything, so
    // a customer already in flight never changes journey version.
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

    const assignment = assignJourneyVersion(settings, anonHash);
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
        test_session: !!settings.customer_journey_v2_test_mode,
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
      _details: { reason: assignment.reason, step: "address", test_session: insert.data.test_session },
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

  // ── save_step ────────────────────────────────────────────────────────────
  if (!["active", "contract_prepared"].includes(session.status)) {
    return jsonResponse({ error: "session_locked", status: session.status }, 409);
  }
  if (!(PRE_CONTRACT_STEPS as readonly string[]).includes(body.step)) {
    return jsonResponse({ error: "step_not_editable" }, 409);
  }
  // Once the immutable contractual snapshot exists it can never be replaced,
  // so a material change is refused outright rather than quietly superseding a
  // document the customer may already have read.
  const material = (MATERIAL_STEPS as readonly string[]).includes(body.step);
  if (session.contract_snapshot_id && material) {
    return jsonResponse({
      error: "contract_locked",
      message: "Your contract has already been prepared from these choices. Start a new order to change your plan, router, extras, start date or billing.",
    }, 409);
  }
  const supersede = session.status === "contract_prepared" && material;

  const patch: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    abandoned_at: null,
    last_error: null,
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
    if (p.data.addons.includes("digital_voice") && !p.data.digital_voice_acknowledged) {
      return jsonResponse({ error: "digital_voice_acknowledgement_required" }, 400);
    }
    patch.selected_addons = p.data.addons;
    patch.digital_voice_acknowledged = p.data.addons.includes("digital_voice")
      ? !!p.data.digital_voice_acknowledged
      : false;
  } else if (body.step === "details") {
    const p = DetailsPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    // Server-side age check — never trust the client tick alone.
    const dob = new Date(p.data.date_of_birth + "T00:00:00Z");
    const eighteen = new Date(Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()));
    if (!(eighteen.getTime() <= Date.now())) return jsonResponse({ error: "must_be_18" }, 400);
    if (!p.data.billing_address_same && !p.data.billing_address) {
      return jsonResponse({ error: "billing_address_required" }, 400);
    }
    if (p.data.number_action === "port_in" && !p.data.number_to_port) {
      return jsonResponse({ error: "number_to_port_required" }, 400);
    }
    patch.customer_details = p.data;
  } else if (body.step === "start_date") {
    const p = StartDatePayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    const { data: ps } = await supabase
      .from("platform_settings").select("start_date_max_days").limit(1).maybeSingle();
    const maxDays = Math.max(1, Number(ps?.start_date_max_days ?? 90));
    const coolingDays = 14; // statutory cooling-off window used by the shared journey
    const today = ymdInLondon(new Date());
    const earliest = addDays(today, coolingDays);
    if (p.data.preferred_start_date < earliest) {
      return jsonResponse({ error: "date_before_earliest", earliest_selectable_start_date: earliest }, 400);
    }
    if (p.data.preferred_start_date > addDays(today, maxDays)) {
      return jsonResponse({ error: "date_too_far", max_date: addDays(today, maxDays) }, 400);
    }
    patch.preferred_start_date = p.data.preferred_start_date;
    patch.cooling_off_acknowledged = true;
  } else {
    // billing — Direct Debit details are encrypted immediately and never
    // returned to the browser, stored in logs or written to the session.
    const p = BillingPayload.safeParse(body.payload);
    if (!p.success) return jsonResponse({ error: "validation", details: p.error.flatten() }, 400);
    if (!session.preferred_start_date && !patch.preferred_start_date) {
      return jsonResponse({ error: "start_date_required_first" }, 409);
    }
    let enc;
    try {
      enc = await encryptJson({
        account_holder_name: p.data.dd_details.account_holder_name,
        sort_code: p.data.dd_details.sort_code,
        account_number: p.data.dd_details.account_number,
        bank_name: p.data.dd_details.bank_name,
        billing_address: p.data.dd_details.billing_address,
        postcode: p.data.dd_details.postcode,
      });
    } catch (e) {
      await supabase.from("customer_journey_sessions")
        .update({ last_error: `dd_encryption:${(e as Error).message}` }).eq("id", session.id);
      return jsonResponse({
        error: "dd_storage_unavailable",
        message: "We couldn't securely store your bank details just now. Nothing has been taken — please try again in a moment.",
        retryable: true,
      }, 503);
    }
    const masked = {
      last4: p.data.dd_details.account_number.slice(-4),
      sort_last2: p.data.dd_details.sort_code.slice(-2),
      bank_name: p.data.dd_details.bank_name,
      account_holder_name: p.data.dd_details.account_holder_name,
      status: "details_received",
    };
    // Isolated test intake never reaches this function — it is captured by
    // journey2-test-runner in journey2_test_dd_intake.
    const up = await supabase.from("journey2_dd_intake").upsert({
      session_id: session.id,
      bank_details_ciphertext: enc.ciphertext_hex,
      nonce: enc.nonce_hex,
      enc_key_id: enc.key_id,
      enc_alg: "AES-256-GCM",
      masked_account_last4: masked.last4,
      masked_sort_last2: masked.sort_last2,
      bank_name: masked.bank_name,
      account_holder_name: masked.account_holder_name,
      consumed_at: null,
    }, { onConflict: "session_id" });
    if (up.error) {
      return jsonResponse({
        error: "dd_storage_failed",
        message: "We couldn't save your Direct Debit details. Nothing has been taken — please try again.",
        retryable: true,
      }, 503);
    }
    patch.billing_anchor_day = p.data.billing_anchor_day;
    patch.dd_masked = masked;
    // Details are held, but nothing is requested from the provider until the
    // customer has accepted the contract.
    patch.dd_status = "pending_contract";
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
      // Journey 2 never silently converts an online order into a quote request.
      await supabase.from("customer_journey_sessions")
        .update({ last_error: "price_unavailable", last_activity_at: new Date().toISOString() })
        .eq("id", session.id);
      await supabase.rpc("log_event", {
        _actor_type: "public",
        _event_type: "journey2_price_unavailable",
        _title: "Journey 2 exact price unavailable",
        _details: { session_id: session.id, step: body.step, speed_bucket: merged.speed_bucket, plan_term: merged.plan_term },
        _source_module: "journey2",
        _severity: "warning",
      }).then(() => {}).catch(() => {});
      return jsonResponse({
        error: "price_unavailable",
        message: "We can only show exact prices, and this option isn't priced right now. Your order is saved — please choose another option or try again shortly.",
        retryable: true,
      }, 409);
    }
    const { internal: _internal, ...safe } = priced as any;
    // Journey 2 has no upfront card step, so nothing is payable today.
    safe.amount_due_today = 0;
    safe.one_off_in_first_bill = Number(safe.one_off_incl_vat ?? 0);
    patch.price_snapshot = safe;
    patch.pricing_version = RESOLVER_VERSION;
  }

  patch.last_completed_step = body.step;
  const currentIndex = STEP_ORDER.indexOf(session.current_step as never);
  const savedIndex = STEP_ORDER.indexOf(body.step as never);
  if (savedIndex >= currentIndex) patch.current_step = nextStep(body.step);

  if (supersede) {
    // Documents already generated for the previous selections are void.
    patch.status = "active";
    patch.current_step = nextStep(body.step);
    patch.contract_snapshot_id = null;
    {
      await supabase.from("quotes")
        .update({ status: "expired" })
        .eq("id", session.quote_id)
        .in("status", ["approved", "sent", "viewed"]);
      await supabase.from("customer_journey_sessions")
        .update({ quote_id: null, quote_public_token_hash: null, order_journey_id: null, contract_summary_id: null })
        .eq("id", session.id);
    }
    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_documents_superseded",
      _title: "Journey 2 selections changed — contract documents superseded",
      _details: { session_id: session.id, step: body.step },
      _source_module: "journey2",
      _severity: "warning",
    }).then(() => {}).catch(() => {});
  }

  const upd = await supabase
    .from("customer_journey_sessions")
    .update(patch)
    .eq("id", session.id)
    .select(SESSION_COLS)
    .single();
  if (upd.error) return jsonResponse({ error: "save_failed", details: upd.error.message, retryable: true }, 500);

  return jsonResponse({ ok: true, session: upd.data, superseded: supersede });
});
