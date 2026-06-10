Approve Broadband Beta Readiness Check with corrections below.

Do not start a new phase.  
Do not start Phase 7.  
Do not add new features/pages.  
Do not touch Worldpay, invoices, DD mandates, /pay, /pay-invoice, checkout gate, rewards, campaigns, complaints, finance exports, SEO or AI chat.

Proceed with fair-pricing tuning and beta readiness testing, but correct these items before applying the settings:

1. Essential Price Lock correction

Do not expect Essential / Price Lock 24 to pass at £33.99.

With:

- supplier cost £24.50 ex VAT
- support buffer £1.00
- payment failure buffer £0.50
- lock risk buffer £1.00
- floor £1.50

Required customer ex VAT is £28.50.  
That means gross price must be at least £34.20, so the safe .99 price is:

Essential Price Lock 24 = £34.99

Set:  
headline.essential.lock24: £34.99

2. Essential Flex 30

£37.99 is safe but may be slightly high. It can remain for now.

Set:  
headline.essential.flex30: £37.99

3. Superfast monthly total wording

For Superfast / Price Lock 24 / standard router monthly / standard setup:

If broadband base auto-bumps to £40.99 and standard router is £4.99/month, then customer monthly total is:

£45.98/month

First bill with £49.99 setup is:

£95.97

Do not report only £40.99 as the monthly if router monthly is selected. Show both:

- broadband monthly
- router monthly
- total monthly
- first bill

4. Ultrafast cost check

Verify the active 24-month Ultrafast supplier row.

The report says Ultrafast 24m cost is £30.00, but that looks like a 330/50 product, not a 550/75 Ultrafast product.

Before testing D, confirm:

- selected product speed is 550/75 or equivalent
- bucket_hint = ultrafast
- monthly supplier cost is correct
- 330/50 is not accidentally being used as Ultrafast

If D is Ultrafast 550/75 with premium router monthly:  
Expected customer total monthly should be shown as:  
broadband monthly + £7.99 premium router monthly

Do not hide the router monthly from the total.

5. Gigabit correction

Do not assume Gigabit Price Lock 24 stays quote-only after setting headline to £52.99.

With supplier cost £40.50 ex VAT, buffers £2.50 and floor £4.50, required customer ex VAT is about £47.50, so required gross is about £57.00.

With auto-bump enabled, Gigabit may price at around:

£57.99/month

So choose one of these deliberately:

Option A — Allow Gigabit to auto-bump:  
Set gigabit.lock24 = £52.99 and expect final price around £57.99 if auto-bump passes.

Option B — Keep Gigabit quote-only:  
Mark Gigabit public fallback as quote-only / not live until we decide final pricing.

Do not report E as quote-only unless the system is intentionally configured to keep Gigabit quote-only.

6. Suggested corrected headline settings

Apply:

headline.essential.lock24: £34.99  
headline.essential.flex30: £37.99

headline.superfast.lock24: £39.99  
headline.superfast.flex30: £42.99

headline.ultrafast.lock24: £44.99  
headline.ultrafast.flex30: £49.99

headline.gigabit.lock24: £52.99 only if auto-bump is acceptable  
headline.gigabit.flex30: £54.99 only if auto-bump is acceptable

If we want Gigabit quote-only for beta, mark Gigabit quote-only instead of relying on failed margin.

7. Run A–E tests with corrected expectations

A Essential / Price Lock 24 / own / remote  
Expected: £34.99, priced

B Essential / Flex 30 / own / remote  
Expected: £37.99, priced

C Superfast / Price Lock 24 / standard router monthly / standard setup  
Expected:

- broadband base likely £40.99 after bump
- router monthly £4.99
- total monthly £45.98
- setup £49.99
- first bill £95.97

D Ultrafast / Price Lock 24 / premium router monthly / standard setup  
Expected:

- verify real ultrafast supplier row first
- broadband monthly + £7.99 premium router
- setup £49.99
- quote_only only if margin fails

E Gigabit / Price Lock 24 / own / remote  
Expected:

- either auto-bumped price around £57.99 if allowed
- or quote_only if Gigabit is intentionally marked quote-only for beta

8. Contract Summary checks

For each priced scenario, Contract Summary must show:

- speed bucket
- plan term
- broadband monthly
- router monthly or one-off
- setup charge
- add-ons
- total monthly
- first bill estimate
- VAT-inclusive residential price
- Price Lock / Flex wording
- “If it is not shown in your Contract Summary, we do not add it without your agreement.”

Do not show:

- supplier name
- Giacom name
- supplier product code
- wholesale fee value
- supplier cost
- margin
- source document/page

9. Final verdict

After corrected tests, report:

- exact fair-pricing changes applied
- A–E final prices
- whether Gigabit is priced or intentionally quote-only
- Contract Summary pass/fail
- supplier-data security pass/fail
- route smoke pass/fail
- controlled beta readiness verdict

Stop after the readiness check.  
  
  
Broadband Beta Readiness Check

Scope: tune `platform_settings.fair_pricing` so starter scenarios A–E either price safely or fall to a clean quote-only, re-run pricing tests, verify Contract Summary output, and smoke the listed routes. No new phase, no new features, no public copy changes (except accuracy if needed), and nothing touched in Worldpay/HPP, invoices, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards, campaigns, complaints, finance, SEO, or AI chat.

## 1. Current state (read-only checks already done)

Active Giacom rows by bucket / term (cheapest supplier monthly inc. care uplift):


| Bucket    | 1m (Flex30) | 24m (PL24) |
| --------- | ----------- | ---------- |
| Essential | £23.75      | £24.50     |
| Superfast | £24.50      | £27.50     |
| Ultrafast | £38.50      | £30.00     |
| Gigabit   | £31.75      | £40.50     |


Current headline (incl. VAT), buffers (`support 1.00`, `paymentFailure 0.50`, `lockRisk 1.00`, `flexRisk 2.00`), and floors (`essLockByo 1.50`, `essFlex 3.50`, `superfast 3.50`, `ultrafast 4.50`, `gigabit 4.50`) are too tight against current supplier costs — that is why C and E previously returned `quote_only`.

## 2. Proposed fair-pricing tune (via /admin/fair-pricing → `platform_settings.fair_pricing`)

Strategy from the brief: Essential sharp, Superfast protected, Ultrafast/Gigabit not forced cheap (quote-only acceptable). Buffers and floors unchanged — only headlines tuned so the auto-bump resolves within its 6-step cap.

```text
headline.essential.lock24:  29.99 → 33.99
headline.essential.flex30:  32.99 → 37.99
headline.superfast.lock24:  34.99 → 39.99
headline.superfast.flex30:  37.99 → 42.99
headline.ultrafast.lock24:  39.99 → 44.99
headline.ultrafast.flex30:  44.99 → 49.99
headline.gigabit.lock24:    44.99 → 52.99   (still likely quote-only — see §3)
headline.gigabit.flex30:    49.99 → 54.99
```

Buffers, floors, router/setup/add-on prices, `fallback=auto_bump`, and the Price-Lock/Flex enabled flags all stay as-is.

## 3. Expected A–E outcomes after the tune

Margin formula: `customerEx − supplierEx − support − paymentFailure − termBuffer ≥ floor`.


| #   | Scenario                                                    | Expected monthly (incl. VAT)                           | Bumped? | quote_only                                                                      |
| --- | ----------------------------------------------------------- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------- |
| A   | Essential / PL24 / own / remote                             | £33.99                                                 | no      | false                                                                           |
| B   | Essential / Flex30 / own / remote                           | £37.99                                                 | no      | false                                                                           |
| C   | Superfast / PL24 / standard router monthly / standard setup | £40.99 (£39.99 → 1 bump) + £4.99 router + £49.99 setup | yes     | false                                                                           |
| D   | Ultrafast / PL24 / premium router monthly / standard setup  | £44.99 + £7.99 router + £49.99 setup                   | no      | false                                                                           |
| E   | Gigabit / PL24 / own / remote                               | —                                                      | —       | **true** (margin can't be met within 6 bumps at £40.50 wholesale + £4.50 floor) |


E remains quote-only by design — flagged in the report as "needs higher public price, cheaper active supplier row, or floor review". No safety lowering to force E to price.

## 4. Contract Summary re-verify

Generate a CS for each of these via existing `generate-contract-summary` (no edits):

1. A — PL24 priced
2. B — Flex 30 priced
3. C — router monthly priced (also exercises one-off setup)
4. An ETF/disconnect-flagged scenario (any active row with `etf_applies=true` or `disconnect_fee_in_12m_net>0`) to confirm the `ETF_DISCONNECT_WORDING` addendum
5. E — quote-only path: confirm `generate-contract-summary` returns `409 build_plan_unsafe` (CS not issued), which is the intended behaviour

For 1–4, confirm the CS shows: speed bucket, plan term, Price Lock / Flex wording, router option, setup option, add-ons, monthly total, one-off total, first-bill estimate, VAT-inclusive residential price, the "If it is not shown in your Contract Summary…" promise, and the ETF wording on scenario 4. Confirm it does NOT show supplier/Giacom name, supplier product code, wholesale fee, supplier cost, margin, or source document.

## 5. Route smoke test

GET each and confirm 200 + no console/network errors:
`/`, `/build-plan`, `/quote/start`, `/quote/thank-you`, `/checkout`, `/pay`, `/pay-invoice`, `/admin/fair-pricing`, `/admin/quotes`, `/admin/suppliers/giacom-import`.

## 6. Deliverables (report only — no further code)

- Fair-pricing diff applied
- A–E final pricing table with `monthly`, `one_off`, `first_bill`, `quote_only`, `bumped`
- Which plans remain quote-only and why
- CS results for the 5 scenarios with field-level pass/fail
- Supplier-data security: confirmed `internal` block stripped + no `supplier_*` / `margin` / `ratecard` fields in any public response
- Route smoke pass/fail
- Any warnings/errors
- Beta-readiness verdict for controlled broadband beta

## Technical notes

- Tune is a single `UPDATE public.platform_settings SET fair_pricing = jsonb_set(...) WHERE singleton=true` (data update via insert tool, not a migration).
- No schema, no edge function, no resolver, no public-page code changes.
- `RESOLVER_VERSION = "phase_3d_hotfix"` stays.
- Tests use existing `resolve-build-plan-price` and `generate-contract-summary` invocations (admin-authed) plus a `curl` smoke for the public routes.

## Out of scope (will not touch)

Phase 7, any new feature/page, public copy beyond accuracy fixes, Worldpay HPP/webhook, invoices, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards, campaigns, complaints, finance exports, SEO, AI chat.