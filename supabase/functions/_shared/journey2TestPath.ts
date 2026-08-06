/**
 * Journey 2 — the DEDICATED ISOLATED TEST PATH.
 *
 * Every write in this module targets a `journey2_test_*` table. Nothing here
 * touches customer_journey_sessions, journey2_contract_snapshots,
 * quote_requests, quotes, order_journeys, contract_summaries,
 * contract_information_packs, contract_acceptances, payment_methods, orders,
 * profiles/auth, live outboxes or any supplier/billing table.
 *
 * It deliberately mirrors the live step validation, the live pricing resolver,
 * the single canonical snapshot builder and the single document-pack builder,
 * so a test run exercises the same rules as production while remaining
 * physically separated at the table level.
 */
import { generateTokenPair, sha256Hex } from "./quoteHelpers.ts";
import { loadJourneySettings, resolveJourney2Price, planNameFor, JOURNEY2_SETUP, type JourneySettings } from "./journey2.ts";
import { RESOLVER_VERSION } from "./buildPlanResolver.ts";
import { encryptJson } from "./ddCrypto.ts";
import {
  buildJourney2Snapshot, snapshotFingerprint, verifyStoredSnapshot,
  snapshotMatchesSession, type Journey2Snapshot,
} from "./journey2Snapshot.ts";
import { buildJourney2DocumentPack, REQUIRED_DOC_TYPES } from "./journey2Docs.ts";
import { z } from "https://esm.sh/zod@3.23.8";

export const TEST_LABEL = "TEST — Journey 2 isolated run";

/** The ten logical stages a Journey 2 order passes through. */
export const TEST_STAGES = [
  "address", "plan", "router", "extras", "details",
  "start_date", "billing", "contract", "review", "complete",
] as const;
export type TestStage = typeof TEST_STAGES[number];

/** Direct Debit states permitted in test mode. Never pending_activation/active. */
export const TEST_DD_LIFECYCLE = [
  "details_received", "pending_contract", "suppressed_test", "setup_requested_test",
] as const;

export const TEST_SESSION_COLS = `
  id, test_run_id, label, journey_version, test_session, status, current_step,
  last_completed_step, checkout_session_id, postcode, service_address, speed_bucket,
  plan_term, router_option, setup_option, selected_addons, digital_voice_acknowledged,
  customer_details, preferred_start_date, cooling_off_acknowledged, billing_anchor_day,
  dd_consent, dd_masked, dd_status, price_snapshot, contract_locked, test_snapshot_id,
  accepted_at, submitted_at, created_at, updated_at
`;

export type TestSession = Record<string, any>;
export type StepResult = { ok: true; session: TestSession } | { ok: false; error: string; status: number; details?: unknown };

const fail = (error: string, status = 400, details?: unknown): StepResult => ({ ok: false, error, status, details });

// ── Step validation (mirrors the live journey) ──────────────────────────────
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
  digital_voice_acknowledged: z.boolean().optional(),
});
const DetailsPayload = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(10).max(30),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  age_18_confirmed: z.literal(true),
  billing_address_same: z.boolean().default(true),
  current_provider: z.string().trim().max(80).optional().nullable(),
  current_contract_status: z.enum(["out_of_contract", "in_contract", "unknown", "new_line"]),
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
const BillingPayload = z.object({
  billing_anchor_day: z.number().int().min(1).max(31),
  dd_consent: z.literal(true),
  dd_details: z.object({
    account_holder_name: z.string().trim().min(2).max(100),
    sort_code: z.string().regex(/^\d{6}$/),
    account_number: z.string().regex(/^\d{8}$/),
    bank_name: z.string().trim().min(2).max(100),
    billing_address: z.string().trim().min(3).max(400),
    postcode: z.string().trim().min(3).max(12),
    uk_account_confirmed: z.literal(true),
    payer_authorised_confirmed: z.literal(true),
  }),
});

const MATERIAL_STEPS = new Set(["plan", "router", "extras", "start_date", "billing"]);

// ── Session lifecycle ──────────────────────────────────────────────────────

export async function createTestSession(
  supabase: any,
  opts: { testRunId?: string | null } = {},
): Promise<{ ok: true; token: string; session: TestSession } | { ok: false; error: string }> {
  const { raw, hash } = await generateTokenPair();
  const ins = await supabase.from("journey2_test_sessions").insert({
    test_run_id: opts.testRunId ?? null,
    label: TEST_LABEL,
    public_token_hash: hash,
    status: "in_progress",
    current_step: "address",
  }).select(TEST_SESSION_COLS).single();
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, token: raw, session: ins.data };
}

export async function loadTestSessionByToken(supabase: any, token: string): Promise<TestSession | null> {
  const hash = await sha256Hex(token);
  const { data } = await supabase.from("journey2_test_sessions")
    .select(TEST_SESSION_COLS).eq("public_token_hash", hash).maybeSingle();
  return data ?? null;
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const todayYmd = () => new Date().toISOString().slice(0, 10);

/** Saves one pre-contract step against the isolated test session only. */
export async function saveTestStep(
  supabase: any,
  settings: JourneySettings,
  session: TestSession,
  step: string,
  payload: Record<string, unknown>,
): Promise<StepResult> {
  if (session.contract_locked && MATERIAL_STEPS.has(step)) {
    return fail("contract_locked", 409);
  }
  const patch: Record<string, unknown> = { last_completed_step: step };

  if (step === "address") {
    const p = AddressPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    patch.postcode = p.data.postcode.toUpperCase();
    patch.service_address = p.data;
    patch.current_step = "plan";
  } else if (step === "plan") {
    const p = PlanPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    patch.speed_bucket = p.data.speed_bucket;
    patch.plan_term = p.data.plan_term;
    patch.current_step = "router";
  } else if (step === "router") {
    const p = RouterPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    patch.router_option = p.data;
    patch.current_step = "extras";
  } else if (step === "extras") {
    const p = ExtrasPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    if (p.data.addons.includes("digital_voice") && !p.data.digital_voice_acknowledged) {
      return fail("digital_voice_acknowledgement_required", 400);
    }
    patch.selected_addons = p.data.addons;
    patch.digital_voice_acknowledged = p.data.addons.includes("digital_voice")
      ? !!p.data.digital_voice_acknowledged : false;
    patch.current_step = "details";
  } else if (step === "details") {
    const p = DetailsPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    const dob = new Date(`${p.data.date_of_birth}T00:00:00Z`);
    const eighteen = new Date(Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()));
    if (!(eighteen.getTime() <= Date.now())) return fail("must_be_18", 400);
    if (p.data.number_action === "port_in" && !p.data.number_to_port) return fail("number_to_port_required", 400);
    patch.customer_details = p.data;
    patch.current_step = "start_date";
  } else if (step === "start_date") {
    const p = StartDatePayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    const earliest = addDays(todayYmd(), 14);
    if (p.data.preferred_start_date < earliest) {
      return fail("date_before_earliest", 400, { earliest_selectable_start_date: earliest });
    }
    if (p.data.preferred_start_date > addDays(todayYmd(), 90)) return fail("date_too_far", 400);
    patch.preferred_start_date = p.data.preferred_start_date;
    patch.cooling_off_acknowledged = true;
    patch.current_step = "billing";
  } else if (step === "billing") {
    const p = BillingPayload.safeParse(payload);
    if (!p.success) return fail("validation", 400, p.error.flatten());
    if (!session.preferred_start_date) return fail("start_date_required_first", 409);
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
      return fail(`dd_encryption_unavailable:${(e as Error).message}`, 503);
    }
    const masked = {
      last4: p.data.dd_details.account_number.slice(-4),
      sort_last2: p.data.dd_details.sort_code.slice(-2),
      bank_name: p.data.dd_details.bank_name,
      account_holder_name: p.data.dd_details.account_holder_name,
      status: "details_received",
    };
    // ISOLATED: encrypted bank details go only to journey2_test_dd_intake.
    const up = await supabase.from("journey2_test_dd_intake").upsert({
      session_id: session.id,
      label: TEST_LABEL,
      bank_details_ciphertext: enc.ciphertext_hex,
      nonce: enc.nonce_hex,
      enc_key_id: enc.key_id,
      enc_alg: "AES-256-GCM",
      masked_account_last4: masked.last4,
      masked_sort_last2: masked.sort_last2,
      bank_name: masked.bank_name,
      account_holder_name: masked.account_holder_name,
      dd_status: "details_received",
    }, { onConflict: "session_id" });
    if (up.error) return fail(`dd_storage_failed:${up.error.message}`, 503);
    patch.billing_anchor_day = p.data.billing_anchor_day;
    patch.dd_consent = true;
    patch.dd_masked = masked;
    patch.dd_status = "details_received";
    patch.current_step = "contract";
  } else {
    return fail("unknown_step", 400);
  }

  // Re-resolve the authoritative price on every commercial change.
  const merged = { ...session, ...patch };
  if (merged.speed_bucket && merged.plan_term) {
    const priced = await resolveJourney2Price(supabase, settings, {
      speed_bucket: merged.speed_bucket,
      plan_term: merged.plan_term,
      router_option: merged.router_option?.router_option ?? "own",
      router_payment_type: merged.router_option?.router_payment_type ?? "none",
      addons: (merged.selected_addons ?? []) as never,
      customer_type: "residential",
    });
    if (!priced) return fail("price_unavailable", 409);
    patch.price_snapshot = priced;
    patch.setup_option = { option: JOURNEY2_SETUP, label: priced.setup.label, one_off: priced.setup.oneOff };
  }

  const upd = await supabase.from("journey2_test_sessions")
    .update(patch).eq("id", session.id).select(TEST_SESSION_COLS).single();
  if (upd.error) return fail(`test_session_update_failed:${upd.error.message}`, 500);
  return { ok: true, session: upd.data };
}

// ── Contract preparation (test snapshot table only) ─────────────────────────

export async function prepareTestContract(
  supabase: any,
  settings: JourneySettings,
  session: TestSession,
): Promise<{ ok: true; snapshot: Journey2Snapshot; snapshot_sha256: string; session: TestSession } | { ok: false; error: string; status: number }> {
  for (const req of ["service_address", "speed_bucket", "plan_term", "customer_details", "preferred_start_date", "billing_anchor_day", "dd_masked"]) {
    if (!session[req]) return { ok: false, error: `missing_${req}`, status: 409 };
  }
  const priced = session.price_snapshot;
  if (!priced) return { ok: false, error: "price_unavailable", status: 409 };

  const vatPercent = Number((settings as any).vat_default_rate ?? 20);
  const snapshot = buildJourney2Snapshot({
    session,
    priced,
    vatPercent,
    pricingVersion: RESOLVER_VERSION,
    planName: planNameFor(session.speed_bucket, session.plan_term),
    legalVersions: { terms: "v1", privacy: "v1", dd_guarantee: "v1", complaints_code: "v1" },
  });
  if (Number(snapshot.pricing.amount_due_today) !== 0) {
    return { ok: false, error: "amount_due_today_must_be_zero", status: 500 };
  }
  const fingerprint = await snapshotFingerprint(snapshot);

  // ISOLATED: test snapshots live only in journey2_test_snapshots.
  const existing = await supabase.from("journey2_test_snapshots")
    .select("id, snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  let snapId = existing.data?.id ?? null;
  let storedSnapshot = existing.data?.snapshot ?? null;
  let storedHash = existing.data?.snapshot_sha256 ?? null;
  if (!snapId) {
    const ins = await supabase.from("journey2_test_snapshots").insert({
      test_run_id: session.test_run_id ?? null,
      session_id: session.id,
      snapshot,
      snapshot_sha256: fingerprint,
      pricing_version: RESOLVER_VERSION,
    }).select("id, snapshot, snapshot_sha256").single();
    if (ins.error) return { ok: false, error: `test_snapshot_failed:${ins.error.message}`, status: 500 };
    snapId = ins.data.id;
    storedSnapshot = ins.data.snapshot;
    storedHash = ins.data.snapshot_sha256;
  }

  const cs = await supabase.from("journey2_test_contract_summaries").upsert({
    test_run_id: session.test_run_id ?? null,
    session_id: session.id,
    checkout_session_id: session.checkout_session_id,
    label: TEST_LABEL,
    status: "issued",
    snapshot_sha256: storedHash,
    summary: storedSnapshot,
    contract_information: { legal_document_versions: snapshot.legal_document_versions, cooling_off: snapshot.cooling_off },
  }, { onConflict: "session_id" });
  if (cs.error) return { ok: false, error: `test_contract_failed:${cs.error.message}`, status: 500 };

  await supabase.from("journey2_test_dd_intake")
    .update({ dd_status: "pending_contract" }).eq("session_id", session.id);

  const upd = await supabase.from("journey2_test_sessions").update({
    contract_locked: true,
    test_snapshot_id: snapId,
    dd_status: "pending_contract",
    dd_masked: { ...(session.dd_masked ?? {}), status: "pending_contract" },
    status: "contract_prepared",
    current_step: "review",
  }).eq("id", session.id).select(TEST_SESSION_COLS).single();
  if (upd.error) return { ok: false, error: `test_session_update_failed:${upd.error.message}`, status: 500 };

  return { ok: true, snapshot: storedSnapshot as Journey2Snapshot, snapshot_sha256: String(storedHash), session: upd.data };
}

// ── Acceptance (test evidence only) ────────────────────────────────────────

export async function acceptTestContract(
  supabase: any,
  session: TestSession,
  input: { accepted_name: string; acknowledgements: Record<string, boolean>; evidence?: Record<string, unknown> },
): Promise<{ ok: true; snapshot_sha256: string } | { ok: false; error: string; status: number }> {
  const { data: snap } = await supabase.from("journey2_test_snapshots")
    .select("snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  if (!snap) return { ok: false, error: "no_test_snapshot", status: 409 };

  const verified = await verifyStoredSnapshot(snap.snapshot, snap.snapshot_sha256);
  if (!verified.ok) return { ok: false, error: `snapshot_integrity:${verified.reason}`, status: 409 };

  const { data: cs } = await supabase.from("journey2_test_contract_summaries")
    .select("id").eq("session_id", session.id).maybeSingle();
  if (!cs) return { ok: false, error: "no_test_contract", status: 409 };

  const acceptedAt = new Date().toISOString();
  const ins = await supabase.from("journey2_test_acceptances").upsert({
    test_contract_summary_id: cs.id,
    session_id: session.id,
    label: TEST_LABEL,
    snapshot_sha256: snap.snapshot_sha256,
    accepted_name: input.accepted_name,
    accepted_at: acceptedAt,
    acknowledgements: input.acknowledgements,
    evidence: { ...(input.evidence ?? {}), isolated_test: true, source: "journey2-test-runner" },
  }, { onConflict: "session_id" });
  if (ins.error) return { ok: false, error: `test_acceptance_failed:${ins.error.message}`, status: 500 };

  await supabase.from("journey2_test_contract_summaries")
    .update({ status: "accepted", accepted_at: acceptedAt }).eq("session_id", session.id);
  await supabase.from("journey2_test_sessions")
    .update({ accepted_at: acceptedAt, status: "contract_accepted" }).eq("id", session.id);

  return { ok: true, snapshot_sha256: String(snap.snapshot_sha256) };
}

// ── Final submission (idempotent, test tables only) ────────────────────────

function testOrderNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `TEST-J2-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function submitTestOrder(
  supabase: any,
  session: TestSession,
): Promise<
  | { ok: true; created: boolean; test_order_id: string; test_order_number: string; snapshot_sha256: string; dd_transitions: string[] }
  | { ok: false; error: string; status: number }
> {
  if (!session.accepted_at) return { ok: false, error: "contract_not_accepted", status: 409 };

  const { data: snapRow } = await supabase.from("journey2_test_snapshots")
    .select("snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  if (!snapRow) return { ok: false, error: "no_test_snapshot", status: 409 };

  // Byte-for-byte fingerprint recomputation at submission time.
  const verified = await verifyStoredSnapshot(snapRow.snapshot, snapRow.snapshot_sha256);
  if (!verified.ok) return { ok: false, error: `snapshot_integrity:${verified.reason}`, status: 409 };
  const snapshot = snapRow.snapshot as Journey2Snapshot;
  const drift = snapshotMatchesSession(snapshot, session);
  if (!drift.ok) return { ok: false, error: `snapshot_drift:${drift.field}`, status: 409 };

  const existing = await supabase.from("journey2_test_orders")
    .select("id, test_order_number, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  if (existing.data) {
    return {
      ok: true, created: false,
      test_order_id: existing.data.id,
      test_order_number: existing.data.test_order_number,
      snapshot_sha256: String(existing.data.snapshot_sha256),
      dd_transitions: [],
    };
  }

  const p = snapshot.pricing;
  const ins = await supabase.from("journey2_test_orders").insert({
    test_run_id: session.test_run_id ?? null,
    session_id: session.id,
    checkout_session_id: session.checkout_session_id,
    test_order_number: testOrderNumber(),
    label: TEST_LABEL,
    plan_name: snapshot.product.plan_name,
    monthly_ex_vat: p.monthly_ex_vat,
    monthly_vat_amount: p.monthly_vat,
    monthly_incl_vat: p.monthly_incl_vat,
    one_off_incl_vat: p.one_off_charges_incl_vat,
    amount_due_today: 0,
    estimated_first_bill_incl_vat: p.estimated_first_bill_incl_vat,
    preferred_start_date: session.preferred_start_date,
    billing_anchor_day: session.billing_anchor_day,
    dd_masked: session.dd_masked,
    dd_status: "suppressed_test",
    snapshot_sha256: snapRow.snapshot_sha256,
    snapshot,
  }).select("id, test_order_number").single();
  if (ins.error) {
    // A concurrent duplicate lost the unique-index race: return the winner.
    const again = await supabase.from("journey2_test_orders")
      .select("id, test_order_number").eq("session_id", session.id).maybeSingle();
    if (again.data) {
      return {
        ok: true, created: false, test_order_id: again.data.id,
        test_order_number: again.data.test_order_number,
        snapshot_sha256: String(snapRow.snapshot_sha256), dd_transitions: [],
      };
    }
    return { ok: false, error: `test_order_failed:${ins.error.message}`, status: 500 };
  }
  const orderId = ins.data.id;

  // Document pack, rendered from the accepted snapshot only.
  const docs = buildJourney2DocumentPack(snapshot, {
    order_number: ins.data.test_order_number,
    snapshot_sha256: String(snapRow.snapshot_sha256),
    dd_status: "suppressed_test",
    test: true,
  });
  const docIns = await supabase.from("journey2_test_documents").upsert(
    docs.map((d) => ({
      test_order_id: orderId,
      doc_type: d.doc_type,
      title: d.title,
      snapshot_sha256: snapRow.snapshot_sha256,
      content: d.content,
    })),
    { onConflict: "test_order_id,doc_type" },
  );
  if (docIns.error) return { ok: false, error: `test_documents_failed:${docIns.error.message}`, status: 500 };

  // Welcome pack is recorded as SUPPRESSED. No provider, no recipient address.
  const mail = await supabase.from("journey2_test_email_outbox").upsert({
    test_order_id: orderId,
    email_type: "welcome_pack",
    recipient_masked: maskAddress(snapshot.customer.email),
    subject: "TEST — Your OCCTA order is confirmed",
    attachments: docs.map((d) => ({ doc_type: d.doc_type, title: d.title })),
    status: "suppressed_test",
  }, { onConflict: "test_order_id,email_type" });
  if (mail.error) return { ok: false, error: `test_outbox_failed:${mail.error.message}`, status: 500 };

  // Test Direct Debit lifecycle: never pending_activation, never active.
  await supabase.from("journey2_test_dd_intake")
    .update({ dd_status: "suppressed_test" }).eq("session_id", session.id);
  await supabase.from("journey2_test_dd_intake")
    .update({ dd_status: "setup_requested_test" }).eq("session_id", session.id);

  await supabase.from("journey2_test_sessions").update({
    status: "completed",
    current_step: "complete",
    last_completed_step: "complete",
    submitted_at: new Date().toISOString(),
    dd_status: "setup_requested_test",
  }).eq("id", session.id);

  return {
    ok: true, created: true, test_order_id: orderId,
    test_order_number: ins.data.test_order_number,
    snapshot_sha256: String(snapRow.snapshot_sha256),
    dd_transitions: ["details_received", "pending_contract", "suppressed_test", "setup_requested_test"],
  };
}

function maskAddress(email: string) {
  const [u, d] = String(email).split("@");
  return `${(u ?? "").slice(0, 2)}***@${d ?? "invalid"}`;
}

// ── Completion data, read from test tables only ────────────────────────────

export async function getTestCompletion(supabase: any, token: string) {
  const session = await loadTestSessionByToken(supabase, token);
  if (!session) return null;
  const { data: snap } = await supabase.from("journey2_test_snapshots")
    .select("snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  const { data: order } = await supabase.from("journey2_test_orders")
    .select("id, test_order_number, dd_status").eq("session_id", session.id).maybeSingle();
  if (!snap || !order) return { session, completion: null };
  const { data: docs } = await supabase.from("journey2_test_documents")
    .select("doc_type, title").eq("test_order_id", order.id);
  const s = snap.snapshot as Journey2Snapshot;
  return {
    session,
    completion: {
      test_session: true,
      order_number: order.test_order_number,
      plan_name: s.product.plan_name,
      monthly_ex_vat: s.pricing.monthly_ex_vat,
      monthly_vat: s.pricing.monthly_vat,
      monthly_incl_vat: s.pricing.monthly_incl_vat,
      one_off_charges_incl_vat: s.pricing.one_off_charges_incl_vat,
      amount_due_today: 0,
      estimated_first_bill_incl_vat: s.pricing.estimated_first_bill_incl_vat,
      vat_rate_percent: s.pricing.vat_rate_percent,
      preferred_start_date: session.preferred_start_date,
      billing_anchor_day: session.billing_anchor_day,
      dd_masked: session.dd_masked
        ? {
            last4: session.dd_masked.last4, sort_last2: session.dd_masked.sort_last2,
            bank_name: session.dd_masked.bank_name, account_holder_name: session.dd_masked.account_holder_name,
          }
        : null,
      dd_status: order.dd_status,
      cooling_off_ends_at: null,
      documents: (docs ?? []).map((d: any) => ({ label: d.title, url: null })),
      digital_voice_selected: s.digital_voice.selected,
      snapshot_sha256: snap.snapshot_sha256,
    },
  };
}

export { REQUIRED_DOC_TYPES, loadJourneySettings };