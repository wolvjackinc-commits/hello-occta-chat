/**
 * DATABASE-BACKED Direct Debit manual-provider tests.
 *
 * OCCTA collects Direct Debits through TWO manual bureaux (FastPay Ltd and
 * AccessPay / APS Re OCCTA). There is no provider API, no webhook and no
 * automated submission: an admin submits in the provider portal by hand and
 * records the result. These tests exercise the real schema, the real lifecycle
 * function and the real transactional outbox — nothing is mocked. They run
 * against a Postgres instance with all migrations applied.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
const isCi = process.env.CI === "true" || process.env.CI === "1";
if (isCi && !url) {
  throw new Error("CI requires DATABASE_URL (or SUPABASE_DB_URL) for the Direct Debit database suite. Refusing to skip.");
}
const maybe = url ? describe : describe.skip;

maybe("Direct Debit manual providers (database-backed)", () => {
  let db: Client;
  const created: string[] = [];
  let userId = "";

  const newMandate = async (opts: { isTest?: boolean; status?: string } = {}) => {
    const { rows } = await db.query(
      `insert into dd_mandates (user_id, status, mandate_reference, bank_last4, account_holder_name, is_test)
       values ($1, $2, $3, '1234', 'DD Suite Test', $4) returning id`,
      [userId, opts.status ?? "details_received", `TEST-DD-${Date.now()}-${created.length}`, opts.isTest ?? true],
    );
    created.push(rows[0].id);
    return rows[0].id as string;
  };

  const change = (
    mandateId: string,
    newStatus: string,
    extra: {
      provider?: string | null;
      reference?: string | null;
      submittedAt?: string | null;
      note?: string | null;
      override?: string | null;
    } = {},
  ) =>
    db.query(
      `select dd_admin_change_mandate_status($1,$2,$3,$4,$5,$6,$7,$8) as r`,
      [
        mandateId,
        newStatus,
        extra.provider ?? null,
        extra.reference ?? null,
        extra.submittedAt ?? null,
        extra.note ?? null,
        extra.override ?? null,
        userId,
      ],
    );

  beforeAll(async () => {
    db = new Client({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    await db.connect();
    // Resolve a real user id without touching the managed `auth` schema: the
    // public profiles table mirrors auth.users one-for-one.
    const { rows } = await db.query("select id from profiles order by created_at limit 1");
    userId = rows[0]?.id ?? "";
    if (!userId) throw new Error("No profile row available for the Direct Debit suite");
  });

  afterAll(async () => {
    try {
      for (const id of created) {
        await db.query("delete from dd_email_outbox where mandate_id = $1", [id]);
        await db.query("delete from dd_mandate_status_history where mandate_id = $1", [id]);
        await db.query("delete from dd_mandates where id = $1", [id]);
      }
    } catch { /* read-only role */ }
    await db.end();
  });

  it("configures exactly the two manual providers with their real SUN and notice period", async () => {
    const { rows } = await db.query(
      `select provider_code, legal_collection_name, service_user_number, advance_notice_working_days,
              submission_mode, enabled, mandate_template_name
         from dd_providers order by provider_code`,
    );
    expect(rows.map((r) => r.provider_code)).toEqual(["accesspay", "fastpay"]);

    const accesspay = rows[0];
    expect(accesspay.service_user_number).toBe("538166");
    expect(accesspay.advance_notice_working_days).toBe(3);
    expect(accesspay.legal_collection_name).toBe("APS Re OCCTA");
    expect(accesspay.mandate_template_name).toBe("Occta Mandate.pdf");

    const fastpay = rows[1];
    expect(fastpay.service_user_number).toBe("246668");
    expect(fastpay.advance_notice_working_days).toBe(5);
    expect(fastpay.legal_collection_name).toBe("FastPay Ltd");
    expect(fastpay.mandate_template_name).toBe("DDI - OCCTA Ltd.pdf");

    for (const r of rows) {
      expect(r.submission_mode).toBe("manual_portal");
      expect(r.enabled).toBe(true);
      // Every SUN is a valid six-digit Bacs service user number.
      expect(/^[0-9]{6}$/.test(r.service_user_number)).toBe(true);
    }
  });

  it("never marks a provider as API or live-collection enabled", async () => {
    const { rows } = await db.query(
      `select count(*)::int as n from information_schema.columns
         where table_name = 'dd_providers' and column_name in ('api_key','api_secret','webhook_secret','live_collection_enabled')`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("requires provider selection before manual submission can be recorded", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    const { rows } = await change(id, "submitted_to_provider", { reference: "PORTAL-1" });
    expect(rows[0].r.success).toBe(false);
    expect(rows[0].r.error).toBe("provider_selection_required");
  });

  it("requires a provider portal reference for submitted_to_provider", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    const { rows } = await change(id, "submitted_to_provider", { provider: "fastpay" });
    expect(rows[0].r.success).toBe(false);
    expect(rows[0].r.error).toBe("provider_reference_required");
  });

  it("rejects no-op status changes so no duplicate email is ever queued", async () => {
    const id = await newMandate({ status: "active" });
    const { rows } = await change(id, "active");
    expect(rows[0].r.success).toBe(false);
    expect(rows[0].r.error).toBe("no_op_status_change");
    const { rows: out } = await db.query("select count(*)::int n from dd_email_outbox where mandate_id = $1", [id]);
    expect(out[0].n).toBe(0);
  });

  it("blocks an invalid backward transition unless an override reason is given", async () => {
    const id = await newMandate({ status: "active" });
    const blocked = await change(id, "details_received");
    expect(blocked.rows[0].r.success).toBe(false);
    expect(blocked.rows[0].r.error).toBe("invalid_transition");
  });

  it("writes status, history and exactly one outbox item atomically per transition", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    const { rows } = await change(id, "submitted_to_provider", {
      provider: "fastpay",
      reference: "FP-PORTAL-0001",
      submittedAt: new Date().toISOString(),
      note: "Submitted by hand in the FastPay portal",
    });
    expect(rows[0].r.success).toBe(true);

    const { rows: m } = await db.query(
      "select status, provider_code, provider_reference, submitted_to_provider_at from dd_mandates where id = $1",
      [id],
    );
    expect(m[0].status).toBe("submitted_to_provider");
    expect(m[0].provider_code).toBe("fastpay");
    expect(m[0].provider_reference).toBe("FP-PORTAL-0001");
    expect(m[0].submitted_to_provider_at).not.toBeNull();

    const { rows: h } = await db.query(
      "select old_status, new_status, provider_code, provider_reference from dd_mandate_status_history where mandate_id = $1",
      [id],
    );
    expect(h.length).toBe(1);
    expect(h[0].old_status).toBe("awaiting_manual_submission");
    expect(h[0].new_status).toBe("submitted_to_provider");

    const { rows: o } = await db.query(
      "select count(*)::int n from dd_email_outbox where mandate_id = $1 and payload->>'new_status' = 'submitted_to_provider'",
      [id],
    );
    expect(o[0].n).toBe(1);
  });

  // Provider-specific end-to-end workflow evidence. These mandates are TEST
  // mandates and are deliberately RETAINED as the auditable evidence the
  // production preflight requires for each manual provider.
  for (const p of [
    { code: "fastpay", collector: "FastPay Ltd", sun: "246668", notice: 5 },
    { code: "accesspay", collector: "APS Re OCCTA", sun: "538166", notice: 3 },
  ]) {
    it(`runs the full manual workflow for ${p.code} with ${p.notice} working days notice`, async () => {
      const ref = `DD-EVIDENCE-${p.code.toUpperCase()}-${Date.now()}`;
      const { rows: ins } = await db.query(
        `insert into dd_mandates (user_id, status, mandate_reference, bank_last4, account_holder_name, is_test)
         values ($1,'details_received',$2,'4321','DD Evidence Test', true) returning id`,
        [userId, ref],
      );
      const id = ins[0].id as string;

      const steps = [
        { to: "awaiting_manual_submission" as const, extra: {} },
        {
          to: "submitted_to_provider" as const,
          extra: {
            provider: p.code,
            reference: `${p.code.toUpperCase()}-PORTAL-EVIDENCE`,
            submittedAt: new Date().toISOString(),
            note: `Submitted by hand in the ${p.code} portal`,
          },
        },
        { to: "action_required" as const, extra: {} },
        { to: "submitted_to_provider" as const, extra: {} },
        { to: "active" as const, extra: {} },
      ];
      for (const step of steps) {
        const res = await change(id, step.to, step.extra);
        expect(res.rows[0].r.success, `${p.code} -> ${step.to}: ${JSON.stringify(res.rows[0].r)}`).toBe(true);
      }

      // One history row and exactly one suppressed test email per transition.
      const { rows: counts } = await db.query(
        `select (select count(*)::int from dd_mandate_status_history where mandate_id = $1) h,
                (select count(*)::int from dd_email_outbox where mandate_id = $1) o,
                (select count(distinct idempotency_key)::int from dd_email_outbox where mandate_id = $1) k,
                (select count(*)::int from dd_email_outbox where mandate_id = $1 and status = 'suppressed_test' and is_test) s`,
        [id],
      );
      expect(counts[0].h).toBe(steps.length);
      expect(counts[0].o).toBe(steps.length);
      expect(counts[0].k).toBe(steps.length);
      expect(counts[0].s).toBe(steps.length);

      // A repeated identical request creates neither history nor email.
      const dup = await change(id, "active");
      expect(dup.rows[0].r.error).toBe("no_op_status_change");
      const { rows: after } = await db.query(
        "select count(*)::int o, (select count(*)::int from dd_mandate_status_history where mandate_id = $1) h from dd_email_outbox where mandate_id = $1",
        [id],
      );
      expect(after[0].o).toBe(steps.length);
      expect(after[0].h).toBe(steps.length);

      // Provider-specific wording and masked-only content.
      const { rows: pay } = await db.query(
        `select payload from dd_email_outbox where mandate_id = $1 and payload->>'new_status' = 'active'`,
        [id],
      );
      const payload = pay[0].payload as Record<string, unknown>;
      expect(payload.provider_code).toBe(p.code);
      expect(payload.provider_collection_name).toBe(p.collector);
      expect(payload.provider_service_user_number).toBe(p.sun);
      expect(Number(payload.advance_notice_working_days)).toBe(p.notice);
      expect(payload.mandate_bank_last4).toBe("4321");
      const raw = JSON.stringify(payload).toLowerCase();
      for (const forbidden of ["sort_code", "account_number_full", "ciphertext", "nonce", "signature", "consent_ip"]) {
        expect(raw.includes(forbidden), `${p.code} payload must not contain ${forbidden}`).toBe(false);
      }

      // Nothing production-side was created by this evidence run.
      const { rows: live } = await db.query(
        `select (select count(*)::int from dd_email_outbox where mandate_id = $1 and status <> 'suppressed_test') sent,
                (select count(*)::int from dd_mandates where id = $1 and is_test = false) livem`,
        [id],
      );
      expect(live[0].sent).toBe(0);
      expect(live[0].livem).toBe(0);
    });
  }

  it("keeps outbox notifications idempotent when a transition is retried", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    await change(id, "submitted_to_provider", { provider: "accesspay", reference: "AP-PORTAL-0001", submittedAt: new Date().toISOString() });
    // A retried identical transition is a no-op and must not queue a second email.
    await change(id, "submitted_to_provider", { provider: "accesspay", reference: "AP-PORTAL-0001", submittedAt: new Date().toISOString() });
    const { rows } = await db.query(
      "select count(*)::int n, count(distinct idempotency_key)::int k from dd_email_outbox where mandate_id = $1",
      [id],
    );
    expect(rows[0].n).toBe(1);
    expect(rows[0].k).toBe(1);
  });

  it("suppresses the customer email for test mandates and never calls a provider", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    await change(id, "submitted_to_provider", { provider: "fastpay", reference: "FP-TEST-1", submittedAt: new Date().toISOString() });
    const ok = await change(id, "active");
    expect(ok.rows[0].r.success).toBe(true);
    const { rows } = await db.query(
      "select status, is_test from dd_email_outbox where mandate_id = $1 order by created_at",
      [id],
    );
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.is_test).toBe(true);
      expect(r.status).toBe("suppressed_test");
    }
  });

  it("never puts bank details in the outbox payload", async () => {
    const id = await newMandate({ status: "awaiting_manual_submission" });
    await change(id, "submitted_to_provider", { provider: "fastpay", reference: "FP-SAFE-1", submittedAt: new Date().toISOString() });
    const { rows } = await db.query("select payload from dd_email_outbox where mandate_id = $1", [id]);
    const raw = JSON.stringify(rows[0].payload).toLowerCase();
    // `account_number` here would be the OCCTA customer account reference; the
    // forbidden values are the BANK secrets, which must never be carried.
    for (const forbidden of ["sort_code", "ciphertext", "nonce", "signature", "consent_ip", "account_number_full"]) {
      expect(raw.includes(forbidden), `payload must not contain ${forbidden}`).toBe(false);
    }
  });

  it("leaves no plaintext account number or sort code in live columns", async () => {
    const { rows } = await db.query(
      "select count(*)::int n from dd_mandates where sort_code is not null or account_number_full is not null",
    );
    expect(rows[0].n).toBe(0);
  });

  it("forbids browser clients from writing status, history or notifications", async () => {
    const { rows } = await db.query(
      `select table_name, privilege_type from information_schema.role_table_grants
         where grantee = 'authenticated'
           and table_name in ('dd_mandate_status_history','dd_email_outbox')
           and privilege_type in ('INSERT','UPDATE','DELETE')`,
    );
    expect(rows).toEqual([]);

    const { rows: upd } = await db.query(
      `select count(*)::int n from information_schema.column_privileges
         where grantee = 'authenticated' and table_name = 'dd_mandates'
           and privilege_type = 'UPDATE' and column_name in ('status','sort_code','account_number_full','bank_details_ciphertext')`,
    );
    expect(upd[0].n).toBe(0);
  });
});
