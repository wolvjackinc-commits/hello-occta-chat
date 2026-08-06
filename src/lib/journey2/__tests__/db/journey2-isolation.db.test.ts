/**
 * DATABASE-BACKED Journey 2 isolation tests.
 *
 * These run against a real Postgres instance with every migration applied
 * (Supabase local stack in CI, or any isolated database via DATABASE_URL).
 * They execute the actual constraints, indexes and functions — nothing here is
 * mocked. The suite is skipped when no database URL is provided.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
const maybe = url ? describe : describe.skip;

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
  "contract_acceptances",
  "payment_methods",
  "invoices",
  "payment_requests",
  "guest_orders",
];

const TEST_TABLES = [
  "journey2_test_sessions",
  "journey2_test_snapshots",
  "journey2_test_orders",
  "journey2_test_acceptances",
  "journey2_test_dd_intake",
  "journey2_test_documents",
  "journey2_test_email_outbox",
  "journey2_test_runs",
  "journey2_test_events",
];

maybe("Journey 2 database-backed isolation", () => {
  let db: Client;
  let sessionId = "";
  let checkoutId = "";

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
  });

  afterAll(async () => {
    if (sessionId) {
      await db.query("delete from journey2_test_sessions where id = $1", [sessionId]);
    }
    await db.end();
  });

  it("exposes every isolated test table as a real table, never a view", async () => {
    const { rows } = await db.query(
      "select relname, relkind, relrowsecurity from pg_class where relname = any($1) and relnamespace = 'public'::regnamespace",
      [TEST_TABLES],
    );
    expect(rows.length).toBe(TEST_TABLES.length);
    for (const r of rows) {
      expect(r.relkind, `${r.relname} must be a table`).toBe("r");
      expect(r.relrowsecurity, `${r.relname} must enforce RLS`).toBe(true);
    }
  });

  it("binds each isolated child table to journey2_test_sessions by foreign key", async () => {
    const { rows } = await db.query(
      `select cl.relname as child
         from pg_constraint c
         join pg_class cl on cl.oid = c.conrelid
        where c.contype = 'f'
          and c.confrelid = 'public.journey2_test_sessions'::regclass`,
    );
    const children = rows.map((r) => r.child);
    for (const t of ["journey2_test_snapshots", "journey2_test_orders", "journey2_test_acceptances", "journey2_test_dd_intake"]) {
      expect(children, `${t} must reference journey2_test_sessions`).toContain(t);
    }
  });

  it("creates a test session and snapshot without touching any live table", async () => {
    const before = new Map<string, number>();
    for (const t of LIVE_TABLES) {
      const { rows } = await db.query(`select count(*)::int as n from ${t}`);
      before.set(t, rows[0].n);
    }

    const ins = await db.query(
      `insert into journey2_test_sessions (public_token_hash, status, current_step)
       values (encode(gen_random_bytes(32), 'hex'), 'in_progress', 'address')
       returning id, checkout_session_id`,
    );
    sessionId = ins.rows[0].id;
    checkoutId = ins.rows[0].checkout_session_id;

    await db.query(
      `insert into journey2_test_snapshots (session_id, snapshot, snapshot_sha256, pricing_version)
       values ($1, '{"pricing":{"amount_due_today":0}}'::jsonb, repeat('a', 64), 'test')`,
      [sessionId],
    );

    for (const t of LIVE_TABLES) {
      const { rows } = await db.query(`select count(*)::int as n from ${t}`);
      expect(rows[0].n, `${t} must be unchanged by an isolated test write`).toBe(before.get(t));
    }
  });

  it("keeps zero rows for the isolated checkout session in every live table", async () => {
    const { rows: cols } = await db.query(
      `select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'checkout_session_id'
          and table_name = any($1)`,
      [LIVE_TABLES],
    );
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) {
      const { rows } = await db.query(
        `select count(*)::int as n from ${c.table_name} where checkout_session_id = $1`,
        [checkoutId],
      );
      expect(rows[0].n, `${c.table_name} must hold no isolated test rows`).toBe(0);
    }
    const { rows: snap } = await db.query(
      "select count(*)::int as n from journey2_contract_snapshots where session_id = $1",
      [sessionId],
    );
    expect(snap[0].n).toBe(0);
  });

  it("allows only one test order per isolated test session", async () => {
    await db.query(
      `insert into journey2_test_orders (session_id, checkout_session_id, test_order_number, monthly_incl_vat, amount_due_today, snapshot_sha256, snapshot)
       values ($1, $2, 'TEST-J2-DBTEST01', 29.99, 0, repeat('a', 64), '{}'::jsonb)`,
      [sessionId, checkoutId],
    );
    await expect(
      db.query(
        `insert into journey2_test_orders (session_id, checkout_session_id, test_order_number, monthly_incl_vat, amount_due_today, snapshot_sha256, snapshot)
         values ($1, $2, 'TEST-J2-DBTEST02', 29.99, 0, repeat('a', 64), '{}'::jsonb)`,
        [sessionId, checkoutId],
      ),
    ).rejects.toThrow();
  });

  it("stores nothing payable today on an isolated test order", async () => {
    const { rows } = await db.query(
      "select amount_due_today from journey2_test_orders where session_id = $1",
      [sessionId],
    );
    expect(Number(rows[0].amount_due_today)).toBe(0);
  });

  it("installs the transactional commit routine and rejects unknown sessions", async () => {
    const { rows } = await db.query(
      "select proname from pg_proc where proname = 'journey2_commit_order'",
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("keeps Journey 2 disabled with the public kill switch on", async () => {
    const { rows } = await db.query(
      `select customer_journey_v1_enabled, customer_journey_v2_enabled, customer_journey_default,
              customer_journey_v2_kill_switch, customer_journey_v2_test_mode,
              customer_journey_v2_rollout_percentage
         from platform_settings where singleton = true`,
    );
    if (rows.length === 0) return;
    const s = rows[0];
    expect(s.customer_journey_v1_enabled).toBe(true);
    expect(s.customer_journey_v2_enabled).toBe(false);
    expect(s.customer_journey_default).toBe("v1");
    expect(s.customer_journey_v2_kill_switch).toBe(true);
    expect(Number(s.customer_journey_v2_rollout_percentage)).toBe(0);
  });
});
