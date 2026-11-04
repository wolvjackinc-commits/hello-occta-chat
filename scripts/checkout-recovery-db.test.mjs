// Checkout recovery desk tests against real PostgreSQL (PGlite).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let db;
const staff = randomUUID();
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await rows(sql, p))[0];
const asUser = (uid) => db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [uid ?? '']);
let seq = 0, sp = 0;

async function rejectsSql(run, re) {
  const name = `sp${++sp}`;
  await db.exec(`SAVEPOINT ${name}`);
  try { await assert.rejects(run(), re); } finally { await db.exec(`ROLLBACK TO SAVEPOINT ${name}`); }
}

/** An abandoned Journey 2 checkout (2 hours inactive) with contact details. */
async function session(o = {}) {
  seq++;
  const details = { full_name: o.name ?? `Person ${seq}`, phone: o.phone === undefined ? '07700 900' + String(100 + seq) : o.phone,
    email: o.email === undefined ? `p${seq}@example.test` : o.email, marketing_consent: false };
  const s = await one(`INSERT INTO customer_journey_sessions(customer_details, status, current_step, test_session, last_activity_at,
      abandoned_at, completed_at, contract_acceptance_id, created_at, checkout_tracking_started_at)
    VALUES ($1,$2,$3,$4, now() - interval '2 hours', $5, $6, $7, now() - interval '3 hours', now() - interval '3 hours') RETURNING id`,
    [JSON.stringify(details), o.status ?? 'active', o.step ?? 'details', o.test ?? false,
      o.abandoned === false ? null : new Date(Date.now() - 3600e3).toISOString(), o.completedAt ?? null, o.acceptance ?? null]);
  if (o.abandoned !== false) {
    await db.query(`INSERT INTO activity_log(event_type, ts, details) VALUES ('checkout_abandoned', now() - interval '1 hour', $1)`,
      [JSON.stringify({ journey_session_id: s.id })]);
  }
  return s.id;
}

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync('supabase/tests/checkout-recovery-fixture.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261104190000_checkout_recovery_desk.sql', 'utf8'));
  // Idempotent: a second run must succeed.
  await db.exec(readFileSync('supabase/migrations/20261104190000_checkout_recovery_desk.sql', 'utf8'));
  await db.query("INSERT INTO user_roles VALUES ($1,'support_agent')", [staff]);
  await db.query("INSERT INTO profiles(id,email) VALUES ($1,'agent@occta.test')", [staff]);
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('BEGIN'); await asUser(staff); });
afterEach(async () => { await db.exec('ROLLBACK'); });

test('non-staff cannot read the queue, stats or log contacts', async () => {
  const id = await session();
  await asUser(randomUUID());
  await rejectsSql(() => db.query('SELECT * FROM admin_checkout_recovery_queue()'), /staff access required/);
  await rejectsSql(() => db.query('SELECT admin_checkout_recovery_stats()'), /staff access required/);
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'no_answer')", [id]), /staff access required/);
  await asUser(null);
  await rejectsSql(() => db.query('SELECT * FROM admin_checkout_recovery_history($1)', [id]), /staff access required/);
});

test('queue lists real unfinished abandoned checkouts only, signed contracts first', async () => {
  const plain = await session({ step: 'plan' });
  const signed = await session({ status: 'contract_accepted', step: 'review', acceptance: randomUUID() });
  await session({ test: true });
  await session({ completedAt: new Date().toISOString() });
  await session({ abandoned: false });
  await session({ phone: null, email: null });
  const q = await rows('SELECT * FROM admin_checkout_recovery_queue()');
  assert.deepEqual(q.map((r) => r.session_id), [signed, plain]);
  assert.equal(q[0].contract_signed, true);
  assert.equal(q[1].phone.startsWith('07700'), true);
  assert.ok(q[1].first_abandoned_at);
});

test('existing customers are flagged in the queue', async () => {
  const id = await session({ email: 'Known@Example.test' });
  await db.query("INSERT INTO guest_orders(email) VALUES ('known@example.test')");
  const r = await one('SELECT existing_customer FROM admin_checkout_recovery_queue() WHERE session_id=$1', [id]);
  assert.equal(r.existing_customer, true);
});

test('logging validates outcome and callback time, records staff and timeline event', async () => {
  const id = await session();
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'recovered')", [id]), /invalid recovery outcome/);
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'callback_requested')", [id]), /callback needs a time/);
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'callback_requested',null, now() + interval '90 days')", [id]), /callback needs a time/);
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'no_answer')", [randomUUID()]), /not found/);

  await db.query("SELECT admin_log_checkout_recovery($1,'callback_requested','  Asked for Thursday ', now() + interval '1 day')", [id]);
  const q = await one('SELECT * FROM admin_checkout_recovery_queue() WHERE session_id=$1', [id]);
  assert.equal(q.last_outcome, 'callback_requested');
  assert.equal(q.contact_attempts, 1);
  const h = await one('SELECT * FROM admin_checkout_recovery_history($1)', [id]);
  assert.equal(h.note, 'Asked for Thursday');
  assert.equal(h.staff_email, 'agent@occta.test');
  const ev = await one("SELECT * FROM activity_log WHERE event_type='checkout_recovery_contact'");
  assert.equal(ev.details.journey_session_id, id);
  assert.equal(ev.details.staff_user_id, staff);
  assert.equal(JSON.stringify(ev.details).includes('Thursday'), false, 'note text must not be copied into the activity log');

  // callback time is ignored for other outcomes
  await db.query("SELECT admin_log_checkout_recovery($1,'no_answer',null, now() + interval '1 day')", [id]);
  assert.equal((await one('SELECT callback_at FROM admin_checkout_recovery_queue() WHERE session_id=$1', [id])).callback_at, null);
});

test('test sessions cannot be logged against', async () => {
  const id = await session({ test: true });
  await rejectsSql(() => db.query("SELECT admin_log_checkout_recovery($1,'no_answer')", [id]), /not found/);
});

test('contacts are append-only', async () => {
  const id = await session();
  await db.query("SELECT admin_log_checkout_recovery($1,'voicemail','left msg')", [id]);
  await rejectsSql(() => db.query("UPDATE checkout_recovery_contacts SET outcome='no_answer'"), /append-only/);
});

test('do not contact sets the opt-out, and it can be withdrawn', async () => {
  const id = await session();
  await db.query("SELECT admin_log_checkout_recovery($1,'do_not_contact')", [id]);
  assert.ok((await one('SELECT recovery_opt_out_at FROM customer_journey_sessions WHERE id=$1', [id])).recovery_opt_out_at);
  await db.query("SELECT admin_log_checkout_recovery($1,'opt_out_withdrawn')", [id]);
  assert.equal((await one('SELECT recovery_opt_out_at FROM customer_journey_sessions WHERE id=$1', [id])).recovery_opt_out_at, null);
});

test('reminder sender emails ordinary abandoned checkouts but skips signed, opted-out and existing customers', async () => {
  const ok = await session({ email: 'fine@example.test' });
  await session({ email: 'signed@example.test', status: 'contract_accepted' });
  await session({ email: 'accepted@example.test', acceptance: randomUUID() });
  const opted = await session({ email: 'stop@example.test' });
  await db.query("SELECT admin_log_checkout_recovery($1,'do_not_contact')", [opted]);
  await session({ email: 'cust@example.test' });
  const p = randomUUID();
  await db.query("INSERT INTO profiles(id,email) VALUES ($1,'CUST@example.test')", [p]);
  await db.query('INSERT INTO services(user_id) VALUES ($1)', [p]);
  await session({ email: 'signedcs@example.test' });
  await db.query("INSERT INTO contract_summaries(customer_email_snapshot,status) VALUES ('signedcs@example.test','accepted')");

  const res = await one('SELECT process_checkout_tracking() r');
  assert.equal(res.r.queued, 1);
  const sent = await rows('SELECT body FROM net.requests');
  assert.deepEqual(sent.map((s) => s.body.to), ['fine@example.test']);
  assert.equal((await one('SELECT reminder_count FROM customer_journey_sessions WHERE id=$1', [ok])).reminder_count, 1);
});

test('stats count recovery honestly, with touches before completion only', async () => {
  const done = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const viaReminder = await session({ completedAt: done(0.5) });
  await db.query("INSERT INTO checkout_reminders(journey_session_id,reminder_number,status,queued_at,delivered_at) VALUES ($1,1,'sent',now()-interval '50 minutes',now()-interval '50 minutes')", [viaReminder]);
  const viaCall = await session({ completedAt: done(0.1) });
  await db.query("INSERT INTO checkout_recovery_contacts(journey_session_id,staff_user_id,outcome,created_at) VALUES ($1,$2,'will_complete_online',now()-interval '20 minutes')", [viaCall, staff]);
  const unprompted = await session({ completedAt: done(0.2) });
  // A reminder sent after completion is not a touch.
  await db.query("INSERT INTO checkout_reminders(journey_session_id,reminder_number,status,queued_at,delivered_at) VALUES ($1,1,'sent',now(),now())", [unprompted]);
  await session({ completedAt: done(0.2), abandoned: false }); // never abandoned: not "recovered"
  await session(); // still open, phone on file
  await session({ test: true, completedAt: done(0.1) });

  const s = (await one('SELECT admin_checkout_recovery_stats(30) s')).s;
  assert.equal(s.started, 5);
  assert.equal(s.abandoned, 4);
  assert.equal(s.recovered, 3);
  assert.equal(s.recovered_after_reminder, 1);
  assert.equal(s.recovered_after_staff_contact, 1);
  assert.equal(s.recovered_without_touch, 1);
  assert.equal(s.open_abandoned, 1);
  assert.equal(s.open_with_phone, 1);
  assert.equal(Number(s.recovery_rate), 75);
  assert.deepEqual(s.outcomes, { will_complete_online: 1 });
});
