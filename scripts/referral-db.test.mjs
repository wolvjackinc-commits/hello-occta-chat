// Refer-a-friend engine tests against real PostgreSQL (PGlite).
// Every rule in the scheme brief has a test here, including the SWITCH50
// lesson: arrears cleared late must still fail, and no customer message is
// possible before an admin approves.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let db;
const admin = randomUUID(), support = randomUUID();
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await rows(sql, p))[0];
const asUser = (uid) => db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [uid ?? '']);
let seq = 0;

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync('supabase/tests/referral-fixture.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261031150000_referral_scheme.sql', 'utf8'));
  await db.query("INSERT INTO user_roles VALUES ($1,'admin'),($2,'support_agent')", [admin, support]);
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("BEGIN; UPDATE platform_settings SET rewards_enabled = true"); });
afterEach(async () => { await db.exec('ROLLBACK'); });

let sp = 0;
/** Expect a statement to fail without aborting the test's transaction. */
async function rejectsSql(run, re) {
  const name = `sp${++sp}`;
  await db.exec(`SAVEPOINT ${name}`);
  // A direct statement is a separate request: no function has set an actor.
  await db.exec("SELECT set_config('referral.actor_kind', '', true), set_config('referral.actor', '', true)");
  try { await assert.rejects(run(), re); } finally { await db.exec(`ROLLBACK TO SAVEPOINT ${name}`); }
}
const daysAgo = (d) => `now() - interval '${d} days'`;

/** A customer with a live service and (optionally) bills paid on time. */
async function customer(o = {}) {
  const id = randomUUID(); seq++;
  await db.query(`INSERT INTO profiles(id,email,full_name,phone,address_line1,postcode,account_number,account_type,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() - make_interval(days => $9))`,
    [id, o.email ?? `c${seq}@example.test`, o.name ?? `Customer ${seq}`, o.phone ?? `0770090${String(seq).padStart(4, '0')}`,
      o.address ?? `${seq} Long Lane`, o.postcode ?? 'HD1 1AA', o.acct ?? `OCC${10000000 + seq}`, o.type ?? 'residential', o.ageDays ?? 400]);
  if (o.live !== false) {
    const order = (await one(`INSERT INTO orders(customer_id,user_id,address_line1,postcode,created_at,lifecycle_status,actual_service_live_at_utc)
      VALUES ($1,$1,$2,$3, now() - interval '400 days','live', now() - interval '390 days') RETURNING id`,
      [id, o.address ?? `${seq} Long Lane`, o.postcode ?? 'HD1 1AA'])).id;
    await db.query("INSERT INTO services(order_id,user_id,status,created_at) VALUES ($1,$2,'active', now() - interval '390 days')", [order, id]);
  }
  return id;
}
async function code(owner, c) {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const value = c ?? Array.from({ length: 8 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
  return (await one("INSERT INTO referral_codes(customer_id, code, terms_version) VALUES ($1,$2,'raf-2026-11-v1') RETURNING *", [owner, value]));
}
/** A friend's checkout session and order. Binding happens in the order trigger. */
async function friendOrder(c, o = {}) {
  const friend = o.friend ?? await customer({ live: false, ageDays: 0, ...o.profile });
  const checkout = randomUUID();
  const orderCreated = o.orderDaysAgo ?? 90;
  // The link is captured an hour before the order is placed.
  const capturedAt = new Date(Date.now() - orderCreated * 864e5 - 3600e3).toISOString();
  const utm = o.link ? { cc: c.code, landing_path: '/', captured_at: capturedAt, ...(o.utm ?? {}) } : (o.utm ?? {});
  const details = o.typed !== false && !o.link ? { offer_code: o.typedCode ?? c.code } : {};
  const session = (await one(`INSERT INTO customer_journey_sessions(checkout_session_id, utm_snapshot, customer_details, ip, user_agent, created_at, submitted_at)
    VALUES ($1,$2,$3,'203.0.113.9','Mozilla/5.0 test', now() - interval '2 hours', now() - interval '1 hour') RETURNING id`,
    [checkout, JSON.stringify(utm), JSON.stringify(details)])).id;
  const order = (await one(`INSERT INTO orders(customer_id,user_id,checkout_session_id,occta_order_number,address_line1,postcode,created_at,campaign_code,customer_type_v2)
    VALUES ($1,$1,$2,$3,$4,$5, now() - make_interval(days => $6), $7, $8) RETURNING id`,
    [o.unlinked ? null : friend, checkout, 'OCCTA-' + seq, o.address ?? `${seq} Friend Street`, o.postcode ?? 'HD2 2BB',
      orderCreated, o.campaign ?? null, o.orderType ?? (o.business ? 'business' : null)])).id;
  await db.query('UPDATE customer_journey_sessions SET order_id = $1 WHERE id = $2', [order, session]);
  const referral = await one('SELECT * FROM referrals WHERE friend_order_id = $1', [order]);
  return { friend, order, session, referral };
}
async function goLive(f, liveDaysAgo) {
  await db.query(`UPDATE orders SET lifecycle_status = 'live', actual_service_live_at_utc = now() - make_interval(days => $2) WHERE id = $1`, [f.order, liveDaysAgo]);
  return (await one("INSERT INTO services(order_id,user_id,status) VALUES ($1,$2,'active') RETURNING id", [f.order, f.friend])).id;
}
/** An invoice due `dueDaysAgo` days ago, paid `paidDaysAfterDue` days after due (null = unpaid). */
async function bill(user, orderId, dueDaysAgo, paidDaysAfterDue, o = {}) {
  const inv = (await one(`INSERT INTO invoices(user_id, order_id, invoice_number, status, total, issue_date, due_date, invoice_type)
    VALUES ($1,$2,$3,$4,$5, current_date - $6::int - 14, current_date - $6::int, 'monthly') RETURNING id`,
    [user, orderId, 'INV-' + (++seq), paidDaysAfterDue === null ? (o.status ?? 'sent') : 'paid', o.total ?? 30, dueDaysAgo])).id;
  if (paidDaysAfterDue !== null && !o.noReceipt)
    await db.query(`INSERT INTO receipts(invoice_id,user_id,amount,paid_at) VALUES ($1,$2,$3, (current_date - $4::int + $5::int)::timestamptz)`,
      [inv, user, o.total ?? 30, dueDaysAgo, paidDaysAfterDue]);
  return inv;
}
const rewards = async (f) => Object.fromEntries((await rows('SELECT * FROM referral_rewards WHERE referral_id = $1', [f.referral.id])).map((r) => [r.role, r]));
const evaluate = (f) => one('SELECT referral_evaluate($1) AS v', [f.referral.id]);
async function qualified(o = {}) {
  const referrer = o.referrer ?? await customer(o.referrerOpts);
  const c = o.code ?? await code(referrer);
  const f = await friendOrder(c, o.friendOpts ?? {});
  await goLive(f, 70);
  await bill(f.friend, f.order, 40, 0);
  await bill(f.friend, f.order, 10, -2);
  await evaluate(f);
  return { referrer, c, f };
}
async function act(reward, action, extra = {}) {
  await asUser(extra.actor ?? admin);
  const r = await one('SELECT version FROM referral_rewards WHERE id = $1', [reward]);
  const res = (await one('SELECT referral_admin_action($1,$2,$3,$4,$5,$6) AS r',
    [extra.request ?? randomUUID(), action, reward, extra.version ?? r.version, extra.reason ?? 'Checked evidence and history in admin', extra.notify ?? false])).r;
  await asUser(null);
  return res;
}

// ---------------------------------------------------------------------------
test('terms v1 snapshot holds the agreed rules', async () => {
  const t = await one("SELECT rules FROM referral_terms_versions WHERE version = 'raf-2026-11-v1'");
  assert.deepEqual(t.rules.rewards, { residential: { referrer: 25, friend: 10 }, business: { referrer: 50, friend: 25 } });
  assert.equal(t.rules.qualify_days, 60); assert.equal(t.rules.invoices_required, 2);
  assert.deepEqual(t.rules.caps, { residential: 5, business: 10 });
  assert.equal(t.rules.charge_back_used_credit, false);
  await rejectsSql(() => db.query("UPDATE referral_terms_versions SET summary = summary || '.'"), /immutable/);
});

test('scheme switched off: no codes, no binding, no cron work', async () => {
  await db.query('UPDATE platform_settings SET rewards_enabled = false');
  const r = await customer();
  await asUser(r);
  assert.equal((await one('SELECT referral_my_code() AS v')).v.error, 'scheme_not_open');
  await asUser(null);
  const c = await code(r, 'OFFCODE2');
  const f = await friendOrder(c);
  assert.equal(f.referral, undefined);
  assert.equal((await one('SELECT referral_evaluate_all() AS n')).n, 0);
});

test('my code: live, up-to-date customers only; terms snapshot and code email queued', async () => {
  const r = await customer();
  await asUser(r);
  const res = (await one('SELECT referral_my_code() AS v')).v;
  assert.equal(res.ok, true); assert.match(res.code, /^[A-HJ-NP-Z2-9]{8}$/); assert.equal(res.terms_version, 'raf-2026-11-v1');
  assert.equal((await one('SELECT referral_my_code() AS v')).v.code, res.code, 'same code on repeat');
  await asUser(null);
  const msg = await one("SELECT * FROM referral_message_outbox WHERE template = 'your_code' AND customer_id = $1", [r]);
  assert.ok(msg.payload.summary.includes('Bill credit only')); assert.equal(msg.payload.terms_version, 'raf-2026-11-v1');
  const notLive = await customer({ live: false });
  await asUser(notLive);
  assert.equal((await one('SELECT referral_my_code() AS v')).v.error, 'needs_live_service');
  const late = await customer(); await bill(late, null, 20, 5);
  await asUser(late);
  assert.equal((await one('SELECT referral_my_code() AS v')).v.error, 'account_not_up_to_date');
  await asUser(null);
});

test('typed code binds at order time with evidence and two rewards', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c);
  assert.equal(f.referral.attribution_method, 'typed_code');
  assert.equal(f.referral.terms_version, 'raf-2026-11-v1');
  assert.equal(f.referral.evidence.typed_code, c.code);
  assert.ok(f.referral.evidence.session_id);
  const w = await rewards(f);
  assert.equal(Number(w.referrer.amount), 25); assert.equal(w.referrer.credit_gross_minor, 2500);
  assert.equal(Number(w.friend.amount), 10); assert.equal(w.friend.status, 'tracked');
  const joined = await one("SELECT * FROM referral_message_outbox WHERE template = 'friend_joined'");
  assert.equal(joined.customer_id, r); assert.equal(joined.payload.amount, '25');
});

test('link attribution records the matching click as evidence', async () => {
  const r = await customer(); const c = await code(r);
  await db.query("SELECT set_config('request.headers', $1, true)", [JSON.stringify({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 test' })]);
  const click = (await one("SELECT referral_record_click($1, 'https://www.occta.co.uk/?cc=X') AS id", [c.code])).id;
  const f = await friendOrder(c, { link: true, orderDaysAgo: 0 });
  assert.equal(f.referral.attribution_method, 'link');
  assert.equal(f.referral.click_id, click);
  assert.equal(f.referral.evidence.click_ip_matches, true);
  assert.equal((await rewards(f)).referrer.needs_review, false);
});

test('link with no click on record goes to manual review', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c, { link: true });
  const w = await rewards(f);
  assert.equal(w.referrer.needs_review, true); assert.ok(w.referrer.review_reasons.includes('no_click_evidence'));
});

test('a code is never attached after the order exists (no session capture = no referral)', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c, { typed: false });
  assert.equal(f.referral, undefined);
  await db.query("UPDATE customer_journey_sessions SET customer_details = $1 WHERE id = $2", [JSON.stringify({ offer_code: c.code }), f.session]);
  // A later session edit cannot create one: binding only runs on order changes,
  // and admin attachment needs an admin, a reason and the 7-day window.
  assert.equal((await one('SELECT count(*)::int n FROM referrals')).n, 0);
});

test('status flow: tracked → pending → qualifying → approved_awaiting_admin, never booked by the engine', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c);
  assert.equal((await rewards(f)).referrer.status, 'tracked');
  await goLive(f, 20); await evaluate(f);
  assert.equal((await rewards(f)).referrer.status, 'pending');
  await db.query("UPDATE orders SET actual_service_live_at_utc = now() - interval '61 days' WHERE id = $1", [f.order]);
  await bill(f.friend, f.order, 30, 0);
  await bill(f.friend, f.order, -5, null); // second bill not yet due
  await evaluate(f);
  assert.equal((await rewards(f)).referrer.status, 'qualifying');
  await db.query("UPDATE invoices SET status = 'paid' WHERE status = 'sent' AND user_id = $1", [f.friend]);
  await db.query("INSERT INTO receipts(invoice_id,user_id,amount,paid_at) SELECT id,user_id,total,now() FROM invoices WHERE user_id = $1 AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.invoice_id = invoices.id)", [f.friend]);
  for (let i = 0; i < 3; i++) await evaluate(f);
  const w = await rewards(f);
  assert.equal(w.referrer.status, 'approved_awaiting_admin'); assert.equal(w.friend.status, 'approved_awaiting_admin');
  assert.equal((await one("SELECT count(*)::int n FROM referral_message_outbox WHERE template IN ('reward_credited','reward_withdrawn')")).n, 0,
    'no reward message before admin approval');
  assert.equal((await one('SELECT count(*)::int n FROM referral_credit_movements')).n, 0);
});

test('qualifying period is configurable through the terms snapshot', async () => {
  await db.query(`INSERT INTO referral_terms_versions(version, effective_from, summary, rules)
    SELECT 'raf-2026-11-v2', now() - interval '200 days', summary, rules || '{"qualify_days": 90}' FROM referral_terms_versions WHERE version = 'raf-2026-11-v1'`);
  const r = await customer();
  const c = await one("INSERT INTO referral_codes(customer_id, code, terms_version) VALUES ($1,'NINETY22','raf-2026-11-v2') RETURNING *", [r]);
  const f = await friendOrder(c);
  await goLive(f, 70); await bill(f.friend, f.order, 40, 0); await bill(f.friend, f.order, 10, 0); await evaluate(f);
  assert.equal((await rewards(f)).referrer.status, 'pending', '70 days is not enough under a 90-day version');
});

test('friend paying a bill late is rejected, and paying it later never restores it', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c); await goLive(f, 70);
  await bill(f.friend, f.order, 40, 3); // paid 3 days late
  await bill(f.friend, f.order, 10, 0);
  await evaluate(f);
  const w = await rewards(f);
  assert.equal(w.referrer.status, 'rejected'); assert.match(w.referrer.status_reason, /friend_payment_history|friend_bill_not_paid_on_time/);
  assert.equal(w.friend.status, 'rejected');
  await evaluate(f);
  assert.equal((await rewards(f)).referrer.status, 'rejected');
});

test('SWITCH50 lesson: referrer arrears inside the window, cleared later, still fails', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c, { orderDaysAgo: 90 });
  await goLive(f, 70);
  const inv = await bill(r, null, 50, null, { status: 'overdue' });
  await bill(f.friend, f.order, 40, 0); await bill(f.friend, f.order, 10, 0);
  // Arrears cleared 23 days late, like OCC54401573.
  await db.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [inv]);
  await db.query("INSERT INTO receipts(invoice_id,user_id,amount,paid_at) VALUES ($1,$2,30, now() - interval '27 days')", [inv, r]);
  await evaluate(f);
  const w = await rewards(f);
  assert.equal(w.referrer.status, 'rejected'); assert.match(w.referrer.status_reason, /^referrer_payment_history:late_or_unpaid_invoice/);
  assert.equal(w.friend.status, 'approved_awaiting_admin', "the friend isn't penalised for the referrer's arrears");
  assert.equal((await one("SELECT count(*)::int n FROM referral_message_outbox WHERE template = 'reward_credited'")).n, 0);
});

test("referrer arrears before the friend's order are outside the window", async () => {
  const r = await customer(); await bill(r, null, 200, 10); // late, but long before
  const { f } = await qualified({ referrer: r });
  assert.equal((await rewards(f)).referrer.status, 'approved_awaiting_admin');
});

test('failed DD, payment arrangement and suspension all count as arrears history', async () => {
  for (const kind of ['failed_dd', 'arrangement', 'suspended']) {
    await db.exec('SAVEPOINT k');
    const r = await customer(); const c = await code(r);
    const f = await friendOrder(c); await goLive(f, 70);
    await bill(f.friend, f.order, 40, 0); await bill(f.friend, f.order, 10, 0);
    if (kind === 'failed_dd') await db.query("INSERT INTO payment_attempts(user_id,status,attempted_at) VALUES ($1,'failed', now() - interval '30 days')", [r]);
    if (kind === 'arrangement') await db.query("INSERT INTO customer_standing_events(customer_id,kind,occurred_at,source) VALUES ($1,'payment_arrangement', now() - interval '30 days','admin')", [r]);
    if (kind === 'suspended') { await db.query("UPDATE services SET status = 'suspended' WHERE user_id = $1", [r]); await db.query("UPDATE services SET status = 'active' WHERE user_id = $1", [r]); }
    await evaluate(f);
    assert.equal((await rewards(f)).referrer.status, 'rejected', kind);
    await db.exec('ROLLBACK TO SAVEPOINT k');
  }
});

test('a returned DD on the friend puts both rewards on hold and suppresses messages', async () => {
  const { f } = await qualified();
  await db.query("INSERT INTO payment_attempts(user_id,status,reason) VALUES ($1,'failed','ARUDD returned')", [f.friend]);
  const w = await rewards(f);
  assert.equal(w.referrer.manual_hold, true); assert.equal(w.friend.manual_hold, true);
  assert.match(w.referrer.hold_reason, /bank_dispute/);
  assert.equal((await one("SELECT count(*)::int n FROM referral_message_outbox WHERE referral_id = $1 AND status = 'pending'", [f.referral.id])).n, 0);
  assert.equal((await act(w.referrer.id, 'approve')).error, 'on_hold');
});

test('friend cancellation, notice or porting away rejects', async () => {
  const { f } = await qualified();
  // before approval: rejection
  const r2 = await customer(); const c2 = await code(r2);
  const g = await friendOrder(c2); await goLive(g, 70);
  await db.query("INSERT INTO service_cancellation_cases(order_id,status) VALUES ($1,'requested')", [g.order]);
  await evaluate(g);
  assert.match((await rewards(g)).referrer.status_reason, /^friend_leaving:cancellation_or_notice/);
  const r3 = await customer(); const c3 = await code(r3);
  const h = await friendOrder(c3); await goLive(h, 70);
  await db.query("INSERT INTO customer_standing_events(customer_id,kind,source) VALUES ($1,'leaving_request','admin')", [h.friend]);
  await evaluate(h);
  assert.match((await rewards(h)).referrer.status_reason, /porting_or_migration_away/);
  assert.equal((await rewards(f)).referrer.status, 'approved_awaiting_admin');
});

test('self-referral: same account, email, phone, name or service address', async () => {
  const r = await customer({ email: 'me@example.test', phone: '07700 900111', name: 'Pat Example', address: '9 High St', postcode: 'HD3 3CC' });
  const c = await code(r);
  const cases = [
    { profile: { email: 'ME@example.test' } },
    { profile: { phone: '+44 7700 900111' } },
    { address: '9 High St', postcode: 'hd3 3cc' },
    { profile: { name: 'Pat  Example' } },
  ];
  for (const o of cases) {
    await db.exec('SAVEPOINT s');
    const f = await friendOrder(c, o); await goLive(f, 70); await evaluate(f);
    assert.match((await rewards(f)).referrer.status_reason, /^self_referral:/, JSON.stringify(o));
    await db.exec('ROLLBACK TO SAVEPOINT s');
  }
  const f = await friendOrder(c, { friend: r });
  assert.match((await rewards(f)).referrer.status_reason, /^self_referral:same_account/);
});

test('not a new customer: earlier order, quote or account in the last 12 months', async () => {
  const r = await customer(); const c = await code(r);
  // An earlier order at the same address 5 months before.
  await db.query("INSERT INTO orders(address_line1,postcode,created_at) VALUES ('77 Friend Street','HD2 2BB', now() - interval '240 days')");
  const f = await friendOrder(c, { address: '77 Friend Street' }); await goLive(f, 70); await evaluate(f);
  assert.match((await rewards(f)).referrer.status_reason, /^not_new_customer:previous_order/);
  const friend2 = await customer({ live: false, ageDays: 0 });
  await db.query("INSERT INTO quote_requests(email, created_at) SELECT email, now() - interval '200 days' FROM profiles WHERE id = $1", [friend2]);
  const g = await friendOrder(c, { friend: friend2 }); await goLive(g, 70); await evaluate(g);
  assert.match((await rewards(g)).referrer.status_reason, /^not_new_customer:previous_quote/);
});

test('no stacking with SWITCH50 on the same order', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c, { campaign: 'SWITCH50' }); await goLive(f, 70); await evaluate(f);
  assert.equal((await rewards(f)).referrer.status_reason, 'promotion_stacking:SWITCH50');
});

test('annual cap: 5 for residential referrers, friend still rewarded', async () => {
  const r = await customer(); const c = await code(r);
  for (let i = 0; i < 6; i++) await qualified({ referrer: r, code: c });
  const all = await rows("SELECT w.status, w.status_reason, w.role FROM referral_rewards w JOIN referrals f ON f.id = w.referral_id WHERE f.referrer_id = $1 ORDER BY w.created_at", [r]);
  const ref = all.filter((x) => x.role === 'referrer');
  assert.equal(ref.filter((x) => x.status === 'approved_awaiting_admin').length, 5);
  assert.equal(ref.filter((x) => x.status_reason === 'annual_cap_reached').length, 1);
  assert.equal(all.filter((x) => x.role === 'friend' && x.status === 'approved_awaiting_admin').length, 6);
});

test('business referrals: higher amounts, net for business accounts with VAT added', async () => {
  const r = await customer(); const c = await code(r);
  const friend = await customer({ live: false, type: 'business', ageDays: 0 });
  const f = await friendOrder(c, { friend, business: true });
  const w = await rewards(f);
  assert.equal(f.referral.friend_type, 'business');
  assert.equal(Number(w.referrer.amount), 50); assert.equal(w.referrer.amount_basis, 'gross'); assert.equal(w.referrer.credit_gross_minor, 5000);
  assert.equal(Number(w.friend.amount), 25); assert.equal(w.friend.amount_basis, 'net'); assert.equal(w.friend.credit_gross_minor, 3000);
});

test('small-business and not-for-profit orders take the business rewards; consumer orders do not', async () => {
  for (const [orderType, expected] of [['microenterprise_or_small_business', 'business'], ['not_for_profit', 'business'], ['residential_consumer', 'residential']]) {
    const r = await customer(); const c = await code(r);
    const f = await friendOrder(c, { orderType });
    assert.equal(f.referral.friend_type, expected, orderType);
  }
});

test('admin approval books credit and is the only path to a reward message', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  // Engine and service code cannot book or announce.
  await rejectsSql(() => db.query("UPDATE referral_rewards SET status = 'booked' WHERE id = $1", [w.referrer.id]), /engine_cannot_move/);
  await rejectsSql(() => db.query(`INSERT INTO referral_message_outbox(customer_id,reward_id,template,payload,idempotency_key)
    VALUES ($1,$2,'reward_credited','{}','x')`, [w.referrer.customer_id, w.referrer.id]), /requires_admin_approved_booking/);
  assert.equal((await act(w.referrer.id, 'approve', { actor: support })).error, 'forbidden');
  assert.equal((await act(w.referrer.id, 'approve', { reason: 'ok' })).error, 'reason_required');
  assert.equal((await act(w.referrer.id, 'approve', { version: 0 })).error, 'stale_reward');
  const req = randomUUID();
  const res = await act(w.referrer.id, 'approve', { request: req });
  assert.equal(res.ok, true); assert.equal(res.status, 'booked'); assert.equal(res.balance_minor, 2500);
  assert.deepEqual(await act(w.referrer.id, 'approve', { request: req, version: res.version }), res, 'same request id is idempotent');
  assert.equal((await act(w.referrer.id, 'approve')).error, 'not_awaiting_approval', 'no double booking');
  const msg = await one("SELECT * FROM referral_message_outbox WHERE template = 'reward_credited' AND reward_id = $1", [w.referrer.id]);
  assert.equal(msg.status, 'pending');
  const ev = await rows("SELECT event_type, actor_kind, actor_id FROM referral_reward_events WHERE reward_id = $1 ORDER BY id", [w.referrer.id]);
  assert.ok(ev.some((e) => e.event_type === 'status_booked' && e.actor_kind === 'admin' && e.actor_id === admin));
  // After approval, any status change needs an admin and a reason.
  await rejectsSql(() => db.query("UPDATE referral_rewards SET status = 'reversed' WHERE id = $1", [w.referrer.id]), /engine_cannot_move/);
});

test('approval re-checks: a reward that stopped qualifying cannot be booked', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await db.query("INSERT INTO payment_attempts(user_id,status,attempted_at) VALUES ($1,'failed', now())", [referrer]);
  const res = await act(w.referrer.id, 'approve');
  assert.equal(res.error, 'no_longer_qualifies');
});

test('manual hold blocks approval and every message, release needs an admin', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  assert.equal((await act(w.referrer.id, 'hold')).ok, true);
  assert.equal((await one("SELECT status FROM referral_message_outbox WHERE template = 'friend_joined' AND referral_id = $1", [f.referral.id])).status, 'suppressed');
  assert.equal((await act(w.referrer.id, 'approve')).error, 'on_hold');
  await rejectsSql(() => db.query('UPDATE referral_rewards SET manual_hold = false WHERE id = $1', [w.referrer.id]), /release_requires_admin/);
  assert.equal((await act(w.referrer.id, 'release')).ok, true);
  assert.equal((await act(w.referrer.id, 'approve')).status, 'booked');
});

test('held rewards are suppressed again at send time', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  await act(w.referrer.id, 'hold');
  const claimed = await rows('SELECT * FROM referral_claim_messages(10)');
  assert.ok(!claimed.some((m) => m.reward_id === w.referrer.id || m.referral_id === f.referral.id));
});

test('credit applies to the next draft invoice as a VAT-correct negative line, never below zero', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  // £19.99 bill, £25 credit: £19.99 used, £5.01 left.
  const inv = (await one(`INSERT INTO invoices(user_id, invoice_number, status, subtotal, vat_total, total, vat_rate)
    VALUES ($1,'INV-A','draft',16.66,3.33,19.99,20) RETURNING id`, [referrer])).id;
  await db.query("INSERT INTO invoice_lines(invoice_id, description, qty, unit_price, line_total, vat_rate) VALUES ($1,'Broadband',1,19.99,19.99,20)", [inv]);
  const applied = (await one('SELECT referral_apply_credit_to_invoice($1) AS v', [inv])).v;
  assert.equal(applied.length, 1);
  assert.equal(applied[0].gross_minor, -1999); assert.equal(applied[0].net_minor, -1666);
  assert.match(applied[0].description, /^Referral credit – friend OCC\d+ \(ref RR-[A-F0-9]{8}\)$/);
  const i1 = await one('SELECT * FROM invoices WHERE id = $1', [inv]);
  assert.equal(Number(i1.total), 0); assert.equal(Number(i1.subtotal), 0); assert.equal(Number(i1.vat_total), 0);
  assert.deepEqual((await one('SELECT referral_apply_credit_to_invoice($1) AS v', [inv])).v.map((x) => x.gross_minor), [-1999], 'idempotent');
  assert.equal((await one("SELECT count(*)::int n FROM invoice_lines WHERE invoice_id = $1 AND metadata->>'kind' = 'referral_credit'", [inv])).n, 1);
  assert.equal((await one('SELECT status FROM referral_rewards WHERE id = $1', [w.referrer.id])).status, 'partly_applied');
  // Next month uses the remaining £5.01 and the reward becomes fully applied.
  const inv2 = (await one(`INSERT INTO invoices(user_id, invoice_number, status, subtotal, vat_total, total, vat_rate)
    VALUES ($1,'INV-B','draft',16.66,3.33,19.99,20) RETURNING id`, [referrer])).id;
  const a2 = (await one('SELECT referral_apply_credit_to_invoice($1) AS v', [inv2])).v;
  assert.equal(a2[0].gross_minor, -501); assert.equal(a2[0].net_minor, -417);
  const i2 = await one('SELECT * FROM invoices WHERE id = $1', [inv2]);
  assert.equal(Number(i2.total), 14.98); assert.equal(Number(i2.subtotal), 12.49); assert.equal(Number(i2.vat_total), 2.49);
  assert.equal((await one('SELECT status FROM referral_rewards WHERE id = $1', [w.referrer.id])).status, 'applied');
  // A sent invoice is never changed.
  const sent = (await one("INSERT INTO invoices(user_id, status, total, email_sent_at) VALUES ($1,'sent',30, now()) RETURNING id", [referrer])).id;
  assert.deepEqual((await one('SELECT referral_apply_credit_to_invoice($1) AS v', [sent])).v, []);
});

test('credit is only added when an invoice is first created, never on a retry or after its PDF exists', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  const withPdf = (await one("INSERT INTO invoices(user_id, status, total, subtotal, vat_total, vat_rate, pdf_storage_key) VALUES ($1,'draft',30,25,5,20,'x.pdf') RETURNING id", [referrer])).id;
  assert.deepEqual((await one('SELECT referral_apply_credit_to_invoice($1) AS v', [withPdf])).v, []);
  const retry = (await one("INSERT INTO invoices(user_id, status, total, subtotal, vat_total, vat_rate) VALUES ($1,'draft',30,25,5,20) RETURNING id", [referrer])).id;
  assert.deepEqual((await one('SELECT referral_apply_credit_to_invoice($1, false) AS v', [retry])).v, []);
  assert.equal(Number((await one('SELECT total FROM invoices WHERE id = $1', [retry])).total), 30);
  assert.equal((await one('SELECT referral_credit_balance($1) AS b', [w.referrer.id])).b, 2500);
});

test('ledger identity: balance = booked − applied − expired − reversed (+ unapplied)', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  const inv = (await one("INSERT INTO invoices(user_id, status, subtotal, vat_total, total, vat_rate) VALUES ($1,'draft',8.33,1.67,10,20) RETURNING id", [referrer])).id;
  await db.query('SELECT referral_apply_credit_to_invoice($1)', [inv]);
  assert.equal((await one('SELECT referral_credit_balance($1) b', [w.referrer.id])).b, 1500);
  // Cancelling the invoice gives the credit back.
  await db.query("UPDATE invoices SET status = 'cancelled' WHERE id = $1", [inv]);
  assert.equal((await one('SELECT referral_credit_balance($1) b', [w.referrer.id])).b, 2500);
  assert.equal((await one('SELECT status FROM referral_rewards WHERE id = $1', [w.referrer.id])).status, 'booked');
  const sums = await one(`SELECT sum(amount_minor) FILTER (WHERE kind = 'booked') booked, sum(amount_minor) FILTER (WHERE kind = 'applied') applied,
    sum(amount_minor) FILTER (WHERE kind = 'unapplied') unapplied FROM referral_credit_movements WHERE reward_id = $1`, [w.referrer.id]);
  assert.equal(Number(sums.booked) - Number(sums.applied) + Number(sums.unapplied), 2500);
  await rejectsSql(() => db.query('DELETE FROM referral_credit_movements'), /append_only/);
});

test('reverse removes only unused credit (decision D) and can tell the customer why', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  const inv = (await one("INSERT INTO invoices(user_id, status, subtotal, vat_total, total, vat_rate) VALUES ($1,'draft',8.33,1.67,10,20) RETURNING id", [referrer])).id;
  await db.query('SELECT referral_apply_credit_to_invoice($1)', [inv]);
  const res = await act(w.referrer.id, 'claw_back', { notify: true, reason: 'Friend cancelled within 6 months of going live' });
  assert.equal(res.status, 'clawed_back'); assert.equal(res.balance_minor, 0);
  const m = await one("SELECT * FROM referral_credit_movements WHERE reward_id = $1 AND kind = 'clawed_back'", [w.referrer.id]);
  assert.equal(m.amount_minor, 1500, 'only the unused £15 is removed; the £10 used is not charged back');
  assert.equal((await one("SELECT count(*)::int n FROM invoices WHERE user_id = $1 AND total > 0 AND status = 'draft'", [referrer])).n, 0);
  const msg = await one("SELECT * FROM referral_message_outbox WHERE template = 'reward_withdrawn'");
  assert.equal(msg.payload.reason, 'Friend cancelled within 6 months of going live');
});

test('after booking, the engine only flags clawback for an admin', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  await db.query("INSERT INTO service_cancellation_cases(order_id,status) VALUES ($1,'requested')", [f.order]);
  await evaluate(f);
  const after = (await rewards(f)).referrer;
  assert.equal(after.status, 'booked'); assert.equal(after.needs_review, true);
  assert.ok(after.review_reasons.includes('clawback_due:cancellation_or_notice'));
});

test('unpaid friend invoice for 30+ days within 6 months flags clawback', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  await bill(f.friend, f.order, 35, null);
  await evaluate(f);
  assert.ok((await rewards(f)).referrer.review_reasons.includes('clawback_due:friend_invoice_unpaid_30_days'));
});

test('expiry: unused credit expires after 12 months with a warning first', async () => {
  const { f } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  await db.query("SELECT set_config('referral.actor_kind','ledger',true)");
  await db.query("UPDATE referral_rewards SET expires_at = now() + interval '10 days' WHERE id = $1", [w.referrer.id]);
  await db.query("SELECT set_config('referral.actor_kind','',true)");
  let res = (await one('SELECT referral_expire_credits() AS v')).v;
  assert.equal(res.warned, 1);
  assert.equal((await one("SELECT count(*)::int n FROM referral_message_outbox WHERE template = 'credit_expiring'")).n, 1);
  await db.query("UPDATE referral_rewards SET expires_at = now() - interval '1 minute' WHERE id = $1", [w.referrer.id]);
  res = (await one('SELECT referral_expire_credits() AS v')).v;
  assert.equal(res.expired, 1);
  assert.equal((await one('SELECT status FROM referral_rewards WHERE id = $1', [w.referrer.id])).status, 'expired');
  assert.equal((await one('SELECT referral_credit_balance($1) b', [w.referrer.id])).b, 0);
});

test('nightly reconciliation is clean, then catches a tampered line', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  const inv = (await one("INSERT INTO invoices(user_id, status, subtotal, vat_total, total, vat_rate) VALUES ($1,'draft',25,5,30,20) RETURNING id", [referrer])).id;
  await db.query("INSERT INTO invoice_lines(invoice_id, description, line_total, vat_rate) VALUES ($1,'Broadband',30,20)", [inv]);
  await db.query('SELECT referral_apply_credit_to_invoice($1)', [inv]);
  assert.equal((await one("SELECT referral_reconcile('manual') AS v")).v.issues, 0);
  await db.query("UPDATE invoice_lines SET line_total = -20 WHERE metadata->>'kind' = 'referral_credit'");
  const v = (await one("SELECT referral_reconcile('manual') AS v")).v;
  assert.ok(v.findings.some((x) => x.check === 'invoice_line'));
  assert.ok(v.findings.some((x) => x.check === 'invoice_total'));
});

test('paid invoice with no receipt waits for review instead of qualifying or failing', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c); await goLive(f, 70);
  await bill(f.friend, f.order, 40, 0); await bill(f.friend, f.order, 10, 0, { noReceipt: true });
  await evaluate(f);
  const w = (await rewards(f)).referrer;
  assert.equal(w.status, 'qualifying'); assert.ok(w.review_reasons.includes('paid_invoice_without_receipt'));
});

test('admin manual attach: within 7 days, with a reason, always reviewed', async () => {
  const r = await customer(); const c = await code(r);
  const fresh = await friendOrder(c, { typed: false, orderDaysAgo: 3 });
  const old = await friendOrder(c, { typed: false, orderDaysAgo: 9 });
  await asUser(admin);
  assert.equal((await one('SELECT referral_admin_manual_attach($1,$2,$3,$4) r', [randomUUID(), old.order, c.code, 'Customer phoned with code'])).r.error, 'outside_manual_window');
  assert.equal((await one('SELECT referral_admin_manual_attach($1,$2,$3,$4) r', [randomUUID(), fresh.order, c.code, 'short'])).r.error, 'reason_required');
  const ok = (await one('SELECT referral_admin_manual_attach($1,$2,$3,$4) r', [randomUUID(), fresh.order, c.code, 'Customer phoned with code before ordering'])).r;
  await asUser(null);
  assert.equal(ok.ok, true);
  const ref = await one('SELECT * FROM referrals WHERE id = $1', [ok.referral_id]);
  assert.equal(ref.attribution_method, 'admin_manual'); assert.equal(ref.manual_attached_by, admin);
  const w = await one("SELECT * FROM referral_rewards WHERE referral_id = $1 AND role = 'referrer'", [ok.referral_id]);
  assert.ok(w.review_reasons.includes('manual_attribution'));
});

test('goodwill credit: admin, reason, monthly budget', async () => {
  const r = await customer();
  await asUser(admin);
  const ok = (await one('SELECT referral_admin_goodwill($1,$2,100,$3) r', [randomUUID(), r, 'Friend not tracked due to our error'])).r;
  assert.equal(ok.ok, true);
  const over = (await one('SELECT referral_admin_goodwill($1,$2,60,$3) r', [randomUUID(), r, 'Second goodwill in the same month'])).r;
  assert.equal(over.error, 'monthly_goodwill_budget_exceeded');
  await asUser(null);
  assert.equal((await one('SELECT status FROM referral_rewards WHERE id = $1', [ok.reward_id])).status, 'booked');
});

test('disputes: support opens, finance resolves with a reason, all logged', async () => {
  const { f, referrer } = await qualified();
  await asUser(support);
  const d = (await one("SELECT referral_admin_dispute('open', NULL, $1, $2, 'not_tracked', $3) r", [referrer, f.referral.id, 'Says friend used the link last week'])).r;
  assert.equal((await one("SELECT referral_admin_dispute('upheld', $1, NULL, NULL, NULL, $2) r", [d.dispute_id, 'Evidence shows the click'])).r.error, 'forbidden');
  await asUser(admin);
  assert.equal((await one("SELECT referral_admin_dispute('rejected', $1, NULL, NULL, NULL, $2) r", [d.dispute_id, 'Order placed before the click'])).r.ok, true);
  await asUser(null);
  const ev = await rows("SELECT event_type FROM referral_reward_events WHERE referral_id = $1 AND event_type LIKE 'dispute%'", [f.referral.id]);
  assert.deepEqual(ev.map((e) => e.event_type), ['dispute_opened', 'dispute_rejected']);
});

test('referral codes and partner codes cannot collide', async () => {
  const r = await customer();
  await db.query("INSERT INTO partners(code, display_name) VALUES ('HUDLET22','Agent')");
  await rejectsSql(() => db.query("INSERT INTO referral_codes(customer_id, code) VALUES ($1,'HUDLET22')", [r]), /reserved/);
  await rejectsSql(() => db.query("INSERT INTO referral_codes(customer_id, code) VALUES ($1,'switch50')", [r]), /reserved/);
  await code(r, 'MINE2345');
  await rejectsSql(() => db.query("INSERT INTO partners(code, display_name) VALUES ('MINE2345','Agent')"), /reserved_by_referral/);
});

test('public code check reveals nothing about the referrer', async () => {
  const r = await customer({ name: 'Secret Person' }); const c = await code(r);
  const v = (await one('SELECT referral_check_code($1) v', [c.code.toLowerCase()])).v;
  assert.equal(v.referral, true); assert.equal(v.stacking_allowed, false);
  assert.ok(!JSON.stringify(v).includes('Secret')); assert.ok(!JSON.stringify(v).includes(r));
  assert.equal((await one("SELECT referral_check_code('NOPE2345') v")).v.referral, false);
});

test('customer overview shows plain statuses and a balance that matches the ledger', async () => {
  const { f, referrer } = await qualified();
  const w = await rewards(f);
  await act(w.referrer.id, 'approve');
  await asUser(referrer);
  const o = (await one('SELECT referral_my_overview() v')).v;
  await asUser(null);
  assert.equal(o.balance_minor, 2500);
  assert.equal(o.rewards[0].status, 'booked');
  assert.equal(o.history[0].kind, 'booked');
});

test('dry run touches nothing and reports no rewards', async () => {
  await customer();
  const before = await one('SELECT count(*)::int n FROM referral_reward_events');
  const v = (await one('SELECT referral_dry_run() v')).v;
  assert.equal(v.referrals, 0); assert.deepEqual(v.rewards_by_status, {});
  assert.ok(v.customers.length >= 1);
  assert.equal((await one('SELECT count(*)::int n FROM referral_reward_events')).n, before.n);
});

test('binding failures never block an order', async () => {
  const r = await customer(); const c = await code(r);
  const f = await friendOrder(c, { utm: { captured_at: 'not-a-date', cc: c.code }, link: true });
  assert.ok(await one('SELECT id FROM orders WHERE id = $1', [f.order]));
  assert.ok((await one('SELECT count(*)::int n FROM referral_binding_errors')).n >= 1);
});
