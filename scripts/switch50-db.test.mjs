import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let db, installedCampaignActive;
const uid=randomUUID(),admin=randomUUID(),finance=randomUUID(),outsider=randomUUID();
const rows=async(sql,params=[]) => (await db.query(sql,params)).rows;
const one=async(sql,params=[]) => (await rows(sql,params))[0];
before(async()=>{
  db=new PGlite();
  await db.exec(readFileSync('supabase/tests/switch50-fixture.sql','utf8'));
  for(const f of readdirSync('supabase/migrations').filter(f=>/switch50.*\.sql$/.test(f)).sort())
    await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
  installedCampaignActive=(await one("SELECT active FROM offer_campaigns WHERE code='SWITCH50'")).active;
  await db.query("INSERT INTO auth.users VALUES($1,'customer@example.test'),($2,'admin@example.test'),($3,'finance@example.test'),($4,'other@example.test')",[uid,admin,finance,outsider]);
  await db.query("INSERT INTO user_roles VALUES($1,'admin'),($2,'finance_admin')",[admin,finance]);
});
after(async()=>{await db?.close()});
beforeEach(async()=>{await db.exec("BEGIN; UPDATE offer_campaigns SET active=true,starts_at=now()-interval '100 days',ends_at=now()+interval '100 days' WHERE code='SWITCH50'")});
afterEach(async()=>{await db.exec("ROLLBACK")});

async function seed(options={}){
  const order=randomUUID(),session=randomUUID(),snap=randomUUID(),checkout=randomUUID();
  const c=await one("SELECT * FROM offer_campaigns WHERE code='SWITCH50'");
  const promotion={...c,eligible:true,monthly_price_reduced:false};
  const snapshot={test_session:false,product:{speed_bucket:'essential',contract_term:'price_lock_24'},promotion,...options.snapshot};
  await db.query("INSERT INTO customer_journey_sessions(id,checkout_session_id,contract_snapshot_id,test_session) VALUES($1,$2,$3,$4)",[session,checkout,snap,!!options.test]);
  await db.query("INSERT INTO journey2_contract_snapshots VALUES($1,$2,$3)",[snap,session,JSON.stringify(snapshot)]);
  await db.query("INSERT INTO orders(id,customer_id,user_id,checkout_session_id,contract_acceptance_id,address_line1,address_line2,postcode,created_at,lifecycle_status,actual_service_live_at_utc) VALUES($1,$2,$3,$4,$5,$6,$7,'AB1 2CD',now()-interval '40 days','live',now()-make_interval(days=>$8))",
    [order,options.unlinked?null:uid,uid,checkout,randomUUID(),options.address??'10 Example Road',options.address2??null,options.days??31]);
  const svc=(await one("INSERT INTO services(order_id,user_id) VALUES($1,$2) RETURNING id",[order,uid])).id;
  let invoice;
  if(options.invoice!==false) invoice=(await one("INSERT INTO invoices(user_id,order_id,service_id,status,issue_date,due_date) VALUES($1,$2,$3,$4,current_date-30,current_date-20) RETURNING id",[uid,order,svc,options.paid===false?'sent':'paid'])).id;
  return {order,session,snap,checkout,svc,invoice,reward:await one("SELECT * FROM promotion_rewards WHERE order_id=$1",[order])};
}
const get=async f=>one("SELECT * FROM promotion_rewards WHERE order_id=$1",[f.order]);
async function action(f,act,extra={}){
  const r=await get(f);
  return (await one("SELECT switch50_admin_action($1,$2,$3,$4,$5,$6,$7,$8) result",
    [extra.actor??admin,extra.request??randomUUID(),act,r?.id??null,extra.version??r?.version,extra.reason??null,extra.reference??null,extra.active??null])).result;
}

test('three migrations apply and view column ordering is compatible',async()=>{
  const fields=await rows("SELECT column_name FROM information_schema.columns WHERE table_name='switch50_campaign_funnel' ORDER BY ordinal_position");
  assert.equal(fields[9].column_name,'rewards_paid');assert.equal(fields[10].column_name,'rewards_payout_queued');
});

test('a fresh campaign stays paused until finance/admin enables acquisitions',()=>{
  assert.equal(installedCampaignActive,false);
});
test('active broadband, first paid bill and D+30 qualify £50',async()=>{
  const f=await seed();assert.equal((await get(f)).status,'eligible');assert.equal((await get(f)).first_paid_invoice_id,f.invoice);assert.equal(Number((await get(f)).reward_amount),50);
});
test('D+30 boundary and activation event',async()=>{
  const f=await seed({days:29});assert.equal((await get(f)).status,'pending');
  await db.query("UPDATE orders SET actual_service_live_at_utc=now()-interval '30 days' WHERE id=$1",[f.order]);
  assert.equal((await get(f)).status,'eligible');
});
test('later or unrelated paid bill cannot substitute for unpaid first bill',async()=>{
  const f=await seed({paid:false});
  await db.query("INSERT INTO invoices(user_id,order_id,status) VALUES($1,$2,'paid'),($1,NULL,'paid')",[uid,f.order]);
  assert.equal((await get(f)).status,'pending');
  await db.query("UPDATE invoices SET status='paid' WHERE id=$1",[f.invoice]);assert.equal((await get(f)).status,'eligible');
});
test('payment status correction revokes payout queue; paid correction restores eligibility',async()=>{
  const f=await seed();assert.equal((await action(f,'queue_payout')).ok,true);
  await db.query("UPDATE invoices SET status='sent' WHERE id=$1",[f.invoice]);assert.equal((await get(f)).status,'pending');
  assert.equal((await action(f,'mark_issued',{reference:'BANK-123'})).ok,false);
  await db.query("UPDATE invoices SET status='paid' WHERE id=$1",[f.invoice]);assert.equal((await get(f)).status,'eligible');
});
test('arrears elsewhere on account block payout until paid',async()=>{
  const f=await seed();const i=await one("INSERT INTO invoices(user_id,status,due_date) VALUES($1,'overdue',current_date-1) RETURNING id",[uid]);
  assert.equal((await get(f)).status,'blocked');await db.query("UPDATE invoices SET status='paid' WHERE id=$1",[i.id]);assert.equal((await get(f)).status,'eligible');
});
test('cancellation request stops queued reward; withdrawal rechecks',async()=>{
  const f=await seed();await action(f,'queue_payout');
  const c=await one("INSERT INTO service_cancellation_cases(order_id,status) VALUES($1,'requested') RETURNING id",[f.order]);
  assert.equal((await get(f)).status,'blocked');
  await db.query("UPDATE service_cancellation_cases SET status='withdrawn',withdrawn_at=now() WHERE id=$1",[c.id]);assert.equal((await get(f)).status,'eligible');
});
test('service suspension and cancellation stop payment',async()=>{
  const f=await seed();await action(f,'queue_payout');
  await db.query("UPDATE services SET status='suspended' WHERE id=$1",[f.svc]);assert.equal((await get(f)).status,'pending');
  await db.query("UPDATE orders SET status='cancelled' WHERE id=$1",[f.order]);assert.equal((await get(f)).status,'blocked');
});
test('duplicate normalized address remains reserved when blocked',async()=>{
  const f=await seed();await action(f,'block',{reason:'Duplicate review hold'});
  const second=await seed({address:'10 EXAMPLE ROAD.'});assert.equal(second.reward,undefined);
  assert.equal((await one("SELECT count(*)::int n FROM promotion_reward_events WHERE event_type='duplicate_address_rejected'")).n,1);
});
test('different flats are distinct addresses',async()=>{
  await seed({address2:'Flat 1'});assert.ok((await seed({address2:'Flat 2'})).reward);
});

test('legacy address hashes still prevent duplicate rewards without rewriting old rows',async()=>{
  const f=await seed();
  await db.exec("ALTER TABLE promotion_rewards DISABLE TRIGGER switch50_reward_version");
  await db.query("UPDATE promotion_rewards SET service_address_key=md5('10exampleroad|AB12CD') WHERE id=$1",[f.reward.id]);
  await db.exec("ALTER TABLE promotion_rewards ENABLE TRIGGER switch50_reward_version");
  assert.equal((await seed({address:'10 EXAMPLE ROAD.'})).reward,undefined);
  assert.equal((await get(f)).service_address_key,(await one("SELECT md5('10exampleroad|AB12CD') key")).key);
});

test('duplicate claim appears blocked to its customer and stays private from another customer',async()=>{
  await seed();const duplicate=await seed();
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);await db.exec("SET LOCAL ROLE authenticated");
  const rewards=await rows("SELECT * FROM get_my_promotion_rewards()");
  assert.equal(rewards.find(r=>r.order_id===duplicate.order)?.status,'blocked');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[outsider]);
  assert.equal((await rows("SELECT * FROM get_my_promotion_rewards()")).length,0);
});

test('reward economics cannot be overwritten',async()=>{
  const f=await seed();
  await assert.rejects(db.query("UPDATE promotion_rewards SET reward_amount=500 WHERE id=$1",[f.reward.id]),/promotion_economics_are_immutable/);
});
test('earlier activated broadband including ceased service is existing customer',async()=>{
  await db.query("INSERT INTO orders(user_id,customer_id,created_at,actual_activation_date,lifecycle_status) VALUES($1,$1,now()-interval '80 days',current_date-60,'ceased')",[uid]);
  assert.equal((await seed()).reward.blocked_reason,'existing_broadband_customer');
});
test('delayed account linking preserves promise after pause and expiry',async()=>{
  const f=await seed({unlinked:true});assert.equal(f.reward,undefined);
  await db.exec("UPDATE offer_campaigns SET active=false,ends_at=now()-interval '1 day'");
  await db.query("UPDATE orders SET customer_id=$1 WHERE id=$2",[uid,f.order]);assert.equal((await get(f)).status,'eligible');
});
test('paused new order is rejected instead of silently stripping promotion',async()=>{
  await db.exec("UPDATE offer_campaigns SET active=false");
  await assert.rejects(seed(),/switch50_offer_changed_review_contract/);
});
test('ineligible snapshot product is rejected',async()=>{
  await assert.rejects(seed({snapshot:{test_session:false,product:{speed_bucket:'ultrafast',contract_term:'price_lock_24'},promotion:{code:'SWITCH50',eligible:true}}}),/switch50_contract_invalid/);
});
test('test sessions cannot mint live rewards',async()=>{
  await assert.rejects(seed({test:true}),/switch50_contract_invalid/);
});
test('finance requires queue and nonblank transfer reference; reversal requires admin',async()=>{
  const f=await seed();
  assert.equal((await action(f,'mark_issued',{actor:finance,reference:'BANK-123'})).ok,false);
  assert.equal((await action(f,'queue_payout',{actor:finance})).ok,true);
  assert.equal((await action(f,'mark_issued',{actor:finance,reference:'    '})).ok,false);
  assert.equal((await action(f,'mark_issued',{actor:finance,reference:'BANK-123'})).ok,true);
  assert.equal((await action(f,'reverse',{actor:finance,reason:'Cash returned by customer',reference:'RETURN-123'})).ok,false);
});
test('unprivileged and stale callers cannot change cash status',async()=>{
  const f=await seed(),version=f.reward.version;
  assert.equal((await action(f,'queue_payout',{actor:outsider})).error,'forbidden');
  await action(f,'queue_payout');
  assert.equal((await action(f,'mark_issued',{version,reference:'BANK-123'})).error,'stale_reward');
});
test('request replay returns original result; changed payload conflicts',async()=>{
  const f=await seed(),request=randomUUID(),version=f.reward.version;
  const first=await action(f,'queue_payout',{request,version});
  assert.deepEqual(await action(f,'queue_payout',{request,version}),first);
  assert.equal((await action(f,'mark_issued',{request,version,reference:'BANK-123'})).error,'idempotency_conflict');
});
test('manual hold survives reevaluation; release rechecks payment',async()=>{
  const f=await seed();await action(f,'block',{reason:'Investigation needs review'});
  await db.exec("SELECT evaluate_promotion_rewards()");assert.equal((await get(f)).status,'blocked');
  await db.query("UPDATE invoices SET status='sent' WHERE id=$1",[f.invoice]);
  await action(f,'release',{reason:'Manual investigation complete'});assert.equal((await get(f)).status,'pending');
});
test('paid reward is flagged for review after cancellation; recovery preserves transfer reference',async()=>{
  const f=await seed();await action(f,'queue_payout');await action(f,'mark_issued',{reference:'BANK-123'});
  await db.query("UPDATE orders SET cancellation_requested_at=now() WHERE id=$1",[f.order]);
  assert.equal((await get(f)).status,'issued');assert.equal((await get(f)).needs_review,true);
  assert.equal((await action(f,'reverse',{reason:'Customer returned the cash'})).ok,false);
  assert.equal((await action(f,'reverse',{reason:'Customer returned the cash',reference:'RETURN-123'})).ok,true);
  assert.equal((await get(f)).payout_reference,'BANK-123');
});
test('unchanged evaluation does not duplicate audit or messages',async()=>{
  await seed();const start=await one("SELECT count(*)::int n FROM promotion_reward_events");
  await db.exec("SELECT evaluate_promotion_rewards();SELECT evaluate_promotion_rewards()");
  assert.equal((await one("SELECT count(*)::int n FROM promotion_reward_events")).n,start.n);
});
test('audit failure rolls back a payout',async()=>{
  const f=await seed();await action(f,'queue_payout');
  await db.exec("CREATE FUNCTION pg_temp.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER test_fail_audit BEFORE INSERT ON promotion_reward_events FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_audit(); SAVEPOINT before_pay");
  await assert.rejects(action(f,'mark_issued',{reference:'BANK-123'}),/audit unavailable/);
  await db.exec("ROLLBACK TO SAVEPOINT before_pay");assert.equal((await get(f)).status,'payout_queued');
});
test('outbox leases prevent double claim and stale acknowledgements',async()=>{
  await seed();const claimed=await rows("SELECT * FROM switch50_claim_messages(20)");assert.ok(claimed.length>0);
  assert.equal((await rows("SELECT * FROM switch50_claim_messages(20)")).length,0);
  const m=claimed[0];
  assert.equal((await one("SELECT switch50_finish_message($1,$2,'resend-test',NULL) ok",[m.id,randomUUID()])).ok,false);
  assert.equal((await one("SELECT switch50_finish_message($1,$2,'resend-test',NULL) ok",[m.id,m.lease_token])).ok,true);
});

test('ambiguous sends outside provider deduplication window stop for review',async()=>{
  await seed();
  await db.exec("UPDATE promotion_message_outbox SET first_attempt_at=now()-interval '24 hours',status='processing',locked_until=now()-interval '1 minute'");
  assert.equal((await rows("SELECT * FROM switch50_claim_messages(20)")).length,0);
  assert.equal((await one("SELECT count(*)::int n FROM promotion_message_outbox WHERE status<>'failed'")).n,0);
});

test('crashed final delivery attempt becomes failed after the lease expires',async()=>{
  await seed();
  await db.exec("UPDATE promotion_message_outbox SET attempts=6,status='processing',locked_until=now()-interval '1 minute'");
  assert.equal((await rows("SELECT * FROM switch50_claim_messages(20)")).length,0);
  assert.equal((await one("SELECT count(*)::int n FROM promotion_message_outbox WHERE status<>'failed'")).n,0);
});
test('customer-safe RPC and no direct finance access',async()=>{
  await seed();await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);await db.exec("SET LOCAL ROLE authenticated");
  assert.equal((await rows("SELECT * FROM get_my_promotion_rewards()")).length,1);
  assert.equal((await rows("SELECT * FROM promotion_rewards")).length,0);
  await assert.rejects(db.exec("SELECT evaluate_promotion_rewards()"),/permission denied/);
});

test('service role can use audited operations but cannot edit or truncate the audit/outbox directly',async()=>{
  await seed();await db.exec("SET LOCAL ROLE service_role");
  assert.ok((await rows("SELECT * FROM switch50_claim_messages(5)")).length>0);
  for(const table of ['promotion_reward_events','promotion_message_outbox']) {
    for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])
      assert.equal((await one("SELECT has_table_privilege(current_user,$1,$2) allowed",[table,privilege])).allowed,false);
  }
});

test('full first-invoice credit stops a queued payout while unrelated credits do not',async()=>{
  const f=await seed();await action(f,'queue_payout');
  await db.query("INSERT INTO credit_notes(invoice_id,user_id,amount) VALUES($1,$2,34.99)",[randomUUID(),uid]);
  assert.equal((await get(f)).status,'payout_queued');
  const credit=await one("INSERT INTO credit_notes(invoice_id,user_id,amount) VALUES($1,$2,34.99) RETURNING id",[f.invoice,uid]);
  assert.equal((await get(f)).blocked_reason,'first_broadband_payment_reversed');
  assert.equal((await action(f,'mark_issued',{reference:'BLOCKED-CREDIT'})).ok,false);
  await db.query("DELETE FROM credit_notes WHERE id=$1",[credit.id]);assert.equal((await get(f)).status,'eligible');
});

test('receipt reversal triggers review even when the invoice is still marked paid',async()=>{
  const f=await seed();
  await db.query("INSERT INTO receipts(invoice_id,user_id,amount) VALUES($1,$2,34.99)",[f.invoice,uid]);
  await action(f,'queue_payout');
  await db.query("INSERT INTO receipts(invoice_id,user_id,amount) VALUES($1,$2,-34.99)",[f.invoice,uid]);
  assert.equal((await get(f)).status,'blocked');
  assert.equal((await get(f)).blocked_reason,'first_broadband_payment_reversed');
});
