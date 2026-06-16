Approved — proceed with Stage 2, subject to the mandatory corrections below.

Stage 2 scope remains:

- branded Contract Summary
- Contract Summary ready email
- customer view/download/accept flow
- signed/accepted confirmation email
- customer Documents hub
- admin document visibility
- dashboard/timeline synchronisation

Do not add invoices, payment receipts, DD setup, supplier ordering, service activation or provisioning in Stage 2.

## Mandatory correction 1 — preserve Contract Summary immutability

The existing Phase D PDF immutability rules remain the source of truth.

Required:

- Generate and store the Contract Summary PDF before sending it to the customer.
- Store and preserve:
  - `pdf_storage_key`
  - `pdf_sha256`
- Once the Contract Summary is accepted, never overwrite, replace or silently regenerate that original PDF.
- If an accepted Contract Summary is missing its PDF/hash, hard-block acceptance and report the data issue.
- Do not generate a different PDF after acceptance and call it the same document.

For the “signed copy”, use either:

- the original immutable Contract Summary PDF plus a separate acceptance certificate; or
- a separately versioned accepted-copy document that references the original PDF hash and acceptance record.

The accepted-copy/certificate should show:

- Contract Summary number
- original document SHA-256
- customer name
- accepted timestamp
- acceptance method
- acceptance reference
- customer account/quote reference

Do not alter the original issued document.

## Mandatory correction 2 — do not store raw tokens

In `send-contract-summary-email`:

- generate the raw token inside the edge function
- store only the SHA-256 token hash
- never save the raw token in the database
- never log the raw token
- never return it to admin diagnostics

The raw token may only appear in the customer email URL.

If resending rotates the token, clearly treat the newest email link as the active link. Do not rotate or change any token after the Contract Summary has already been accepted.

## Mandatory correction 3 — acceptance must be idempotent

Repeated clicks or retries must not:

- create duplicate `contract_acceptances`
- send duplicate welcome emails
- create duplicate accepted-copy documents
- change the accepted timestamp
- modify the original PDF/hash

Only the first successful acceptance should:

- create the acceptance record
- lock the Contract Summary
- create the accepted-copy/certificate
- trigger the welcome/signed-copy email
- notify admin

Later requests should safely return:

`Contract Summary already accepted`

and provide access to the existing accepted document.

## Mandatory correction 4 — email failure must not undo acceptance

Acceptance and document locking are the legal/business action.

Email delivery is secondary.

Required order:

1. Validate CS/token/customer.
2. Confirm immutable PDF exists.
3. Atomically create acceptance and lock the CS.
4. Create/reuse accepted-copy or acceptance certificate.
5. Attempt welcome email.
6. Log email result.

If email sending fails:

- acceptance must remain valid
- accepted document must remain available
- log the communication as failed
- show admin a “Resend acceptance email” action
- do not roll back the signed acceptance

## Mandatory correction 5 — no lazy regeneration of accepted PDFs

In `DocumentsTab`:

Do not ask the customer browser to generate a missing accepted Contract Summary PDF.

Allowed:

- request a fresh short-lived signed download URL for an existing stored PDF
- generate an issued PDF before sending, if it has never been issued
- show an admin-visible data warning if an accepted CS has no immutable stored PDF

Not allowed:

- regenerating the accepted legal PDF from current mutable database values
- overwriting the accepted PDF
- changing its hash

## Mandatory correction 6 — secure signed-copy access

Do not rely only on a seven-day storage URL as the customer’s permanent copy.

Email may contain:

- a secure Contract Summary route that can issue a fresh download URL; and optionally
- a short-lived direct PDF URL for convenience

The customer Documents hub must always allow the customer to retrieve their accepted copy through authenticated or properly token-scoped access.

Wrong customer and anon users without a valid token must be denied.

## Mandatory correction 7 — use the proceed timestamp, not an invented status

The admin Generate Contract Summary action should become available based on:

- final quote approved/sent
- `customer_intent_proceeded_at IS NOT NULL`
- no active Contract Summary already exists for that quote

Do not depend on a `customer_intent_proceeded` quote status unless that exact status genuinely exists.

## Actor-type bug fix

Fix the acceptance failure as identified:

- token/public acceptance activity should use allowed actor type `anon`
- authenticated acceptance should use actor type `customer`
- admin/system actions should use the matching valid actor type

Apply the correction consistently to both `activity_log` and `quote_events`.

## Contract Summary ready email

The email should contain:

Subject:  
`Your OCCTA Contract Summary is ready`

Main CTA:  
`View and accept Contract Summary`

Content:

- customer name
- CS number
- package
- monthly amount
- no payment taken yet
- what the customer needs to do
- what happens after acceptance
- OCCTA support details

Log every send attempt in `communications_log` with:

- contract_summary_id
- recipient
- template
- sent/failed status
- timestamp
- provider message/reference where available

Do not include supplier, margin, SKU or internal fields.

## Acceptance/welcome email

Subject:

`Welcome to OCCTA — your Contract Summary is accepted`

Use warm, friendly copy such as:

“Welcome aboard — the paperwork is officially behaving itself. Your Contract Summary has been accepted and your copy is safely stored below.”

Include:

- Contract Summary number
- accepted timestamp
- plan and monthly price
- secure View/download accepted copy button
- next step: OCCTA will send the secure payment request
- support contact details

Do not automatically create a payment request.

## Documents hub

Customer Documents should show:

- Final quote
- Issued Contract Summary
- Accepted/signed Contract Summary or acceptance certificate
- issued date
- accepted date
- status
- secure view/download action

Admin customer/document area should show the same documents plus:

- email sent timestamp/status
- accepted timestamp
- hashes/references where appropriate
- resend email actions

Supplier costs, margins, SKUs and admin notes must remain excluded from customer payloads.

## Verification against QT-2606-a294fe6a

Confirm:

1. Customer proceeded timestamp exists.
2. Admin can generate one Contract Summary.
3. Immutable PDF and hash exist before sending.
4. CS-ready email is sent/logged.
5. Token link opens the branded CS.
6. Customer can view and download it.
7. Customer acceptance succeeds — no actor-type 500.
8. Original PDF/hash remain unchanged after acceptance.
9. Acceptance record is created once.
10. Accepted-copy/certificate is available.
11. Welcome/signed-copy email is sent/logged.
12. Repeating acceptance creates no duplicate acceptance/email/document.
13. Customer dashboard and Documents update.
14. Admin view and journey timeline update.
15. No payment request is automatically created.
16. No invoice, DD mandate, supplier order, service or provisioning row is created.

Report:

- files and migrations changed
- original PDF/hash before and after acceptance
- acceptance idempotency result
- CS-ready email result
- welcome email result
- failed-email behaviour
- customer Documents result
- admin Documents result
- RLS/wrong-user/anon result
- no-side-effect result
- TypeScript and production-build result

Stop after Stage 2.  
  
  
  
  
  
Stage 2 — Contract Summary, Acceptance, Documents

Most of the backend infrastructure already exists (`generate-contract-summary`, `generate-contract-summary-pdf`, `accept-contract-summary`, `get-contract-summary-by-token`, `contract_summaries`, `contract_acceptances`, secure-token pages, `DocumentsTab`, `ContractSummariesTab`, `ContractSummaryView`, `ContractSummaryAuthedView`). The gaps are: a real "Contract Summary ready" email, a proper signed-copy welcome email with download link, a bug fix in `accept-contract-summary` that blocks acceptance, admin-side visibility from Quote Requests, and a cleaner Documents hub. No Worldpay / invoices / DD / supplier / provisioning code will be touched.

### Test target

QT-2606-a294fe6a → its existing approved quote.

---

### 1. Bug fix: customer acceptance currently fails

`accept-contract-summary/index.ts` calls `log_event` with `_actor_type: "public"` and inserts a `quote_events` row with `actor_type: "public"`. The `activity_log` CHECK constraint only allows `customer/admin/system/ai/anon` — same root cause we already hit on `customer_proceed_with_quote_by_token`. The accept call returns 500 today.

Fix: change both to `actor_type: "anon"` (token flow has no auth).

### 2. Branded Contract Summary page + PDF

- `src/pages/quote/ContractSummaryView.tsx` (token route) — add OCCTA logo/header band, clearer plan summary block (speed down/up + plan term + monthly inc-VAT prominently), explicit setup/router/installation/delivery one-off section, Digital Voice emergency-call warning panel (already partially present, polish copy), legal links (terms/privacy/complaints), issued date, and a "Download PDF" button that invokes `generate-contract-summary-pdf` with the token and opens the signed URL. Acceptance section unchanged in logic, restyled.
- `supabase/functions/generate-contract-summary-pdf/index.ts` — keep current jsPDF structure (immutable), but tighten the header to match brutalist branding (large "OCCTA Ltd · CONTRACT SUMMARY" header, CS number/version block, separators), pricing table with clear monthly + itemised one-offs, Digital Voice warning section, dated acceptance block when accepted. **Confirms** internal/supplier/margin/SKU fields are excluded (they already are).
- Customer auth view `src/pages/dashboard/ContractSummaryAuthedView.tsx` — same polish; show accepted timestamp + download.

### 3. Admin "Generate / Send Contract Summary"

- `src/pages/admin/QuoteRequests.tsx` — in the drawer for a quote request whose status is `customer_intent_proceeded` (or any approved-with-proceed state), add a primary CTA "Generate Contract Summary" that calls `generate-contract-summary`, then a follow-up "Send to customer" CTA that calls a new `send-contract-summary-email` function. Show the resulting CS number, status, last-sent timestamp, accepted timestamp, and a "Open / Download PDF" link. Existing CS generation in `admin/Quotes.tsx` stays.
- New `src/pages/admin/CustomerDetail.tsx` panel (small section): list CS rows for the customer with status badges and download/copy-link buttons.

### 4. New edge function: `send-contract-summary-email`

Admin-only (uses `requireStaff`). Input: `{ contract_summary_id }`. Behaviour:

1. Load CS, ensure `status in (issued, viewed)`.
2. Rotate `public_token_hash` and write a fresh raw token (so links from old drafts can't be reused).
3. Send branded "Your OCCTA Contract Summary is ready" email to `customer_email_snapshot` with the secure link `/quote/contract-summary/<token>` and a one-line plan/price summary. No supplier/internal details.
4. Insert a row in `communications_log` (channel `email`, direction `outbound`, template `contract_summary_ready`, related `contract_summary_id`).
5. `log_event` with `actor_type='admin'`, source_module `contract_summary`.

### 5. Signed-copy / welcome email after acceptance

Update `accept-contract-summary` (token) and `accept-contract-summary-authed` so after a successful acceptance they:

- Call `generate-contract-summary-pdf` (internal/service header) to ensure the immutable PDF exists and get a signed URL.
- Send a warm branded "Welcome to OCCTA — your Contract Summary is accepted" email containing: thanks/welcome line, CS number, plan + monthly price, "Download your signed copy" button (signed URL, 7 days), next-step note that OCCTA will follow up with the secure payment link, support email/phone from `companyConfig`. Subject exactly: `Welcome to OCCTA — your Contract Summary is accepted`.
- Insert `communications_log` row (`contract_summary_accepted_welcome`).
- The existing internal admin notification email stays.
- **Do not** create a payment request, invoice, DD mandate or supplier order.

### 6. Documents hub

- Customer `src/components/dashboard/tabs/DocumentsTab.tsx` — for each CS row, if `pdf_url` is null call `generate-contract-summary-pdf` (authed) lazily on first click to get a signed URL; show status badges (`Issued` / `Accepted`); add a "Signed copy" line when `accepted_at` is set. Also surface the final approved quote (read-only) via existing quote view link. Keep `invoices`/`user_files` rows intact — Stage 2 leaves invoices unchanged.
- Admin `CustomerDetail.tsx` — new "Documents" section mirroring the same list (quote link, CS row with status + download link + sent/accepted timestamps).

### 7. Dashboard + journey sync

- `CustomerJourneyTimeline.tsx` and `AdminJourneyTimeline.tsx` already consume `quote_events`; the new `contract_summary_email_sent` event from step 4 will add itself to both timelines. Add a small icon mapping for it. Acceptance event already flows through.
- `ContractSummariesTab.tsx` — ensure the status badge updates after acceptance (re-fetch on focus).

### 8. RLS / security

- No schema changes are needed; `contract_summaries`, `contract_acceptances`, `communications_log` already have policies. The new edge function uses `requireStaff` + service role for the email send; tokens stay SHA-256 hashed (existing pattern).
- Token rotation in step 4 means old email links go stale, matching the standard already used by `send-quote-email`.

### 9. Verification

After build, run through QT-2606-a294fe6a manually in the preview:

1. Admin → Quote Requests → open drawer → click "Generate Contract Summary" → CS row appears with `Issued`.
2. Click "Send Contract Summary" → email logged in `communications_log`; customer receives email with secure link.
3. Open token link → branded CS page renders, "Download PDF" works.
4. Accept with matching name/email → success toast, status flips to `Accepted`, welcome email arrives with signed-copy link, internal admin email arrives.
5. Customer dashboard → Documents shows the CS with `Accepted` badge and download.
6. Admin → CustomerDetail → Documents mirrors the same.
7. Verify no `payment_requests`, `invoices`, `dd_mandates`, `orders`, `services`, or `manual_fulfilment_orders` rows were created for this customer.

### Files to change

- `supabase/functions/accept-contract-summary/index.ts` (bug fix + welcome email + PDF link + comm log)
- `supabase/functions/accept-contract-summary-authed/index.ts` (welcome email + PDF link + comm log)
- `supabase/functions/generate-contract-summary-pdf/index.ts` (branding polish only — no schema/logic change)
- `supabase/functions/send-contract-summary-email/index.ts` **(new)**
- `src/pages/quote/ContractSummaryView.tsx` (branding + PDF download)
- `src/pages/dashboard/ContractSummaryAuthedView.tsx` (branding + status)
- `src/pages/admin/QuoteRequests.tsx` (Generate/Send CS controls + CS panel)
- `src/pages/admin/CustomerDetail.tsx` (Documents panel)
- `src/components/dashboard/tabs/DocumentsTab.tsx` (lazy signed URL + accepted badge)
- `src/components/dashboard/tabs/ContractSummariesTab.tsx` (status refresh + signed-copy row)
- `src/components/dashboard/CustomerJourneyTimeline.tsx` + `src/components/admin/AdminJourneyTimeline.tsx` (icon for new email event)

### Out of scope (Stage 3+)

Payment requests, invoices, receipts, DD mandate UI, supplier order submission, provisioning, automatic billing — none touched.