  
Approved for Phase 3D-QA only, with these corrections before running.

Do not start Phase 7.  
Do not add new features.  
Do not touch Worldpay HPP/webhook, invoice generation, DD mandates, /pay, /pay-invoice, checkout gate, rewards, campaigns, complaints, finance exports, SEO setup or AI chat.

Corrections:

1. Price Lock 24 term safety

For live pricing, Price Lock 24 should prefer 24-month supplier rows only.

Do not automatically use 36-month supplier rows for a 24-month customer plan unless:

- admin explicitly marks the row as allowed for Price Lock 24, and
- extra supplier-risk buffer is applied, or
- the customer-facing product is changed to Price Lock 36.

For this QA starter set, all selected Price Lock rows are 24-month, so this is fine.

2. Superfast 115Mbps wording

`VF-FTTP-115` can be activated for testing, but if it is mapped to Superfast, customer wording must not imply 150–330Mbps only.

Use one of these:

- Superfast: 100–330Mbps options  
or
- show exact matched speed in the Build Plan result, e.g. “up to 115Mbps at your address”.

Do not show “150–330Mbps” if the resolver selected a 115Mbps product.

3. SQL activation audit

Using SQL update is acceptable for QA, but make sure activation is auditable.

Either:

- create an activity_log entry for the 10 activated rows, or
- add a clear QA note listing the activated supplier_product_id values, timestamp and reason.

Do not activate rows silently without record.

4. Scenario F correction

Scenario F is valid, but deactivate only the relevant 1-month rows needed to prove fallback.

For Essential Flex 30, deactivate the active Essential 1-month row:

- `BT-SOGEA-80-1M`

Then confirm Flex 30 does not wrongly fall back to a 24-month product unless explicitly allowed.

After test, reactivate the row.

5. Admin pricing test cleanup

When bumping a headline price by £1 in `/admin/fair-pricing`, restore the original value after the test.

Record:

- original price
- temporary test price
- restored price

6. Contract Summary check

In the Contract Summary, do not show:

- supplier name
- Giacom name
- wholesale fee value
- supplier product code
- source document/page

Only show customer-safe wording:  
“Cease, disconnection or early termination charges may apply depending on your selected service and when it ends. Any known charges are shown before you order.”

7. Security allowlist

Keep the strict allowlist check.

Public response keys must not include:

- supplier cost
- supplier product ID
- supplier selected internally
- network/provider
- margin
- margin floor
- internal block
- source document/page/section
- wholesale ratecard values

8. Run the QA exactly as described

Activate the 10 starter rows only.  
Keep the other 81 rows inactive.  
Run scenarios A–F.  
Check First Bill Preview vs create-quote vs Contract Summary.  
Check route smoke tests.  
Stop after QA and report.

Final report should include:

- 10 products activated
- 81 products kept inactive
- scenario A–F pricing result
- quote-only fallback result
- First Bill Preview match result
- Contract Summary warning result
- supplier-data security verdict
- unchanged route checks
- any warnings/errors  
Phase 3D-QA: Giacom Activation + Live Pricing Test

Activate a minimal starter set of Giacom broadband products covering each bucket and both term preferences (Flex 30 = 1m, Price Lock 24 = 24m), then run the full Build Plan → Quote → Contract Summary pricing journey and verify no supplier data leaks.

### Starter activation set (10 rows)

Selected to give the resolver at least one short-term (1m or 12m) and one 24m row per bucket, mixing networks so Sky FTTP, BT FTTP, Vodafone FTTP and CityFibre are all represented.


| Bucket    | Activate                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| essential | `BT-SOGEA-80-1M` (£23.75, 1m), `BT-FTTP-80-24M` (£24.50, 24m), `SKY-SOGEA-80-24M` (£25.00, 24m)                                           |
| superfast | `VF-FTTP-115` (£24.50, 1m), `BT-FTTP-160-24M` (£27.50, 24m), `BT-FTTP-330-24M` (£30.00, 24m) — 330/50 selected here for test scenario C/D |
| ultrafast | `SKY-FTTP-550-1M` (£38.50, 1m), `BT-FTTP-550-24M` (£36.00, 24m)                                                                           |
| gigabit   | `CF-FTTP-1G` (£31.75, 1m), `BT-FTTP-1000-24M` (£40.50, 24m)                                                                               |


All 10 rows pass the review checklist: known supplier monthly cost, known speed/term, ETF flag present, bucket_hint set, quote_only false, source = `giacom_broadband_ratecard_v3.8.1`. All other 81 seeded rows stay inactive.

### Activation mechanism

Toggle `active = true` for the 10 IDs above via a data-only SQL update (insert tool). The admin UI at `/admin/suppliers/giacom-import` already exposes the same toggle — using SQL is equivalent and audit-logged via the same row history, but faster and avoids 10 browser clicks. Nothing else changes.

### Pricing tests on `/build-plan`

Run server-side via `resolve-build-plan-price` (`?test=1` short-circuit) to avoid touching ICUK and to keep test predictable. For each scenario, capture the JSON response and check it.


| #   | Scenario                                                                                                                                                                                       | Expected                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| A   | essential, Price Lock 24, own router, remote setup                                                                                                                                             | matched, monthly = retail derived from £24.50 cost band |
| B   | essential, Flex 30, own router, remote setup                                                                                                                                                   | matched, monthly from 1m row £23.75                     |
| C   | superfast (330/50), Price Lock 24, standard router monthly                                                                                                                                     | matched + router add-on                                 |
| D   | ultrafast (550/75), Price Lock 24, premium router monthly                                                                                                                                      | matched + premium router uplift                         |
| E   | gigabit, Price Lock 24, own router, remote setup                                                                                                                                               | matched from BT-FTTP-1000-24M                           |
| F   | After deactivating `BT-SOGEA-80-1M` + `VF-FTTP-115` and asking for essential on Flex 30 with no other 1m essential row, expect `quote_only` with address-confirmation copy. Re-activate after. | &nbsp;                                                  |


### Customer-data security check

For every response (A–F), assert the JSON body and the network request payload contain **none** of:

- `supplier_monthly_net`, `supplier_setup_net`, any `supplier_*` field
- `supplier_product_id`, supplier row UUIDs
- `network` / `provider` chosen internally
- `margin`, `margin_floor`, `internal` block
- `source_document`, `source_page`, `source_section`
- Raw ratecard wholesale values

Allowlist check: response keys must be a strict subset of the existing public response schema (monthly, oneOff, vat, warnings, quoteOnly, bucket, term, router, setup, notes).

### First Bill Preview check

On `/build-plan` review step for scenario C, confirm:

- broadband monthly, router monthly or one-off, setup line, add-ons, VAT line, estimated first bill total
- Same figures appear when invoking `create-quote` (same payload echoes back identical numbers)
- Same figures appear in the generated Contract Summary

### Contract Summary check

Generate a CS for scenario D (ultrafast, ETF row, premium router). Verify:

- Speed bucket = Ultrafast
- "Price Lock 24" wording
- Router choice, setup option, add-ons listed
- Monthly total + first bill estimate
- Warning paragraph: "Cease, disconnection or early termination charges may apply depending on your selected service and when it ends. Any known charges are shown before you order."
- No wholesale fee values, no supplier name, no Giacom reference appears

### Admin pricing check

Open `/admin/fair-pricing` and confirm:

- Headline prices, router prices, setup prices, buffers, margin floors, quote-only fallback all render
- Bump one headline by £1, re-run scenario A — verify retail price moves accordingly

### Unchanged-route smoke checks

Load each and confirm 200 + render with no console errors:
`/`, `/build-plan`, `/quote/start`, `/quote/thank-you`, `/checkout`, `/pay`, `/pay-invoice`, `/admin/fair-pricing`, `/admin/quotes`, `/admin/suppliers/giacom-import`.

### Untouched

Worldpay HPP/webhook, invoice generation, DD mandates, `/pay` & `/pay-invoice` business logic, checkout gate, rewards, campaigns, complaints, finance exports, SEO setup, AI chat.

### Output

Final report will include: products activated, products kept inactive (count + bucket breakdown), 6 pricing scenario results, quote_only fallback result, First Bill Preview vs CS match, Contract Summary content check, supplier-data security verdict per scenario, unchanged-route checks, any warnings/errors. No new features. No Phase 7.