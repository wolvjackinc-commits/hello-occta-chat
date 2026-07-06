This revised plan is approved in principle, but before executing Phase 0 or Phase A, apply these final mandatory corrections.

1. Accepted document supersession must not update the accepted row

The plan currently says accepted rows are never updated, but also says only service_role may transition `accepted → superseded`.

To avoid contradiction, do not update an accepted row to `superseded`.

Use this safer model:

- accepted rows remain permanently `accepted`;
- new replacement rows are inserted as new versions;
- the new row stores `supersedes_id`;
- the old accepted row is never updated;
- a view may display the latest active version;
- no UPDATE or DELETE is allowed on accepted legal records.

If a `superseded` status is needed, it should apply only to draft/issued rows, or to a separate non-legal version-chain table. Do not mutate the original accepted legal row.

2. Do not grant INSERT/UPDATE to authenticated users on legal document tables

The plan currently says:

`GRANT SELECT, INSERT, UPDATE ON public.contract_information_packs TO authenticated;`

Change this to:

`GRANT SELECT ON public.contract_information_packs TO authenticated;`

Only service_role edge functions may INSERT legal documents, UPDATE draft/issued rows, or create signed PDF records.

Customer-facing users must never directly insert or update Contract Summaries, Contract Information Packs, Acceptance Certificates, acceptance records, PDF paths or hashes.

3. Confirm customer ownership mapping before RLS

Do not assume `customer_id = auth.uid()` unless the database truly uses auth user IDs as customer IDs.

RLS must use the real ownership path, for example:

- `customers.auth_user_id = auth.uid()`, or
- `account_users.user_id = auth.uid()`, or
- the existing canonical customer/account ownership table.

Before creating RLS policies, inspect the actual customer/account schema and use the real authenticated ownership relationship.

Add tests proving:

- Customer A can read their own documents;
- Customer A cannot read Customer B’s documents;
- browser-provided customer IDs are ignored;
- email matching alone is never used for authorisation.

4. Immutability trigger must work even where tables do not have `document_status`

If `contract_acceptances` or any existing table does not currently have `document_status`, do not create a trigger that assumes the column exists unless the migration adds it safely.

For acceptance records, immutability should be based on:

- accepted record exists;
- `accepted_at_utc` is not null;
- linked accepted Contract Summary hash exists;
- linked accepted Contract Information Pack hash exists.

Once accepted, block UPDATE/DELETE on acceptance records and acceptance certificates except strictly additive internal audit inserts.

5. Rollback scripts must not destroy production legal evidence

The plan says rollback scripts may drop additive columns/tables.

That is acceptable only before live customer data is written into them.

After Phase B/C goes live and any customer accepts under the new system, rollback must not drop:

- `contract_information_packs`;
- accepted document records;
- acceptance certificates;
- acceptance audit records;
- PDF hashes;
- storage paths;
- policy version evidence.

Use feature-flag rollback after customer use begins. Legal evidence must be preserved even if the feature is disabled.

6. Do not require the customer to actually download the PDFs

The acceptance flow may require both documents to be generated, displayed and made available for download.

Do not require proof that the customer physically downloaded the file.

Use:

- document generated;
- document displayed or available to view;
- download button available;
- customer checkbox confirming they received, reviewed and had the opportunity to download.

This avoids blocking customers due to browser/download issues while still preserving acceptance evidence.

7. DD export must use an explicit safe allowlist

The Phase 0 CSV export mentions DD metadata only.

Make this explicit. Export only safe fields such as:

- mandate/request ID;
- customer/account ID;
- status;
- provider reference if customer-safe/internal-safe;
- created timestamp;
- updated timestamp;
- mandate status;
- non-sensitive audit status.

Do not export:

- raw bank account number;
- sort code;
- encrypted bank fields;
- mandate secrets;
- provider credentials;
- payment tokens.

8. Create `admin_reconciliation_tasks` if missing

The plan relies on `admin_reconciliation_tasks`.

Before inserting reconciliation rows, verify the table exists.

If it does not exist, create it with:

- id;
- task_type;
- priority;
- related_table;
- related_record_id;
- customer_id nullable;
- order_id nullable;
- issue_summary;
- required_action;
- status;
- created_at_utc;
- resolved_at_utc nullable;
- admin_notes internal only.

RLS: admin only. No customer access.

9. Strengthen Phase A defaults

New snapshot fields should be nullable for legacy records, but new sign-ups must not proceed unless required fields are present.

Add server-side validation, not only UI validation.

For new customer acceptance, require:

- contract_type;
- customer_type;
- monthly price snapshot;
- VAT snapshot;
- payment_method_snapshot;
- billing_start_rule;
- speed_estimate_snapshot where applicable;
- notice_period_days;
- activation fee snapshot, even if zero/none;
- price_change_snapshot;
- Contract Summary version;
- Contract Information Pack version;
- relevant legal policy versions.

10. Add a feature flag for the new two-document flow

Add a feature flag such as:

`two_document_contract_flow_enabled`

Rollout rule:

- disabled during Phase A schema-only work;
- enabled for internal/admin test orders first;
- enabled for live customers only after Phase B/C tests pass;
- old journey must not be removed until the new one is verified.

11. Keep old signed documents viewable

The plan correctly says not to regenerate legacy accepted documents.

Also ensure the customer dashboard can still display/download old accepted Contract Summaries exactly as they were originally accepted.

Legacy documents should be labelled:

“Accepted under previous document format”

Do not imply they were accepted under the new two-document system.

12. Add migration lock

Before running Phase A migrations, add a migration lock/advisory lock so two deployment processes cannot run legal migrations at the same time.

13. Final approval condition

Proceed only with:

- Phase 0 compliance preflight;
- Phase A schema/snapshot migration dry-run;
- no customer-facing behaviour changes yet;
- no accepted document rewrites;
- no Worldpay webhook changes;
- no DD encryption changes;
- no billing logic change before Phase F.

After Phase 0 and Phase A dry-run, send back:

- exact SQL migration;
- rollback plan;
- RLS policies;
- trigger definitions;
- dry-run output;
- list of tables/columns affected;
- confirmation that no accepted PDFs/hashes/acceptance records will be modified.

Do not execute customer-facing Phase B/C until Phase 0 and Phase A are reviewed and approved.  
  
Add this mandatory correction before Phase A.

The Contract Summary and Contract Information Pack must be service-aware. They must include only the services, add-ons, charges, rights, warnings and cancellation terms that apply to the customer’s selected order.

Do not generate one generic broadband Contract Summary for every customer.

Add a product/service component model.

Add or verify these fields:

`service_components_snapshot jsonb`

This must be an array of selected service components, for example:

```json
[
  {
    "component_type": "broadband",
    "component_name": "Essential Fibre",
    "contract_type": "flex_30_rolling",
    "minimum_term_months": 0,
    "notice_period_days": 30,
    "monthly_price": "37.99",
    "vat_treatment": "inc_vat",
    "activation_fee": "80.40",
    "speed_estimate_snapshot": {
      "download": "80 Mbps",
      "upload": "20 Mbps",
      "minimum_guaranteed": null,
      "technology_description": "customer-safe broadband technology description"
    }
  },
  {
    "component_type": "digital_voice",
    "component_name": "Digital Voice / Home Phone",
    "dependency": "requires_active_occta_broadband",
    "monthly_price": "x.xx",
    "emergency_calls_warning_required": true,
    "power_cut_warning_required": true
  },
  {
    "component_type": "sim_only",
    "component_name": "SIM-only plan",
    "contract_type": "flex_30_rolling",
    "minimum_term_months": 0,
    "notice_period_days": 30,
    "monthly_price": "x.xx",
    "allowance_snapshot": {
      "data": "x GB / unlimited / as sold",
      "minutes": "as sold",
      "texts": "as sold"
    },
    "roaming_snapshot": {
      "included": true,
      "fair_usage": "as sold",
      "charges": "as shown in price guide"
    }
  }
]

```

Required component types:

- `broadband`
- `digital_voice`
- `sim_only`
- `router`
- `static_ip`
- `business_broadband`
- `other_addon`

The short Contract Summary must be generated from `service_components_snapshot`.

Rules:

1. Broadband-only order  
Show broadband service, speed estimate, activation/setup fee, router/add-ons if selected, billing, cancellation, price changes and complaints.  
Do not show SIM-only allowances.  
Do not show Digital Voice emergency-call warning unless Digital Voice is selected.
2. Broadband + Digital Voice bundle  
Show broadband section and Digital Voice section.  
Digital Voice wording must clearly say:  
“Digital Voice/Home Phone works through your broadband connection and mains power. It may not work during a power cut, broadband outage, router fault or equipment disconnection unless suitable backup is in place.”

Also show:  
“Tell OCCTA before activation if you or anyone in your household relies on the phone line for emergency calls, telecare, medical alarms, care alarms, accessibility needs, or if you have poor/no mobile coverage.”

If Digital Voice is selected, the acceptance flow must include a required checkbox:  
“I understand that Digital Voice/Home Phone depends on broadband and mains power and may not work during a power cut or broadband outage unless suitable backup is in place.”

If the customer indicates telecare, medical alarm, emergency-call dependency, vulnerability, or no reliable mobile coverage:

- create a high-priority vulnerable customer / digital voice safety task;
- do not proceed to activation until admin review is complete;
- record support action internally;
- do not expose sensitive vulnerability notes in customer PDFs.

3. SIM-only standalone  
Generate a SIM-only Contract Summary.  
Do not show broadband speed estimate.  
Do not show broadband activation fee unless one actually applies.  
Do not show router wording.  
Do not show Digital Voice warnings unless Digital Voice is included.

SIM-only Contract Summary must include:

- SIM plan name;
- monthly price;
- VAT treatment;
- contract type: Flex or Fixed;
- minimum term;
- notice period;
- early termination policy if fixed-term;
- data allowance;
- minutes allowance;
- texts allowance;
- roaming position;
- fair usage policy, if applicable;
- out-of-bundle charges or link to accepted Price Guide snapshot;
- spend cap, if offered/selected;
- number porting/PAC/STAC information where applicable;
- SIM activation information;
- cancellation/final balance wording;
- payment method wording;
- complaints/ADR wording.

4. Broadband + SIM bundle  
Generate a bundle Contract Summary with separate component rows:

- Broadband component;
- SIM-only component;
- shared billing/payment summary;
- separate charges for each component;
- bundle discount, if any;
- contract type for each component;
- notice/ETF rule for each component.

If broadband is Flex but SIM is Fixed, the Contract Summary must clearly show separate contract terms for each component.

If SIM is Flex but broadband is Fixed, the Contract Summary must clearly show separate contract terms for each component.

Do not assume all bundled components have the same contract length, notice period, ETF or price-change rule unless the accepted product snapshot says so.

5. Broadband + Digital Voice + SIM bundle  
Generate all applicable component sections.  
Keep the short Contract Summary concise, but include every key charge, term, dependency and warning.
6. Standalone Digital Voice  
Current OCCTA public wording says Digital Voice/Home Phone requires broadband. Therefore do not offer or generate standalone Digital Voice unless OCCTA actually creates a lawful standalone product.  
If standalone Digital Voice is later added, add a separate `digital_voice_standalone` component type and require legal review before enabling it.
7. Router/add-ons  
Router, static IP or other add-ons must appear only when selected or included in the accepted quote.  
Show:

- monthly charge or one-off charge;
- ownership/rental/loan status;
- return requirement if applicable;
- non-return charge only if disclosed in accepted Price Guide snapshot.

8. Bundle pricing  
For bundles, show:

- total monthly price;
- separate component prices;
- bundle discount, if any;
- VAT treatment;
- activation/setup charges per component;
- one-off charges;
- first invoice explanation.

Do not hide a charge inside the bundle.

9. Component-level cancellation  
Cancellation and final balance must work at component level.

For each component, store:

- contract type;
- minimum term;
- notice period;
- ETF policy;
- price change policy;
- dependency on other service.

Examples:

- If Digital Voice depends on OCCTA broadband and broadband is cancelled, the Digital Voice service may also need to cease.
- If SIM-only is standalone, broadband cancellation should not automatically cancel SIM unless the accepted bundle terms say so.
- If a bundle discount is removed because one component is cancelled, the accepted bundle terms must explain how pricing changes.

10. Component-level legal versions  
At acceptance, store:

- broadband terms version, if broadband selected;
- digital voice terms version, if Digital Voice selected;
- SIM-only terms version, if SIM selected;
- router/equipment terms version, if equipment selected;
- bundle terms version, if more than one component selected.

11. Add these policy/version columns if missing:

- `broadband_terms_version`
- `digital_voice_terms_version`
- `sim_only_terms_version`
- `mobile_roaming_policy_version`
- `mobile_fair_usage_policy_version`
- `number_porting_policy_version`
- `equipment_terms_version`
- `bundle_terms_version`

12. SIM-only policy pages  
Create or update these public/customer legal pages:

- `/legal/sim-only-terms`
- `/legal/mobile-fair-usage`
- `/legal/mobile-roaming`
- `/legal/mobile-number-porting`
- `/legal/mobile-spend-caps`
- `/legal/sim-activation`

13. Digital Voice policy pages  
Create or update:

- `/legal/digital-voice-emergency-calls`
- `/legal/power-cut-backup`
- `/legal/telecare-and-vulnerable-customers`

Digital Voice pages must explain:

- broadband dependency;
- mains power dependency;
- power-cut limitations;
- emergency-call limitations;
- telecare/medical alarm risk;
- address accuracy for emergency services;
- customer duty to tell OCCTA about vulnerability or reliance on the line;
- OCCTA support process.

14. Acceptance hard blocks for product components

Block acceptance if selected service component lacks required snapshot fields.

Broadband requires:

- plan name;
- monthly price;
- VAT snapshot;
- contract type;
- notice period;
- speed estimate where applicable;
- activation/setup charge snapshot, even if zero/none;
- price change snapshot.

Digital Voice requires:

- dependency wording;
- emergency-call warning;
- power-cut warning;
- customer acknowledgement checkbox;
- vulnerability/telecare screening question;
- monthly price or included price;
- VAT snapshot;
- terms version.

SIM-only requires:

- plan name;
- monthly price;
- VAT snapshot;
- contract type;
- notice period;
- allowance snapshot;
- roaming snapshot;
- fair usage snapshot;
- out-of-bundle charge snapshot or Price Guide reference;
- number porting information;
- SIM activation wording;
- price change snapshot;
- ETF snapshot if fixed-term.

Bundles require:

- all selected component snapshots;
- total monthly price;
- component pricing;
- bundle discount, if any;
- component-level contract lengths;
- component-level notice periods;
- component-level ETF rules;
- dependency wording where one component depends on another.

15. Customer dashboard rule  
Customer dashboard must show only the services the customer actually has.

Examples:

- SIM-only customer must not see broadband speed/service-live wording.
- Broadband-only customer must not see SIM allowance/roaming wording.
- Broadband + Digital Voice customer must see Digital Voice emergency/power warning.
- Bundle customer must see each service component separately.

16. Admin rule  
Customer 360 must show component-level services, pricing, contract terms, accepted documents and cancellation rules.  
Supplier references, supplier costs and margins remain admin-only and must never appear in customer PDFs/dashboard.
17. Tests  
Add tests:

- broadband-only summary has no SIM/Digital Voice sections;
- SIM-only summary has no broadband speed/router/Digital Voice sections;
- Digital Voice selected forces emergency/power warning and acknowledgement;
- telecare/vulnerability answer creates admin review task;
- bundle summary shows each component separately;
- mixed Flex/Fixed bundle shows different terms per component;
- cancellation of one component does not cancel another unless accepted bundle terms say so;
- bundle discount removal only applies if disclosed in accepted terms;
- component-level policy versions are stored at acceptance.  
  
  
  
  
  
  
  
OCCTA Compliance Upgrade — Revised Plan (with Production Safeguards)

Amended per user directive. Treated as a controlled production migration. Nothing is regenerated, rehashed, or overwritten on accepted legal records. All amendments below are binding on every phase.

---

## Global safeguards (apply to all phases)

**Immutability (absolute):**

- Any row with `document_status = 'accepted'` in `contract_summaries`, `contract_information_packs`, `acceptance_certificates`, `contract_acceptances` is never updated, rehashed, or regenerated.
- A DB trigger on those tables blocks `UPDATE`/`DELETE` where the OLD row is `accepted`. Only `service_role` may transition `accepted → superseded` and only by inserting a new version row that points at the old one.
- Signed PDFs in Storage: existing objects never overwritten; new versions get new object keys.

**Source-of-truth hierarchy (enforced in code + docs):**

1. Final quote snapshot (pre-acceptance) — `quotes`.
2. Contract Summary snapshot — `contract_summaries`.
3. Contract Information Pack snapshot — `contract_information_packs`.
4. Acceptance record — `contract_acceptances` + `acceptance_certificates`.
5. Order — `orders` (references snapshots, cannot mutate them).
6. Service — `services` (inherits from accepted order/contract on Confirm Service Live).
7. Billing — `invoices` / billing jobs (only after Confirm Service Live).

Orders/services may reference snapshots but never rewrite legal customer-facing fields.

**Timestamps:** all new columns stored in UTC (`*_at_utc timestamptz`). Display in `Europe/London` is computed in the render layer (handles BST/GMT). No hand-written "UK timestamp" string as source of truth.

**Document status state machine** (`document_status` enum, enforced by trigger):
`draft → issued → accepted → superseded` and `draft|issued → cancelled` and `any → void_manual_review` (admin reason required). `accepted` is terminal for that row; only supersession creates a new row.

**RLS / ownership:**

- Customer read on `contract_information_packs`, `contract_summaries`, `acceptance_certificates` is via authenticated `auth.uid()` mapped through `orders.customer_id` / `contract_acceptances.customer_id`. Never email-only, never browser IDs.
- Admin access via `has_role(auth.uid(), 'admin' | 'super_admin')`.
- Edge writes: `service_role` only.
- Storage buckets for signed PDFs: private; access via short-lived signed URLs generated server-side after RLS ownership check. No public bucket.
- Existing RLS policies are not weakened. New policies added only for new tables and, where necessary, to protect new customer-safe dashboard document access.

**Legacy data:** never guessed. Any ambiguous legacy record gets `legacy_compliance_status = 'manual_review_required'` and a high-priority row in `admin_reconciliation_tasks`. Original records untouched. Uncertain status is not shown to customers.

**Forbidden without change (do not touch this pass):** Worldpay webhook signature verification path, DD encryption internals, existing RLS policies (except additive), payment token hashing.

---

## Phase 0 — Compliance preflight, backups, audit baseline

Prerequisite for A. No schema mutations to legal tables in this phase — additive audit table only.

1. **Full DB backup**: user triggers via Cloud → Advanced settings → Export data (I will provide the instruction inline; I do not run pg_dump). I will additionally CSV-export via `psql COPY` the following to `/mnt/documents/` for record:
  - `contract_summaries`, `contract_acceptances`, `acceptance_certificates`
  - `quotes`, `orders`, `order_journeys`, `services`
  - `invoices`, `invoice_lines`, `first_billing_jobs`
  - `payment_attempts`, `payment_requests`, `receipts`
  - `dd_mandates`, `dd_intake_requests` (metadata only — never encrypted bank fields)
2. **Production baseline report** written to `/mnt/documents/compliance_baseline_<utc>.md`:
  - Count of Contract Summaries by status.
  - Count of accepted acceptances, with `id` + `pdf_hash` list.
  - Count of orders / live services / open invoices / active DD mandates.
3. `**compliance_upgrade_runs` table** (new):
  ```
   id uuid pk, phase text, migration_version text,
   started_at_utc, completed_at_utc, status text,
   operator_user_id uuid, notes jsonb,
   rollback_script_path text, dry_run_result jsonb
  ```
   RLS: admin read, service_role write.
4. **Rollback scripts**: for every subsequent migration I ship a matching `rollback_<version>.sql` under `supabase/migrations/rollbacks/` (drops the additive columns/tables introduced in that migration; never touches legacy data).
5. **Dry-run**: for every migration, run the SQL inside a `BEGIN; … ROLLBACK;` transaction via `psql` first, capture the result into `compliance_upgrade_runs.dry_run_result`, then submit the real migration.
6. **Immutability trigger** installed early (Phase 0) so nothing accidentally mutates accepted rows during subsequent phases:
  - `prevent_accepted_mutation()` `BEFORE UPDATE OR DELETE` on `contract_summaries`, `contract_acceptances`, `acceptance_certificates` — raises if OLD.`document_status` = `'accepted'` (allows service_role supersession path via a whitelist column bump).

Deliverables of Phase 0: audit table, baseline report, rollback pattern in place, immutability triggers live. No legal data touched.

---

## Phase A — Schema, snapshot fields, versioning

Single migration `phase_a_snapshot_fields`, additive only, with matching rollback script.

**Enums (created if absent):**

- `contract_type_enum`: `flex_30_rolling`, `fixed_term`
- `customer_type_enum`: `residential_consumer`, `business`, `microenterprise_or_small_business`, `not_for_profit`
- `document_status_enum`: `draft`, `issued`, `accepted`, `superseded`, `cancelled`, `void_manual_review`
- `payment_method_snapshot_enum`: `manual_invoice_card_worldpay`, `direct_debit_setup_request`
- `legacy_compliance_status_enum`: `ok`, `manual_review_required`, `resolved`

**Columns added (nullable, no data backfill) on `quotes`, `contract_summaries`, `orders`, `contract_acceptances` as appropriate:**

- `contract_type`, `customer_type`, `minimum_term_months`, `notice_period_days`
- `etf_policy_snapshot jsonb`, `price_change_snapshot jsonb`
- `payment_method_snapshot`, `billing_start_rule text default 'actual_service_live_confirmation'`
- `speed_estimate_snapshot jsonb`, `activation_fee_snapshot jsonb`, `one_off_charges_snapshot jsonb`, `router_addon_snapshot jsonb`, `digital_voice_addon_snapshot jsonb`, `vat_snapshot jsonb`
- `document_version int`, `document_status document_status_enum`
- `pdf_hash text`, `pdf_storage_path text`
- Timestamps (UTC): `created_at_utc`, `issued_at_utc`, `accepted_at_utc`, `superseded_at_utc`, `cancelled_at_utc`
- `display_timezone text default 'Europe/London'`
- `superseded_by_id uuid` self-ref (for version chain)
- `legacy_compliance_status legacy_compliance_status_enum default 'ok'`

**Policy version columns on `contract_acceptances` + `acceptance_certificates`:**
`contract_summary_template_version`, `contract_information_pack_template_version`, `terms_version`, `price_guide_version`, `privacy_policy_version`, `cookie_policy_version`, `complaints_code_version`, `acceptable_use_policy_version`, `vulnerable_customers_policy_version`, `digital_voice_policy_version`, `cancellation_policy_version`, `billing_policy_version` (all `text`).

**New table `contract_information_packs**` (mirrors `contract_summaries`):

```
id uuid pk, quote_id uuid, customer_id uuid,
document_version int, document_status document_status_enum,
pdf_hash text, pdf_storage_path text,
body_snapshot jsonb, template_version text,
created_at_utc, issued_at_utc, accepted_at_utc, superseded_at_utc, cancelled_at_utc,
superseded_by_id uuid, legacy_compliance_status ...
```

Followed in the same migration by:

- `GRANT SELECT, INSERT, UPDATE ON public.contract_information_packs TO authenticated;` (UPDATE blocked on accepted rows by trigger)
- `GRANT ALL ON public.contract_information_packs TO service_role;`
- `ENABLE ROW LEVEL SECURITY`
- Policies:
  - customer SELECT own via `customer_id = auth.uid()` OR via `quote_id` → `quotes.customer_id = auth.uid()`.
  - admin SELECT via `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')`.
  - service_role ALL.
- Immutability trigger extended to this table.

**New table `acceptance_audit_records**` (internal-only, separate from customer-facing `acceptance_certificates`):

```
id uuid pk, acceptance_certificate_id uuid fk,
ip_address inet, user_agent text, session_id text,
auth_user_id uuid, security_event_id uuid,
acceptance_route text, request_id text,
metadata jsonb, created_at_utc
```

GRANTs: `service_role` write; `authenticated` no direct access; admins read via secure view + `has_role`. No customer access. Never rendered into customer PDFs.

**Version-chain integrity trigger:** on `contract_summaries` / `contract_information_packs`, when inserting a row with `superseded_by_id`, verify chain consistency (customer_id + quote_id continuity).

**Legacy tagging pass (read-only + insert only, NO mutation of legacy data):**

- SQL SELECT query identifies rows where accepted acceptance exists but new snapshot fields would be null (i.e. everything currently accepted). These rows are recorded in `admin_reconciliation_tasks` with `type = 'legacy_pre_two_document_acceptance'`. No update to the original accepted row. New sign-ups after Phase C use the new fields; legacy remains valid under its original wording.

**Records rollback script**: drops added columns, tables, enums; no data loss because additive.

---

## Phases B – G (unchanged intent, safeguards baked in)

**B — Two-document generation.** Long doc always named "OCCTA Contract Information & Customer Agreement Pack". Never called "Full Contract Summary". Short summary stays short. Generators write UTC timestamps + all template versions listed above.

**C — Acceptance flow.** Acceptance blocked unless BOTH document PDFs have been made available (rendered/downloaded flag) AND all hard blockers below pass. Cooling-off starts at `accepted_at_utc`. Split acceptance record: customer-facing `acceptance_certificates` (no IP/device/security metadata) + internal `acceptance_audit_records`.

**C — Fixed-term ETF hard block.** Acceptance rejected server-side if `contract_type='fixed_term'` and `etf_policy_snapshot` lacks any of: `customer_wording`, `calculation_method`, `cap_or_formula`, `worked_example`, `vat_treatment`, `date_basis`, `based_on_accepted_agreement=true`. Generic "ETF may apply" strings fail validation.

**C — Price-rise hard block.** For `customer_type in (residential_consumer, microenterprise_or_small_business, not_for_profit)`, acceptance rejected if `price_change_snapshot` contains any of `CPI|RPI|inflation|percentage|variable|"may increase"` OR any non-`none` value without `pounds_pence_amount` + `effective_date` + `resulting_monthly_price`. Only allowed values: `{ type: 'none' }` or `{ type: 'scheduled', pounds_pence_amount, effective_date, resulting_monthly_price }`.

**C — Customer type protection.** `microenterprise_or_small_business` and `not_for_profit` retain Contract Summary + Information Pack requirements. Only `business` (large) can be relaxed and only if legal review is recorded on the row (`business_protection_waiver_ref`); default is protected.

**D — Public claims audit (mandatory, not optional).** Global sweep replaces the forbidden global claims list. Reworded per spec §24. Flex-specific claims stay only on Flex-specific pages. "Cancel anytime" removed globally; permitted only where the page fully explains notice / cease / final balance / fixed-term ETF. CI test greps the built bundle for forbidden phrases and fails the build if any reappear.

**E — Payment wording only.** Worldpay webhook, signature verification, HPP flow, token hashing untouched. DD encryption untouched. Wording updated to spec §19 / §18. DD status language remains "setup request / awaiting mandate confirmation" until `dd_mandates.status = 'active'`. No raw or encrypted DD fields in emails, PDFs, logs, dashboard, AI tools, or MCP tools.

**F — Cancellation + billing gate.** Cancellation creates a case only; customer wording uses the exact sentence from the directive. No supplier auto-cease. No immediate stop. No ETF unless accepted snapshot supports it. Billing gate (server-side, enforced in `confirm-service-live` + billing cron + `first-billing-jobs` insert trigger) blocks unless ALL of: accepted CS, accepted CIP, both hashes, order, customer, payment_method_snapshot, `actual_service_live_at_utc`, admin Confirm Service Live event, unique idempotency key. Expected activation date is never used as billing anchor.

**G — Cookies, privacy, legal pages.**

- Cookie loader: essential-only until consent. Analytics/marketing/retargeting/heatmap/AB/pixels blocked pre-consent. "Reject non-essential" as prominent as "Accept all". Consent record stores `consent_version`, `timestamp_utc`, `categories_granted`, `source_page`, `withdrawn_at_utc`.
- Privacy Policy processing table (18 rows per directive). Retention criteria used where exact periods are not OCCTA-approved.
- All legal pages footer includes: OCCTA LIMITED, company number 13828933, registered office, website, support phone, email, page version, effective date, last updated date.
- RLS: additive only, never weakened. New policies protect new document tables and customer-safe dashboard access.

---

## Testing (added to Vitest + CI)

- Accepted CS/CIP cannot be UPDATE'd (DB trigger test).
- Accepted PDF storage path cannot be overwritten.
- Quote change creates a new `issued` version and does not mutate accepted.
- Fixed-term without full ETF snapshot → 422 on accept.
- CPI/RPI/percentage price-rise wording → 422 on accept.
- No invoice / billing job creatable before Confirm Service Live (trigger test).
- First invoice uses `actual_service_live_at_utc`, never `expected_activation_date`.
- Worldpay webhook code path unchanged (snapshot test on the file's SHA).
- DD `status != active` → no collection language, no charge.
- Customer A cannot SELECT customer B's contract docs / audit records / DD fields / supplier refs.
- Analytics script tag not injected pre-consent; reject-non-essential path verified.
- Forbidden marketing claim grep test fails build on regression.

---

## Deployment order (locked)

1. **Phase 0** — backup, baseline, audit table, immutability triggers, rollback pattern.
2. **Phase A** — schema, snapshot fields, versioning, new tables, legacy tagging.
3. **Phase B** — generators.
4. **Phase C** — acceptance flow, ETF + price-rise + customer-type hard blocks, split acceptance record.
5. **Phase D** — public claims audit + copy sweep (only after A/B/C so Flex-only wording never lands on fixed-term).
6. **Phase E** — payment wording.
7. **Phase F** — billing gate + cancellation workflow (only after A/B/C tested).
8. **Phase G** — cookies, privacy, legal pages.

Each phase writes a row into `compliance_upgrade_runs` with dry-run result, migration version, operator, rollback script path, and completion status.

---

## Explicit non-goals this pass

- No Worldpay webhook code changes.
- No DD encryption/provider changes.
- No legacy accepted document regeneration or rehash.
- No weakening of existing RLS.
- No overwrites of any signed PDF or acceptance record.
- No customer-visible surfacing of supplier/internal data.

**Ready to execute Phase 0, then Phase A on your approval.**