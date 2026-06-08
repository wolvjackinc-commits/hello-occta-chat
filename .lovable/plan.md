Approved — start Phase 5 corrections / Phase 5B only, but apply this final correction before coding.

Main correction:

Do not create customer-safe views in a way that requires direct customer SELECT access to sensitive base tables.

Use one of these safe approaches:

Option A — preferred:

Create SECURITY DEFINER RPCs for customer-safe reads:

- get_customer_reward_account()

- get_customer_points_ledger()

- get_customer_rewards()

- get_customer_referral_codes()

- get_public_contract_benefits()

Each RPC must:

- return only safe columns

- enforce auth.uid() for customer data

- expose no margin, admin, fraud, reversal_reason, internal_cost_estimate, admin notes, token hashes or internal fields

- set search_path = public

Option B:

Use safe views only if permissions are confirmed to not allow customers to query the base tables directly.

Important:

RLS controls rows, not columns. Customers must not be able to SELECT directly from rewards, points_ledger, reward_accounts, referral_codes, contract_benefits, fraud_flags or campaign_drafts if those tables contain internal fields.

Admin pages can continue using admin-only access to base tables through RLS/roles or edge functions.

Also apply the rest of the Phase 5 corrections exactly:

1. Points ledger must be append-only.

No UPDATE/DELETE for anon/authenticated.

Reversals must always be new ledger rows.

No direct editing of cached balances.

2. approve-reward must enforce role rules server-side:

- admin/super_admin can override red margin with reason

- finance_admin can approve bill_credit only when margin is not red

- all approvals/reversals logged

3. track-referral-click must store only hashed IP/UA using server-side salt.

No raw IP, raw UA, cookie, fingerprint or PII.

4. attach-referral-to-quote must never block the quote journey.

If self-referral or uncertainty is detected, create a manual_review fraud flag and continue.

5. Campaign publish must be double-guarded in edge function and DB:

- margin green/amber

- compliance passed

- approval_status approved

- valid date range

- active=true only

No email, SMS, homepage change or ad trigger in this phase.

6. Email/SMS campaign compliance check must fail if missing:

- target audience

- opt-in/soft-opt-in wording

- unsubscribe/STOP wording

- offer terms

- expiry/eligibility

- VAT wording

7. Rewards dashboard must read only from safe RPCs/views.

If rewards_enabled=false, show coming-soon state.

If rewards_enabled=true, show referral code, points, bill credit, rewards, ledger and active benefits from safe data only.

8. Public /rewards page must read only public safe benefits data.

No direct contract_benefits table access from public page.

9. Referral capture:

- read ?ref=

- validate code format

- store only in sessionStorage

- call track-referral-click best-effort

- never break navigation

- attach to quote best-effort after quote submission

- failure must not block quote request

10. No rewards should affect invoices automatically in this phase.

No invoice credits, no VAT impact, no payment flow changes.

Do not touch:

Worldpay webhook/HPP, invoice generation, DD mandates, /pay, /pay-invoice, public /quote flow, checkout gate, AI chat, SEO pages, finance exports, complaints workflow, Phase 3 pricing/margin pages.

After finishing, stop and report:

- views/RPCs added

- RLS/grant changes

- edge functions changed

- dashboard Rewards changes

- public /rewards changes

- referral capture behaviour

- activity log shape

- what was untouched

- verification result

- warnings/errors

Start Phase 5 corrections / Phase 5B only.  
  
  
Phase 5 Corrections Plan

Phase 5 scaffolding (tables, edge functions, admin pages) is already in place. This plan applies the 17 corrections you specified before any customer-facing surface is wired up. No work begins on Phase 6.

### 1. Migration — Customer-safe views & hardening

New migration creating SECURITY INVOKER views with **only safe columns**, plus revokes/grants:

- `public.customer_rewards_view` — id, customer_id, reward_type, reward_value, status, unlock_rule, issued_at, expires_at (no margin_check_status, admin_approved_by, reversal_reason, internal cost fields).
- `public.customer_points_ledger_view` — id, customer_id, source_type, points_delta, bill_credit_delta, status, reason (sanitised), created_at, available_at (no created_by, no override notes).
- `public.customer_reward_accounts_view` — customer_id, points_balance_cached, bill_credit_balance_cached, updated_at.
- `public.customer_referral_codes_view` — id, code, status, usage_count, expires_at, created_at (scoped to `customer_id = auth.uid()`).
- `public.public_contract_benefits_view` — benefit_name, benefit_type, plan_type, customer_type, description, value_label, terms_text, starts_at, ends_at, active (no internal_cost_estimate, no admin notes). `WHERE active = true`.

Grants:

- `REVOKE SELECT ON public.rewards, points_ledger, reward_accounts, referral_codes, contract_benefits, fraud_flags, campaign_drafts FROM anon, authenticated;` (admin/service_role retained via existing policies + service_role grant).
- `GRANT SELECT ON customer_*_view TO authenticated;`
- `GRANT SELECT ON public_contract_benefits_view TO anon, authenticated;`
- Confirm `fraud_flags` has no customer-readable policy.

### 2. points_ledger append-only — safer enforcement

Update the trigger function so it does not rely on `current_user = 'service_role'`:

- Hard `REVOKE INSERT, UPDATE, DELETE ON points_ledger FROM anon, authenticated;` so only service_role can write.
- Keep `trg_points_ledger_no_update` raising on UPDATE/DELETE for ALL roles (including service_role) so even edge functions cannot mutate — reversals must INSERT a new row.
- Remove any "service_role bypass" branch if present.

### 3. rewards red-margin guard — enforce in edge function

Keep DB trigger as a backstop but make `approve-reward` authoritative:

- Re-verify caller role server-side (admin/super_admin/finance_admin) via `user_roles`.
- finance_admin → only `bill_credit` AND margin must not be red.
- red margin → require admin/super_admin + `override_reason` ≥ 10 chars; log override flag in activity_log.
- Always write ledger row + call `recompute_reward_balances`; never mutate cached balance directly.

### 4. reverse-reward — ledger-only

Confirm function always inserts a reversal row and re-runs `recompute_reward_balances`. No direct UPDATE on `reward_accounts` anywhere in the codebase. Remove any admin UI affordance to edit cached balances (Rewards admin page reads cache, edits only via approve/reverse).

### 5. Referral safety adjustments

- `create-referral-code` already uses safe charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — verify and keep.
- `attach-referral-to-quote` — extend self-referral checks: same logged-in customer_id, same email, same phone, same referral owner; on uncertainty insert `fraud_flags` with `severity='low'`, `flag_type='manual_review'` and **still return ok** so quote journey continues.
- `track-referral-click` — confirm SHA-256 with `REFERRAL_HASH_SALT`, no raw IP/UA stored, rate limit 20/min already in place. Add explicit comment + ensure no cookie/fingerprint capture.

### 6. Campaign publish — double-guard

`publish-campaign` already checks `approval_status=approved`, margin in (green, amber), compliance=passed. Add explicit start/end validity check (`ends_at > starts_at` when both set). DB trigger `campaign_drafts_block_publish` remains as backstop. Phase 5 publish **only** flips `active=true` — no email, SMS, homepage change, or ad trigger (already true; add code comment + activity_log note).

### 7. Compliance check — marketing consent

Extend `run-campaign-compliance-check` to require, for `email`/`sms` types:

- non-empty `target_audience` description
- opt-in / soft-opt-in wording (`opt-in`, `consent`, `subscribed`)
- unsubscribe / STOP wording in `offer_terms`
- expiry/eligibility wording
- VAT wording

Already partially implemented — tighten thresholds: missing any of the above for email/sms → `failed` (not `needs_review`).

### 8. Frontend — customer dashboard Rewards tab

Update `src/components/dashboard/tabs/RewardsTab.tsx`:

- Gated by `platform_settings.rewards_enabled`. If false → keep "coming soon" copy.
- If true → query **only** safe views: `customer_reward_accounts_view`, `customer_points_ledger_view` (last 20), `customer_referral_codes_view`, `public_contract_benefits_view`.
- "Create referral code" CTA → invokes `create-referral-code`.
- Copyable referral link `https://www.occta.co.uk/?ref=CODE`.
- No internal fields rendered.

### 9. Public `/rewards` page

Update `src/pages/Rewards.tsx` to read `public_contract_benefits_view` (anon). Render benefit_name, value_label, description, terms_text, eligibility window. No customer-specific data, no ledger calls.

### 10. Referral capture utility

New `src/lib/referral.ts`:

- `captureReferralFromUrl()` — reads `?ref=`, validates charset, stores in `sessionStorage` only, does NOT overwrite an existing stored code unless URL explicitly supplies a new valid code, swallows all errors, fires `track-referral-click` best-effort.
- `getStoredReferralCode()` / `clearStoredReferralCode()`.
- Called once from `src/App.tsx` on mount.

### 11. QuoteStart attach

In `src/pages/quote/QuoteStart.tsx`, after successful quote-request submission, fire-and-forget `attach-referral-to-quote` with stored code. Wrap in try/catch; never block submission or show error to user. Clear stored code on success.

### 12. Activity logging hygiene

Audit all new `log_event` calls (approve-reward, reverse-reward, attach-referral, track-referral-click, campaign_*): ensure details contain IDs + statuses only — no email, phone, IP, UA, override note text beyond truncated reason, no recipient lists, no card/bank/token data. Adjust where needed.

### 13. Finance isolation

No code path applies rewards to invoices in Phase 5. Confirm `generate-invoices`, `worldpay-webhook`, `process-late-fees` are untouched. Add code comment on `reward_accounts` describing Phase 6 application boundary.

### 14. Untouched (verified at end)

Worldpay webhook/HPP, invoice generation, DD mandates, /pay, /pay-invoice, public /quote flow, checkout gate, AI chat, SEO pages, finance exports, complaints workflow, Phase 3 admin pricing/margin pages (read-only consumption only).

### Files to be added / modified

**New:**

- `supabase/migrations/<ts>_phase5_safe_views_and_hardening.sql`
- `src/lib/referral.ts`

**Modified:**

- `supabase/functions/approve-reward/index.ts` (tighten role checks + logging)
- `supabase/functions/reverse-reward/index.ts` (logging hygiene only)
- `supabase/functions/attach-referral-to-quote/index.ts` (extended self-fraud checks, never block)
- `supabase/functions/track-referral-click/index.ts` (confirm no raw PII, comments)
- `supabase/functions/run-campaign-compliance-check/index.ts` (stricter email/sms gating)
- `supabase/functions/publish-campaign/index.ts` (date validity, comments)
- `src/components/dashboard/tabs/RewardsTab.tsx` (live read of safe views, gated by rewards_enabled)
- `src/pages/Rewards.tsx` (read `public_contract_benefits_view`)
- `src/pages/quote/QuoteStart.tsx` (best-effort attach + clear)
- `src/App.tsx` (one-time `captureReferralFromUrl`)
- `src/pages/admin/Rewards.tsx` (remove any direct cached-balance edit affordance if present)

### Stop point

After implementation I will report: tables added (none new — views only), safe views/RPCs added, edge functions changed, admin pages changed, dashboard Rewards changes, public /rewards changes, campaign safety behaviour, RLS/grant changes, activity log shape, untouched systems, verification result (build + spot-checks), any warnings/errors. I will not start Phase 6.