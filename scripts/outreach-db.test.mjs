// Executes the outreach migration on real PostgreSQL (PGlite) and checks the
// rules the sender relies on: eligibility, queue claims, suppression,
// engagement tracking, conversion attribution and row-level security.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const MIGRATION = "supabase/migrations/20261012140000_outreach_campaign_manager.sql";
let db;
const admin = randomUUID();
const outsider = randomUUID();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await rows(sql, params))[0];

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync("supabase/tests/outreach-fixture.sql", "utf8"));
  await db.exec(readFileSync(MIGRATION, "utf8"));
  await db.query("INSERT INTO auth.users VALUES ($1,'admin@occta.test'),($2,'someone@example.test')", [admin, outsider]);
  await db.query("INSERT INTO user_roles VALUES ($1,'admin'),($2,'user')", [admin, outsider]);
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("BEGIN"); });
afterEach(async () => { await db.exec("ROLLBACK"); });

let n = 0;
async function contact(over = {}) {
  n += 1;
  const c = {
    business_name: `Test Business ${n} Ltd`,
    email: `info${n}@business${n}.co.uk`,
    email_type: "role",
    legal_form: "limited_company",
    companies_house_number: String(10000000 + n),
    companies_house_verified: true,
    lawful_basis: "corporate_subscriber",
    consent_evidence: null,
    status: "active",
    category: "Retail",
    ...over,
  };
  return one(
    `INSERT INTO outreach_contacts (business_name,email,email_type,legal_form,companies_house_number,companies_house_verified,lawful_basis,consent_evidence,status,category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [c.business_name, c.email, c.email_type, c.legal_form, c.companies_house_number, c.companies_house_verified, c.lawful_basis, c.consent_evidence, c.status, c.category],
  );
}
async function campaign(status = "sending") {
  n += 1;
  return one("INSERT INTO outreach_campaigns (name, slug, status) VALUES ($1,$2,$3) RETURNING *", [`Campaign ${n}`, `campaign-${n}`, status]);
}
async function message(campaignId, c, over = {}) {
  return one(
    `INSERT INTO outreach_messages (campaign_id, contact_id, email, business_name, token, status, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [campaignId, c.id, c.email, c.business_name, over.token ?? randomUUID().replace(/-/g, ""), over.status ?? "queued", over.sent_at ?? null],
  );
}
/** Assert a statement fails without aborting the surrounding test transaction. */
async function rejects(sql, params = [], pattern) {
  await db.exec("SAVEPOINT expect_error");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK TO SAVEPOINT expect_error");
  }
}
async function asUser(uid, fn) {
  await db.exec("SAVEPOINT as_user");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
  await db.exec(`SET LOCAL ROLE ${uid ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("ROLLBACK TO SAVEPOINT as_user");
  }
}

test("migration installs settings, templates and the 5-minute sender schedule", async () => {
  const s = await one("SELECT * FROM outreach_settings WHERE id = 1");
  assert.equal(s.sending_enabled, false);
  assert.equal(s.from_email, null);
  const t = await rows("SELECT template_key, flyer_ref FROM outreach_templates ORDER BY template_key");
  assert.deepEqual(t.map((r) => `${r.template_key}:${r.flyer_ref}`), ["card-machine-checklist:LAST-B", "last-orders-landline:LAST-A"]);
  const job = await one("SELECT schedule, command FROM cron.job WHERE jobname = 'outreach-worker'");
  assert.equal(job.schedule, "*/5 * * * *");
  assert.match(job.command, /functions\/v1\/outreach-worker/);
  assert.match(job.command, /x-cron-secret/);
});

test("eligible: verified companies with a role inbox, or recorded consent only", async () => {
  assert.equal((await contact()).eligible, true);
  assert.equal((await contact({ legal_form: "sole_trader" })).eligible, false);
  assert.equal((await contact({ legal_form: "partnership" })).eligible, false);
  assert.equal((await contact({ companies_house_verified: false })).eligible, false);
  assert.equal((await contact({ companies_house_number: null })).eligible, false);
  assert.equal((await contact({ email_type: "personal" })).eligible, false);
  assert.equal((await contact({ lawful_basis: "none" })).eligible, false);
  assert.equal((await contact({ status: "unsubscribed" })).eligible, false);
  assert.equal((await contact({ legal_form: "sole_trader", lawful_basis: "consent", consent_evidence: "   " })).eligible, false);
  assert.equal((await contact({ legal_form: "sole_trader", lawful_basis: "consent", consent_evidence: "Signed form 2026-10-01" })).eligible, true);
});

test("emails must be stored lower-case and valid", async () => {
  await assert.rejects(contact({ email: "Info@Upper.co.uk" }));
  await assert.rejects(contact({ email: "not-an-email" }));
});

test("claim batch only takes due messages from sending campaigns, up to the limit", async () => {
  const live = await campaign("sending");
  const paused = await campaign("paused");
  for (let i = 0; i < 3; i++) await message(live.id, await contact());
  await message(paused.id, await contact());
  const future = await message(live.id, await contact());
  await db.query("UPDATE outreach_messages SET next_attempt_at = now() + interval '1 hour' WHERE id = $1", [future.id]);

  const claimed = await rows("SELECT * FROM outreach_claim_batch(2)");
  assert.equal(claimed.length, 2);
  assert.ok(claimed.every((m) => m.status === "sending" && m.attempt_count === 1 && m.campaign_id === live.id));
  const again = await rows("SELECT * FROM outreach_claim_batch(10)");
  assert.equal(again.length, 1, "only the remaining due message from the live campaign");
  assert.equal((await rows("SELECT * FROM outreach_claim_batch(0)")).length, 0);
});

test("claim batch recovers messages stuck in 'sending' after a crash", async () => {
  const live = await campaign("sending");
  const m = await message(live.id, await contact(), { status: "sending" });
  await db.query("UPDATE outreach_messages SET locked_at = now() - interval '11 minutes' WHERE id = $1", [m.id]);
  const claimed = await rows("SELECT * FROM outreach_claim_batch(5)");
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, m.id);
});

test("unsubscribe suppresses the address everywhere and records the event", async () => {
  const a = await campaign("sending");
  const b = await campaign("sending");
  const c = await contact();
  const sent = await message(a.id, c, { status: "sent", sent_at: new Date().toISOString() });
  const waiting = await message(b.id, c);
  await db.query("SELECT outreach_suppress($1, 'unsubscribed', 'test', $2)", [c.email.toUpperCase(), sent.id]);

  assert.equal((await one("SELECT reason, campaign_id FROM outreach_suppressions WHERE email = $1", [c.email])).reason, "unsubscribed");
  assert.equal((await one("SELECT status, eligible FROM outreach_contacts WHERE id = $1", [c.id])).status, "unsubscribed");
  assert.equal((await one("SELECT eligible FROM outreach_contacts WHERE id = $1", [c.id])).eligible, false);
  assert.equal((await one("SELECT status FROM outreach_messages WHERE id = $1", [waiting.id])).status, "suppressed");
  assert.ok((await one("SELECT unsubscribed_at FROM outreach_messages WHERE id = $1", [sent.id])).unsubscribed_at);
  assert.equal((await one("SELECT count(*)::int AS n FROM outreach_events WHERE message_id = $1 AND event_type = 'unsubscribe'", [sent.id])).n, 1);
  // A second unsubscribe click is harmless.
  await db.query("SELECT outreach_suppress($1, 'unsubscribed', 'test', $2)", [c.email, sent.id]);
  assert.equal((await one("SELECT count(*)::int AS n FROM outreach_suppressions WHERE email = $1", [c.email])).n, 1);
});

test("opens and clicks are counted; mail-filter scans are logged but not counted", async () => {
  const camp = await campaign("sending");
  const m = await message(camp.id, await contact(), { status: "sent", sent_at: new Date().toISOString() });
  await db.query("SELECT outreach_record_engagement($1,'open',NULL,'Scanner',true)", [m.token]);
  let r = await one("SELECT open_count, first_opened_at FROM outreach_messages WHERE id = $1", [m.id]);
  assert.equal(r.open_count, 0);
  assert.equal(r.first_opened_at, null);
  await db.query("SELECT outreach_record_engagement($1,'open',NULL,'Mozilla',false)", [m.token]);
  await db.query("SELECT outreach_record_engagement($1,'open',NULL,'Mozilla',false)", [m.token]);
  await db.query("SELECT outreach_record_engagement($1,'click','https://www.occta.co.uk/x','Mozilla',false)", [m.token]);
  r = await one("SELECT open_count, click_count, first_opened_at, first_clicked_at FROM outreach_messages WHERE id = $1", [m.id]);
  assert.equal(r.open_count, 2);
  assert.equal(r.click_count, 1);
  assert.ok(r.first_opened_at && r.first_clicked_at);
  assert.equal((await one("SELECT count(*)::int AS n FROM outreach_events WHERE message_id = $1", [m.id])).n, 4);
  assert.equal((await one("SELECT outreach_record_engagement('unknowntoken000000','open',NULL,NULL,false) AS r")).r, null);
  await assert.rejects(db.query("SELECT outreach_record_engagement($1,'bounce',NULL,NULL,false)", [m.token]));
});

test("a business lead is linked to the email that produced it (token, then email fallback)", async () => {
  const camp = await campaign("sending");
  const c1 = await contact();
  const c2 = await contact();
  const m1 = await message(camp.id, c1, { status: "sent", sent_at: new Date().toISOString() });
  const m2 = await message(camp.id, c2, { status: "sent", sent_at: new Date().toISOString() });

  const lead = await one("INSERT INTO business_leads (company_name, contact_name, email, utm) VALUES ('A','B','someone@else.co.uk', $1) RETURNING id",
    [JSON.stringify({ utm_source: "occta_outreach", utm_term: `ob-${m1.token}` })]);
  let r = await one("SELECT converted_lead_id, converted_source FROM outreach_messages WHERE id = $1", [m1.id]);
  assert.equal(r.converted_lead_id, lead.id);
  assert.equal(r.converted_source, "business_leads");

  const quote = await one("INSERT INTO business_quote_requests (company_name, contact_name, email, utm) VALUES ('A','B',$1, NULL) RETURNING id", [c2.email.toUpperCase()]);
  r = await one("SELECT converted_lead_id, converted_source FROM outreach_messages WHERE id = $1", [m2.id]);
  assert.equal(r.converted_lead_id, quote.id);
  assert.equal(r.converted_source, "business_quote_requests");
  assert.equal((await one("SELECT count(*)::int AS n FROM outreach_events WHERE event_type = 'converted'")).n, 2);
});

test("attribution can never block an enquiry", async () => {
  const lead = await one("INSERT INTO business_leads (company_name, contact_name, email, utm) VALUES ('A','B','x@y.co.uk', $1) RETURNING id",
    [JSON.stringify({ utm_term: ["not", "a", "string"] })]);
  assert.ok(lead.id);
});

test("campaign stats view counts each outcome once", async () => {
  const camp = await campaign("sending");
  const now = new Date().toISOString();
  const a = await message(camp.id, await contact(), { status: "sent", sent_at: now });
  await message(camp.id, await contact(), { status: "queued" });
  const b = await message(camp.id, await contact(), { status: "bounced", sent_at: now });
  await db.query("SELECT outreach_record_engagement($1,'click','https://www.occta.co.uk','Mozilla',false)", [a.token]);
  const s = await one("SELECT * FROM outreach_campaign_stats WHERE campaign_id = $1", [camp.id]);
  assert.deepEqual(
    { total: s.total, pending: s.pending, sent: s.sent, opened: s.opened, clicked: s.clicked, bounced: s.bounced },
    { total: 3, pending: 1, sent: 2, opened: 1, clicked: 1, bounced: 1 },
  );
  assert.ok(b.id);
});

test("row-level security: staff only, drafts editable, opt-outs permanent", async () => {
  const draft = await campaign("draft");
  const live = await campaign("sending");
  const c = await contact();
  await message(live.id, c);
  await db.query("SELECT outreach_suppress('gone@business.co.uk','unsubscribed','test',NULL)");

  await asUser(null, async () => {
    await rejects("SELECT * FROM outreach_contacts", [], /permission denied/);
    await rejects("SELECT * FROM outreach_messages", [], /permission denied/);
  });
  await asUser(outsider, async () => {
    assert.equal((await rows("SELECT * FROM outreach_contacts")).length, 0);
    assert.equal((await rows("SELECT * FROM outreach_messages")).length, 0);
    assert.equal((await rows("SELECT * FROM outreach_settings")).length, 0);
    assert.equal((await rows("SELECT * FROM outreach_campaign_stats")).length, 0);
    await rejects("SELECT * FROM outreach_claim_batch(5)", [], /permission denied/);
    await rejects("SELECT outreach_suppress('a@b.co.uk','unsubscribed','x',NULL)", [], /permission denied/);
  });
  await asUser(admin, async () => {
    assert.ok((await rows("SELECT * FROM outreach_contacts")).length >= 1);
    assert.equal((await rows("SELECT * FROM outreach_messages WHERE campaign_id = $1", [live.id])).length, 1);
    const draftEdit = await db.query("UPDATE outreach_campaigns SET subject = 'x' WHERE id = $1", [draft.id]);
    assert.equal(draftEdit.affectedRows, 1);
    const liveEdit = await db.query("UPDATE outreach_campaigns SET subject = 'x' WHERE id = $1", [live.id]);
    assert.equal(liveEdit.affectedRows, 0, "launched campaigns can't be edited directly");
    await rejects("UPDATE outreach_campaigns SET status = 'sending' WHERE id = $1", [draft.id], /row-level security/);
    await rejects("UPDATE outreach_messages SET status = 'sent'", [], /permission denied/);
    const del = await db.query("DELETE FROM outreach_suppressions WHERE email = 'gone@business.co.uk'");
    assert.equal(del.affectedRows, 0, "an unsubscribe can't be removed");
    await rejects("INSERT INTO outreach_suppressions (email, reason) VALUES ('a@b.co.uk','unsubscribed')", [], /row-level security/);
    await db.query("INSERT INTO outreach_suppressions (email, reason) VALUES ('a@b.co.uk','manual')");
    const manualDel = await db.query("DELETE FROM outreach_suppressions WHERE email = 'a@b.co.uk'");
    assert.equal(manualDel.affectedRows, 1, "staff-added entries can be removed");
    await rejects("SELECT * FROM outreach_claim_batch(5)", [], /permission denied/);
  });
});
