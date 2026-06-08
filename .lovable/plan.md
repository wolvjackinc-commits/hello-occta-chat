Approved — start Phase 5 only, but apply these corrections before coding.

1. Customer-safe views are mandatory

Do NOT give customers direct SELECT access to tables that contain internal fields.

Create safe customer/public views or RPCs for:

- customer_rewards_view

- customer_points_ledger_view

- customer_reward_accounts_view

- customer_referral_codes_view

- public_contract_benefits_view

Reason:

RLS restricts rows, not columns. If customers can SELECT from rewards directly, they may be able to request internal columns such as margin_check_status, admin_approved_by, reversal_reason, internal_cost_estimate or fraud-related fields.

Customers/dashboard must read only from safe views/RPCs.

2. contract_benefits public access

Do NOT grant anon SELECT directly on contract_benefits because it includes internal_cost_estimate and admin terms.

Instead:

- Keep contract_benefits admin-only table.

- Create public_contract_benefits_view with only:

  benefit_name

  benefit_type

  plan_type

  customer_type

  description

  value_label

  terms_text

  starts_at

  ends_at

  active

Public /rewards page must read from this safe view only.

3. points_ledger append-only trigger

Do not rely on `current_user = 'service_role'` because Supabase may not expose service_role as current_user in the way expected.

Use one of these safer approaches:

- Revoke UPDATE/DELETE from authenticated/anon entirely.

- Only service-role edge functions write ledger changes.

- Add trigger checks using request JWT role if available, e.g. auth.role() or current_setting('request.jwt.claim.role', true), but do not rely only on current_user='service_role'.

Reversals must always be new ledger rows, not edits.

4. rewards approval protection

Do not rely only on a database trigger to know whether actor is admin/super_admin unless role detection is confirmed.

Enforce red-margin override rules inside approve-reward edge function:

- red margin requires override_reason >= 10 chars

- only admin/super_admin can override red margin

- finance_admin can approve bill_credit only when margin is not red

- all approvals/reversals logged

5. reward_accounts cached balances

Balances are cached only. Truth is points_ledger.

No admin/manual UI should directly edit cached balances.

Any adjustment must create a ledger row and then call recompute_reward_balances.

6. Referral code generation

Referral codes must avoid confusing characters.

Use uppercase safe charset only:

ABCDEFGHJKLMNPQRSTUVWXYZ23456789

No O/0/I/1 confusion.

7. Referral self-fraud

attach-referral-to-quote must check as much as possible:

- same logged-in customer

- same email

- same phone

- same quote/customer if available

- same active referral owner

If uncertain, create fraud_flag manual_review, but do not block the quote journey.

8. track-referral-click privacy

Hash IP/UA with server-side salt only.

Do not store raw IP, raw user agent, full cookies or full fingerprint.

Rate limit this endpoint.

9. Campaign publish trigger

Do not allow published/active campaign unless:

- margin_check_status is green or amber

- compliance_check_status is passed

- approval_status is approved

- start/end dates valid if provided

Also enforce this in publish-campaign edge function, not only DB trigger.

10. Campaigns do not affect public site automatically

In Phase 5, publishing only marks the campaign active/admin-ready.

Do not auto-change homepage, send email, send SMS, or run ads.

11. Marketing consent

For email/SMS campaign drafts, compliance check must require:

- target audience description

- opt-in/soft-opt-in note

- unsubscribe/opt-out wording

- offer terms

- expiry/eligibility conditions

Do not send any marketing in Phase 5.

12. Referral capture

captureReferralFromUrl should:

- store code in sessionStorage only

- not override an existing referral code unless a new code is intentionally supplied

- not break normal browsing if track-referral-click fails

- not store PII

13. QuoteStart referral attach

Best-effort only. If attach-referral-to-quote fails, quote submission must still succeed.

14. Activity logs

Log IDs/statuses only.

Do not log:

- full PII

- IP/UA raw values

- reward internal notes

- payment data

- tokens

- bank/card data

- full campaign recipient lists

15. Finance impact

Rewards and bill credits must not affect invoices automatically in Phase 5.

Phase 5 only creates ledger/reward records.

Invoice application can be done later after finance/VAT export logic is built.

16. Existing project safety

Do not touch:

- Worldpay webhook/HPP

- invoice generation

- DD mandates

- /pay

- /pay-invoice

- public /quote flow

- checkout gate

- AI chat engine

- SEO pages

- finance exports

- complaints workflow

- Phase 3 pricing/margin admin pages, except read-only use where needed

17. Stop after Phase 5

After completion, report:

- tables added

- safe views/RPCs added

- functions added

- admin pages added

- dashboard Rewards changes

- public /rewards changes

- campaign safety behaviour

- RLS/policies

- activity logs

- what was untouched

- verification result

- warnings/errors

Start Phase 5 only.

  
  
Phase 5 — Rewards, Referrals, Contract Benefits & Campaign Engine

Build the full structural layer for rewards, referrals, contract benefits and a margin/compliance-gated campaign engine. Everything ships disabled-by-default and gated by `platform_settings.rewards_enabled` + admin approval. No reward values, no auto-publishing, no email/SMS sending.

## Scope guardrails

Untouched: Worldpay webhook, invoice generation, DD mandates, public `/quote/*` flow, `/checkout` gate, `/pay`, `/pay-invoice`, SEO pages, AI chat engine, finance exports, complaints workflow, Phase 3 admin pricing/margin pages, Phase 4 customer dashboard (only the Rewards tab is upgraded).

Existing `campaigns` + `campaign_recipients` tables are left intact. Phase 5 uses a new `campaign_drafts` table as the engine; existing campaigns table is not migrated or repurposed.

## 1. Database migration (single migration)

New enums:

- `reward_account_status` — active|suspended|closed
- `referral_code_status` — active|paused|expired|blocked
- `referral_event_type` — clicked|quote_started|quote_submitted|quote_sent|contract_accepted|payment_cleared|service_activated|reward_eligible|reward_approved|reward_reversed
- `points_ledger_source` — bill_payment|referral|contract_bonus|admin_adjustment|reversal|expiry|campaign
- `points_ledger_status` — pending|approved|used|reversed|expired
- `reward_type` — bill_credit|points|streaming_gift|gift_card|contract_benefit|partner_commission
- `reward_status` — pending|eligible|approved|issued|used|reversed|expired|blocked
- `reward_unlock_rule` — first_cleared_payment|second_cleared_payment|custom_rule
- `contract_benefit_type` — streaming_reward|bill_credit|extra_points|setup_discount|router_delivery|digital_voice_setup|bundle_discount|custom
- `benefit_plan_type` — flex|contract_saver|both
- `benefit_customer_type` — residential|business|both
- `fraud_flag_type` / `fraud_flag_severity` / `fraud_flag_status`
- `campaign_draft_type` — homepage_banner|landing_page|referral_offer|contract_saver_offer|b2b_offer|email|sms|seo_draft|ads_copy|winback|failed_payment_recovery
- `campaign_margin_status` — not_checked|green|amber|red
- `campaign_compliance_status` — not_checked|passed|failed|needs_review
- `campaign_approval_status` — draft|margin_check|compliance_check|admin_approval|approved|published|paused|rejected

New tables (each with explicit `GRANT` block + RLS + policies, then triggers):

- `reward_accounts` — one per customer, balances cached only (truth = ledger).
- `referral_codes` — unique `code`, optional `customer_id` / `partner_id`, status, expiry, usage counters.
- `referral_events` — append-only event stream; only hashed IP/UA stored.
- `points_ledger` — append-only; UPDATE/DELETE blocked by trigger except `service_role`; reversals are new rows.
- `rewards` — lifecycle rows with margin/admin approval metadata.
- `contract_benefits` — admin-defined; `active=false` by default; `requires_margin_green=true` default.
- `fraud_flags` — internal-only.
- `campaign_drafts` — full lifecycle; `active=false` default.

Triggers:

- `points_ledger_block_mutation` — blocks UPDATE/DELETE unless `current_user = 'service_role'`.
- `rewards_block_approval_without_margin` — if `status` moves to `approved` or `issued` and `margin_check_status = 'red'` and the actor is not admin/super_admin, raise.
- `campaign_drafts_block_publish` — on transition to `published`/`active=true`, require `margin_check_status IN ('green','amber')`, `compliance_check_status='passed'`, `approval_status='approved'`, and valid dates; otherwise raise.
- `set_updated_at` triggers on the six mutable tables.

Helper functions (SECURITY DEFINER, `set search_path = public`):

- `has_marketing_or_admin(_uid uuid)` — reuse existing role helpers.
- `recompute_reward_balances(_customer_id uuid)` — sums approved ledger rows into `reward_accounts` caches.
- `current_reward_unlock_rule()` — reads `platform_settings.rewards_unlock_rule`.

## 2. RLS policies

Pattern: deny-by-default, then explicit policies using existing `has_role`, `is_staff`, `has_finance_access`, `has_marketing_access`, `has_compliance_access`.

- `reward_accounts`, `points_ledger`, `rewards` — customer SELECT where `customer_id = auth.uid()`; admin/super_admin/finance_admin full SELECT; only `service_role` writes. Customer never sees `margin_check_status`, `admin_approved_by`, `reversal_reason` (handled by selecting a safe view in the dashboard tab — see §5).
- `referral_codes` — customer SELECT own; admin/super_admin/marketing_admin SELECT all; INSERT via edge function (service_role) or admin.
- `referral_events` — no customer SELECT; admin/super_admin/marketing_admin/support_agent SELECT; only service_role writes.
- `contract_benefits` — public SELECT where `active = true` only; admin/super_admin/marketing_admin full CRUD.
- `fraud_flags` — admin/super_admin/compliance_admin only; no customer access.
- `campaign_drafts` — admin/super_admin/marketing_admin/compliance_admin SELECT; marketing_admin INSERT/UPDATE on own drafts in non-approved statuses; admin/super_admin only for approve/publish; auditor SELECT.

GRANTs: `authenticated` + `service_role` for customer-readable tables; `service_role` only for the rest; `anon` only on `contract_benefits` SELECT (public marketing page).

## 3. Edge functions (all use shared CORS + JWT helpers, all `verify_jwt = false`-compatible with in-code auth)

- `create-referral-code` — POST. Auth required. Generates collision-checked 8-char code, blocks 2nd active code per customer unless admin. Logs `referral_code_created`.
- `track-referral-click` — POST public, rate-limited via `check_rate_limit`. Hashes IP+UA with SHA-256 + server salt. Inserts `clicked` event. Returns `{ ok: true }`.
- `attach-referral-to-quote` — POST internal (called from existing `submit-quote-request` after insert OR from client with code + quote_request_id). Validates code active, not self-referral (email/phone match against quote_request), inserts `quote_submitted` event. Does NOT modify the existing submit-quote-request flow's main path; it's called best-effort and failure is swallowed.
- `evaluate-reward-eligibility` — POST admin/service. Inputs: `customer_id` or `reward_id`. Reads unlock rule from `platform_settings`, checks placeholder activation/payment counts from existing `invoices`/`payment_attempts`, calls `can_send_quote`-style margin lookup if a related quote exists, sets reward to `eligible` or `blocked`. Logs `reward_eligibility_checked`.
- `approve-reward` — POST admin/super_admin (and finance_admin for `bill_credit` type only). Re-checks margin; if red, requires `override_reason` (≥10 chars) and admin/super_admin role. Inserts approved `points_ledger` row, recomputes `reward_accounts`, sets reward to `approved` then `issued`. Logs `reward_approved`.
- `reverse-reward` — POST admin/super_admin/finance_admin. Requires `reason` (≥10 chars). Inserts negative `points_ledger` row with `status=reversed`, sets reward to `reversed`. Logs `reward_reversed`.
- `create-campaign-draft` — POST marketing_admin/admin. Inserts draft, logs `campaign_created`.
- `run-campaign-margin-check` — POST marketing/admin. Reads optional cost inputs, compares against `margin_rules` floor; sets `green|amber|red`. Logs `campaign_margin_checked`.
- `run-campaign-compliance-check` — POST marketing/admin/compliance. Runs heuristic checks against `draft_copy` + `offer_terms` (regex for "free", "guaranteed", "no fees" without disclaimer; VAT wording; presence of terms/eligibility/expiry; consent reminder for email/sms types). Sets `passed|failed|needs_review`. Logs `campaign_compliance_checked`.
- `approve-campaign` — POST admin/super_admin. Requires margin in green/amber AND compliance passed. Sets `approval_status=approved`. Logs `campaign_approved`.
- `publish-campaign` — POST admin/super_admin. Requires `approval_status=approved`. Sets `published_at=now()`, `active=true`. Does NOT send email/SMS or alter homepage. Logs `campaign_published`.
- `pause-campaign` — POST admin/super_admin/marketing_admin. Sets `active=false`, `approval_status=paused`. Logs `campaign_paused`.

All write the existing `log_event` RPC with safe details (IDs only, no PII).

## 4. Admin pages

New routes wired in `src/App.tsx` and `AdminLayout.tsx` nav (lazy-loaded, brutalist):

- `src/pages/admin/Rewards.tsx` — `/admin/rewards`. Search by account/customer; tabs for Pending / Eligible / Approved / Reversed; row actions invoke `approve-reward` / `reverse-reward` (reason dialog); ledger viewer per customer. No "withdraw cash" control anywhere.
- `src/pages/admin/Referrals.tsx` — `/admin/referrals`. Codes table (pause/block), events feed, funnel counters, suspicious flags from `fraud_flags`, manual review dialog.
- `src/pages/admin/ContractBenefits.tsx` — `/admin/contract-benefits`. CRUD on `contract_benefits`; plan/customer-type selects, active toggle, terms textarea, margin-required switch. Default new rows inactive.
- `src/pages/admin/Campaigns.tsx` — `/admin/campaigns`. List of `campaign_drafts` with filters; detail drawer with margin/compliance/approve/publish/pause/reject actions. AI draft button is disabled with tooltip "AI drafting arrives in a later phase". No publish-to-email/SMS UI.

Each page uses existing brutalist table/dialog patterns and the admin dialog standards (flex-col, max-h-[90vh], internal scrolling).

## 5. Customer dashboard — Rewards tab upgrade

Replace `src/components/dashboard/tabs/RewardsTab.tsx` placeholder with a real-but-safe view:

- Reads `usePlatformSettings()`; if `!rewardsEnabled`, render the prepared-state empty card (copy from spec).
- Else fetch (parallel, all scoped to `auth.uid()`):
  - `reward_accounts` row (cached balances).
  - `points_ledger` last 20 approved/pending rows (safe columns only).
  - `rewards` for the customer — select only customer-safe columns (`reward_type, status, reward_value, reward_currency, created_at, updated_at`); omit `margin_check_status`, `admin_approved_by`, `reversal_reason`.
  - `referral_codes` for the customer (their active code, copyable link `{origin}/?ref=CODE`).
  - `contract_benefits` where `active=true` and `plan_type IN (their plan, both)`.
- "Create referral code" CTA invokes `create-referral-code` if none exists.
- No hardcoded reward £ values — only render values that come from DB rows.
- Log `tab_view` with `tab: "rewards"`.

## 6. Public `/rewards` page

Edit `src/pages/Rewards.tsx`:

- Keep teaser block when `rewardsEnabled=false`.
- When enabled, fetch active `contract_benefits` (anon SELECT) and render their `benefit_name`, `description`, `value_label`, `terms_text`. Add a fixed disclaimer block: "Values and eligibility are shown before activation. No cash withdrawal. Rewards are subject to activation, successful cleared payment and margin/compliance rules."

## 7. Referral capture (lightweight, non-invasive)

- Add `src/lib/referral.ts` with `captureReferralFromUrl()` that reads `?ref=` and stores it in `sessionStorage` under `occta_ref`, plus fires `track-referral-click` (best-effort, swallows errors).
- Hook called once from `src/App.tsx` mount effect. No changes to `submit-quote-request`; instead, after the existing quote-request submit in `src/pages/quote/QuoteStart.tsx`, fire `attach-referral-to-quote` best-effort with the stored code and the returned `quote_request_id`. If no code or call fails, the user flow is unaffected.

## 8. Activity logging additions

All listed Phase 5 event types are emitted server-side from the new edge functions via existing `log_event` RPC. No new client-side event types added (Phase 4 list stays).

## 9. Verification checklist

- `/admin/rewards`, `/admin/referrals`, `/admin/contract-benefits`, `/admin/campaigns` all render with empty states.
- Customer dashboard Rewards tab shows prepared-state when `rewards_enabled=false`; shows ledger/code/benefits when true (with no hardcoded values).
- `/rewards` teaser unchanged when disabled; lists active benefits when enabled.
- `create-referral-code` returns a unique code; second active call for same customer returns 409.
- `track-referral-click` writes a `clicked` event with hashed IP/UA only.
- `approve-reward` writes a `points_ledger` row and updates `reward_accounts` cache.
- `reverse-reward` writes a negative ledger row.
- `publish-campaign` rejects unless margin∈{green,amber}, compliance=passed, approval_status=approved.
- Existing routes still render: `/`, `/dashboard`, `/admin/overview`, `/admin/quotes`, `/admin/pricing-rules`, `/quote/start`, `/quote/:token`, `/checkout`, `/pay`, `/pay-invoice`, `/track-order`.
- Worldpay webhook, invoice generation, DD mandates, AI chat, SEO pages, finance exports, complaints workflow untouched.

## Files

New:

- `supabase/migrations/<ts>_phase5_rewards_campaigns.sql`
- `supabase/functions/{create-referral-code,track-referral-click,attach-referral-to-quote,evaluate-reward-eligibility,approve-reward,reverse-reward,create-campaign-draft,run-campaign-margin-check,run-campaign-compliance-check,approve-campaign,publish-campaign,pause-campaign}/index.ts`
- `src/pages/admin/{Rewards,Referrals,ContractBenefits,Campaigns}.tsx`
- `src/lib/referral.ts`

Edited:

- `src/App.tsx` (4 lazy routes + referral capture mount)
- `src/components/admin/layout/AdminLayout.tsx` (4 nav entries)
- `src/components/dashboard/tabs/RewardsTab.tsx` (real view)
- `src/pages/Rewards.tsx` (active-benefits section when enabled)
- `src/pages/quote/QuoteStart.tsx` (best-effort `attach-referral-to-quote` post-submit)
- `.lovable/plan.md` (Phase 5 notes)

## Stop point

After Phase 5, report tables added, functions added, admin pages added, dashboard changes, public rewards page changes, campaign safety behaviour, RLS/policies, activity logs, what was untouched, verification result, warnings/errors. Do not start Phase 6.