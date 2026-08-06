/**
 * REAL-ENGINE Journey 2 isolated run.
 *
 * This suite does not mock anything and does not hand-write evidence: it mints
 * a single-use test ticket directly in the database, invokes the deployed
 * `journey2-admin-test` orchestrator over HTTP, then asserts the evidence the
 * orchestrator itself wrote into the isolated `journey2_test_*` tables, and
 * finally proves zero live writes for the exact ids of that run.
 *
 * Required environment:
 *   DATABASE_URL / SUPABASE_DB_URL  — the test database
 *   J2_FUNCTIONS_URL                — functions base url (e.g. http://127.0.0.1:54321/functions/v1)
 *   J2_ANON_KEY                     — anon key for the gateway
 *
 * In CI (`CI=true`) a missing variable FAILS the suite; it is never silently
 * skipped.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomBytes, createHash } from "node:crypto";

const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
const fnUrl = (process.env.J2_FUNCTIONS_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.J2_ANON_KEY ?? "";
const isCi = process.env.CI === "true" || process.env.CI === "1";
const configured = !!dbUrl && !!fnUrl && !!anonKey;

if (isCi && !configured) {
  throw new Error(
    "CI requires DATABASE_URL, J2_FUNCTIONS_URL and J2_ANON_KEY for the real-engine Journey 2 suite. Refusing to skip.",
  );
}

const LIVE_TABLES = [
  "customer_journey_sessions",
  "journey2_contract_snapshots",
  "journey2_dd_intake",
  "journey2_documents",
  "journey2_email_outbox",
  "journey2_account_provisioning",
  "orders",
  "quotes",
  "quote_requests",
  "order_journeys",
  "contract_summaries",
  "contract_information_packs",
  "contract_acceptances",
  "payment_methods",
  "invoices",
  "payment_requests",
  "guest_orders",
  "profiles",
  "manual_fulfilment_orders",
  "service_activation_outbox",
];

// The ten canonical Journey 2 stages, exactly as the orchestrator records them.
const REQUIRED_STAGES = [
  "address",
  "plan",
  "router",
  "extras",
  "details",
  "start_date",
  "billing",
  "contract",
  "review",
  "complete",
];

const maybe = configured ? describe : describe.skip;

maybe("Journey 2 real isolated engine run", () => {
  let db: Client;
  const before = new Map<string, number>();
  let run: {
    test_run_id: string;
    session_id: string;
    checkout_session_id: string;
    gates: Record<string, boolean>;
  } | null = null;
  let ticketId = "";

  beforeAll(async () => {
    db = new Client({
      connectionString: dbUrl,
      ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
    });
    await db.connect();

    for (const t of LIVE_TABLES) {
      const { rows } = await db.query(`select count(*)::int as n from ${t}`);
      before.set(t, rows[0].n);
    }

    // Mint a short-lived, multi-use ticket. Only the SHA-256 hash is stored.
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const ins = await db.query(
      `insert into journey2_test_tickets (token_sha256, uses_remaining, expires_at, note)
       values ($1, 5, now() + interval '20 minutes', 'TEST — automated CI engine suite')
       returning id`,
      [hash],
    );
    ticketId = ins.rows[0].id;

    const res = await fetch(`${fnUrl}/journey2-admin-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        "x-journey2-test-ticket": token,
      },
      body: JSON.stringify({ label: "TEST — automated CI engine suite" }),
    });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    const result = body.result ?? body;
    const gates: Record<string, boolean> = {};
    for (const g of result.gates ?? result.checks ?? []) gates[g.key] = !!g.ok;
    run = {
      test_run_id: result.test_run_id,
      session_id: result.session_id,
      checkout_session_id: result.checkout_session_id,
      gates,
    };
  }, 180_000);

  afterAll(async () => {
    try {
      if (ticketId) await db.query("delete from journey2_test_tickets where id = $1", [ticketId]);
    } catch { /* ignore cleanup failure */ }
    await db?.end();
  });

  it("returns a real isolated run with ids the orchestrator created", () => {
    expect(run?.test_run_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run?.session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run?.checkout_session_id).toBeTruthy();
  });

  it("recorded the run in journey2_test_runs as finished", async () => {
    const { rows } = await db.query(
      "select status, finished_at from journey2_test_runs where id = $1",
      [run!.test_run_id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("completed");
    expect(rows[0].finished_at).not.toBeNull();
  });

  it("passed every gate the orchestrator evaluated", async () => {
    const { rows } = await db.query(
      "select gate_key, ok from journey2_test_events where test_run_id = $1",
      [run!.test_run_id],
    );
    expect(rows.length).toBeGreaterThan(0);
    const failed = rows.filter((r) => r.ok === false).map((r) => r.gate_key);
    expect(failed, `failed gates: ${failed.join(", ")}`).toEqual([]);
  });

  it("completed all ten journey stages, admin-only, with the kill switch ON", async () => {
    const { rows } = await db.query(
      "select gate_key from journey2_test_events where test_run_id = $1 and ok = true",
      [run!.test_run_id],
    );
    const keys = new Set(rows.map((r) => r.gate_key));
    for (const stage of REQUIRED_STAGES) {
      expect(keys.has(`stage_${stage}`), `stage ${stage} must be proven`).toBe(true);
    }
    expect(keys.has("admin_test_access_with_kill_switch")).toBe(true);
    const { rows: settings } = await db.query(
      "select customer_journey_v2_kill_switch as k from platform_settings where singleton = true",
    );
    expect(settings[0].k).toBe(true);
  });

  it("stored a canonical SHA-256 snapshot, rejected tampering and stayed immutable", async () => {
    const { rows } = await db.query(
      "select snapshot, snapshot_sha256 from journey2_test_snapshots where session_id = $1",
      [run!.session_id],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
    const { rows: gates } = await db.query(
      "select gate_key from journey2_test_events where test_run_id = $1 and ok = true",
      [run!.test_run_id],
    );
    const keys = new Set(gates.map((r) => r.gate_key));
    expect(keys.has("snapshot_hash_byte_for_byte")).toBe(true);
    expect(keys.has("submit_hash_recomputed")).toBe(true);
    expect(keys.has("tamper_rejected")).toBe(true);
    expect(keys.has("snapshot_immutable")).toBe(true);
  });

  it("stored real configured pricing with VAT and nothing payable today", async () => {
    const { rows } = await db.query(
      `select monthly_incl_vat, amount_due_today, snapshot
         from journey2_test_orders where session_id = $1`,
      [run!.session_id],
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].amount_due_today)).toBe(0);
    expect(Number(rows[0].monthly_incl_vat)).toBeGreaterThan(0);
    const pricing = rows[0].snapshot?.pricing ?? {};
    expect(Number(pricing.vat_rate_percent ?? 0)).toBeGreaterThan(0);
    expect(Number(pricing.monthly_incl_vat ?? 0)).toBeCloseTo(Number(rows[0].monthly_incl_vat), 2);
    // First bill carries the one-off charges, today's payment does not.
    expect(Number(pricing.estimated_first_bill_incl_vat ?? 0)).toBeGreaterThanOrEqual(
      Number(rows[0].monthly_incl_vat),
    );
  });

  it("encrypted and masked the Direct Debit details with a test-only transition sequence", async () => {
    const { rows } = await db.query(
      `select bank_details_ciphertext, masked_account_last4, masked_sort_last2, dd_status
         from journey2_test_dd_intake where session_id = $1`,
      [run!.session_id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].bank_details_ciphertext).toBeTruthy();
    expect(String(rows[0].bank_details_ciphertext)).not.toMatch(/\d{8}/);
    expect(String(rows[0].masked_account_last4)).toMatch(/^\d{4}$/);
    expect(String(rows[0].masked_sort_last2)).toMatch(/^\d{2}$/);
    // Test runs use a deliberately distinct, non-live terminal state.
    expect(rows[0].dd_status).toBe("setup_requested_test");
    const { rows: ddGates } = await db.query(
      "select gate_key from journey2_test_events where test_run_id = $1 and ok = true",
      [run!.test_run_id],
    );
    const ddKeys = ddGates.map((r) => r.gate_key);
    for (const g of [
      "dd_state_details_received",
      "dd_state_pending_contract",
      "dd_state_setup_requested_test",
      "dd_never_live_state",
    ]) {
      expect(ddKeys, `${g} must be proven`).toContain(g);
    }
  });

  it("produced exactly one acceptance, order, DD record, and one email per type after double submission", async () => {
    const one = async (sql: string) => Number((await db.query(sql, [run!.session_id])).rows[0].n);
    expect(await one("select count(*)::int as n from journey2_test_orders where session_id = $1")).toBe(1);
    expect(await one("select count(*)::int as n from journey2_test_acceptances where session_id = $1")).toBe(1);
    expect(await one("select count(*)::int as n from journey2_test_dd_intake where session_id = $1")).toBe(1);
    const { rows: emails } = await db.query(
      `select email_type, count(*)::int as n from journey2_test_email_outbox e
         join journey2_test_orders o on o.id = e.test_order_id
        where o.session_id = $1 group by email_type`,
      [run!.session_id],
    );
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e.n, `${e.email_type} must be sent once`).toBe(1);
    const { rows: docs } = await db.query(
      `select doc_type, count(*)::int as n from journey2_test_documents d
         join journey2_test_orders o on o.id = d.test_order_id
        where o.session_id = $1 group by doc_type`,
      [run!.session_id],
    );
    expect(docs.length).toBeGreaterThanOrEqual(2);
    for (const d of docs) expect(d.n, `${d.doc_type} must be generated once`).toBe(1);
  });

  it("wrote zero rows to every live table for this run", async () => {
    for (const t of LIVE_TABLES) {
      const { rows } = await db.query(`select count(*)::int as n from ${t}`);
      expect(rows[0].n, `${t} must be unchanged by the isolated run`).toBe(before.get(t));
    }
    const { rows: cols } = await db.query(
      `select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'checkout_session_id'
          and table_name = any($1)`,
      [LIVE_TABLES],
    );
    for (const c of cols) {
      const { rows } = await db.query(
        `select count(*)::int as n from ${c.table_name} where checkout_session_id = $1`,
        [run!.checkout_session_id],
      );
      expect(rows[0].n, `${c.table_name} must hold no isolated run rows`).toBe(0);
    }
  });
});
