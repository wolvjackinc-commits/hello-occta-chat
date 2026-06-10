Approved — proceed with OCCTA Phase B: Quote-to-Account Linking + Dashboard Invite + Account Numbers, with the corrections below.

This is Phase B only.

Do not start Phase C.  
Do not start Phase D.  
Do not start Phase 7.  
Do not touch Worldpay, /pay, /pay-invoice, invoices, DD mandates, supplier ordering, supplier_products, supplier resolver, quote resolver, Contract Summary generation/acceptance, rewards, campaigns, complaints, finance exports, AI chat or magic-link auth.

Critical corrections before coding:

1. Fix linker function design

The customer-facing RPC:

link_quote_requests_to_user(_user_id uuid)

must verify:

- auth.uid() is not null
- *user*id = auth.uid()
- the authenticated user email matches the quote_request email

This function is for logged-in customer self-linking only.

However, do not rely on this same function inside handle_new_user() if it depends on auth.uid(), because auth.uid() may not exist in the auth trigger context.

For signup auto-linking, either:

- perform the quote_request update directly inside handle_new_user() using [NEW.id](http://NEW.id) and [NEW.email](http://NEW.email), or
- create a separate internal SECURITY DEFINER helper used only by handle_new_user()

Do not create a function that lets arbitrary user IDs link quotes without email verification.

2. RLS email-match policy must use verified auth email safely

Do not write an RLS policy that depends on directly selecting from auth.users in a way that may fail or expose data.

Preferred customer select policy logic:

- customer_id = auth.uid()  
OR
- customer_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email')

Only allow this if the user is authenticated.

This lets a newly signed-up customer see their guest quote before backfill, but does not expose quotes publicly.

3. Admin manual linking must be tightly controlled

Admin link override must require:

- staff/admin role
- selected quote_request_id
- selected target profile/user
- reason text
- audit log
- old customer_id
- new customer_id
- actor/admin user id
- timestamp

If email does not match, show a strong warning:  
“Email does not match this quote request. Confirm manual override reason.”

Do not allow normal support/customer users to use this RPC.

Phase B scope approved:

1. Account number workflow

Use existing:

- profiles.account_number
- unique/indexed account number
- trigger_assign_profile_account_number
- handle_new_user()

Confirm account number format:  
OCC########

Show account number in:

- dashboard header
- admin quote request/customer context
- linked quote request details

2. Quote request linking

Guest Build Plan submission:

- creates quote_request with email, phone, postcode, selections
- customer_id remains null initially
- thank-you page shows dashboard creation/sign-in CTAs

Logged-in Build Plan submission:

- creates quote_request with customer_id immediately
- dashboard shows quote immediately

Later signup/sign-in with same email:

- link matching unlinked quote_requests to that authenticated user
- only match same email
- backfill customer_id
- dashboard shows linked quote

Wrong user:

- must not see another customer’s quote

3. Customer dashboard quote requests

Add Quote Requests tab or extend Quotes tab.

Customer should see:

- quote reference
- request date
- selected speed bucket
- Price Lock 24 or Flex 30
- postcode
- status
- message: “No payment has been taken. We’ll confirm final speed, setup and order details before you proceed.”

Customer must not see:

- supplier name
- Giacom name
- supplier cost
- margin
- internal product ID
- admin notes
- backend product assignment

4. Thank-you page dashboard CTAs

If logged in:  
Show:  
“View this quote in your dashboard”

If guest:  
Show:

- “Create your OCCTA dashboard”
- “Sign in to dashboard”

Prefill email using query parameter or location state.

Safe fallback copy:  
“Use the same email address when creating your dashboard account so we can link your quote.”

5. Auth page

Auth page should:

- read email query param
- prefill email field
- if link=qr is present, show:  
“Use the same email address from your quote request so we can link it to your dashboard.”
- after successful signup/sign-in, call link_quote_requests_to_user(auth.uid())
- show toast:  
“Linked X quote request(s) to your account” if X > 0

Do not build magic-link auth in this phase.

6. Admin Quote Requests page

Add:

- Guest / Linked customer badge
- account number if linked
- customer_id/user_id indicator
- dashboard invited/account created status where derivable
- “Link to account…” admin action
- warning if profile exists with matching email but quote_request is still unlinked

Manual link dialog:

- search/select existing customer profile
- require reason
- call admin_link_quote_request
- audit log must be written

7. Email placeholder only

Do not build full communications automation.

A simple preview/draft is okay:

Subject:  
“Your OCCTA quote request has been received”

Body includes:

- customer name
- quote reference
- selected plan summary
- postcode
- “No payment has been taken”
- dashboard sign-in/create account link
- “We’ll confirm final speed, setup and order details before you proceed.”

If email sending is not configured, keep this as preview/draft only and report it.

8. Security/RLS tests required

Test:

- anonymous cannot list quote_requests
- customer can see own linked quote_requests only
- newly signed-up same-email customer can see their guest quote
- wrong user cannot see another customer’s quote
- admin/staff can see quote queue
- admin manual link writes audit log
- supplier/internal pricing remains hidden

9. Must remain untouched

Confirm no:

- live order
- payment link
- Contract Summary
- invoice
- DD mandate
- active service
- supplier order

10. Required verification tests

Test A — guest quote:

- submit Build Plan as guest
- quote_request created
- customer_id null initially
- thank-you shows dashboard CTA
- no order/payment/Contract Summary/invoice/service created

Test B — signup/sign-in same email:

- create/sign in with same email
- quote_request links to user
- account number exists
- dashboard shows quote

Test C — logged-in quote:

- submit Build Plan while logged in
- quote_request created with customer_id immediately
- dashboard shows quote immediately

Test D — wrong user:

- different user cannot see quote

Test E — admin:

- admin sees guest/linked status
- admin sees account number when linked
- admin manual override requires reason
- audit_logs row created

Test F — RLS:

- anonymous cannot list quote_requests
- customer sees only own quote_requests
- admin sees queue

11. Final report

Stop after Phase B and report:

- files changed
- migrations added
- account number workflow verification
- quote-to-user linking behaviour
- handle_new_user/linker implementation detail
- dashboard invite behaviour
- customer dashboard quote visibility
- admin quote ownership visibility
- RLS/security test result
- guest quote test result
- same-email signup/link test result
- logged-in quote test result
- wrong-user test result
- admin manual link/audit log result
- TypeScript/build result
- what was untouched
- remaining blockers before full automation  
  
  
  
Phase B — Quote-to-Account Linking, Dashboard Invite, Account Numbers

### Audit findings (no work needed in these areas)

- `profiles.account_number` — already exists, unique, indexed.
- Trigger `trigger_assign_profile_account_number` already auto-generates `OCC########` on every new profile, and `handle_new_user()` creates the profile on signup. **Account number workflow is already live for every signup** — no schema change needed.
- `quote_requests` already has `customer_id` (nullable FK → profiles), `email`, `reference`, status enum.
- `submit-build-plan` edge function already sets `customer_id` when the caller is authenticated.
- RLS on `quote_requests`: customer self-select via `customer_id = auth.uid()`, staff full access, no public INSERT policy (guest writes go through service-role edge fn — correct).
- Customer dashboard `QuotesTab` reads `quotes` table only; it does NOT show `quote_requests`. **Gap.**
- Admin `QuoteRequests` page has no manual-link UI and doesn't display linked-customer / account_number context. **Gap.**
- No automatic email-match backfill when a user later signs up. **Gap.**

### What Phase B will build

#### 1. DB — minimal additions (one migration)

- `link_quote_requests_to_user(_user_id uuid)` — SECURITY DEFINER function that backfills `quote_requests.customer_id = _user_id` for rows where `customer_id IS NULL` and `lower(email) = lower(auth.users.email)`. Runs only for the calling user; verifies `_user_id = auth.uid()`. Returns the count linked.
- Trigger on `auth.users` is not editable, so instead extend `handle_new_user()` to call the linker for the new user's id+email. Keeps backfill automatic on signup.
- `admin_link_quote_request(_qr_id uuid, _new_user_id uuid, _reason text)` — SECURITY DEFINER, staff-only. Writes to `audit_logs` (old `customer_id`, new, reason, actor). Used by admin manual override.
- New RLS INSERT policy: NONE added (guest writes stay edge-fn only — correct).
- Verify `qr_customer_select_own` covers email-only matches too: extend to `(customer_id = auth.uid()) OR (customer_id IS NULL AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))`  so a freshly-signed-up user sees their guest quote even before the linker runs. (Belt-and-braces.)

#### 2. Customer dashboard

- New tab/section `QuoteRequestsTab` (or extend `QuotesTab`) showing rows from `quote_requests` for `auth.uid()`:
  - reference, created_at, derived "speed bucket" + "Price Lock 24 / Flex 30" parsed from `message` (already encoded by submit-build-plan), postcode, status, "No payment taken / final details to be confirmed" notice.
  - Never displays supplier / margin / internal product id (those columns aren't on quote_requests anyway).
- Add account_number to dashboard header (already in profile — surface it).

#### 3. Thank-you page

- After submission, if user is logged in → show "View this quote in your dashboard" link to `/dashboard`.
- If guest → two CTAs:
  - "Create your OCCTA dashboard" → `/auth?mode=signup&email=<prefilled>&link=qr&ref=<ref>`
  - "Sign in to dashboard" → `/auth?mode=signin&email=<prefilled>`
- Fallback copy: "Use the same email address when creating your dashboard account so we can link your quote."
- Pass `email` from submission state so QuoteStart includes it in navigation state.

#### 4. Auth flow

- `Auth.tsx` reads `email` query param and prefills. After successful sign-in/signup, calls `link_quote_requests_to_user(auth.uid())` RPC and toasts "Linked N quote request(s) to your account" if N > 0.
- No magic-link build — re-use existing email/password + Google. Add a small note on auth page when `?link=qr` is present.

#### 5. Admin Quote Requests page

- New columns: "Customer" (linked badge with account_number) vs "Guest", `user_id` indicator.
- Row action "Link to account…" → dialog: search by email/name (reuse existing `CustomerLookup`/`CustomerPicker`), require reason text, calls `admin_link_quote_request` RPC. Writes audit log automatically.
- Highlight rows where `customer_id IS NULL` but a profile exists with matching email (suggest auto-link).

#### 6. Verification tests

After build, run:

- A: guest submit (already verified in last test).
- B: sign up with same email → confirm `customer_id` backfilled; quote shows in dashboard with account_number visible.
- C: logged-in submit → confirm `customer_id` set immediately.
- D: second user logs in → cannot see the first user's quote (RLS).
- E: admin manual link → audit_logs row written.
- F: anonymous select on `quote_requests` returns 0 rows.

### Untouched (per constraints)

Worldpay, `/pay`, `/pay-invoice`, invoices, DD mandates, supplier ordering, `supplier_products`, supplier resolver, quote resolver, Contract Summary generation/acceptance, rewards, campaigns, complaints, finance exports, AI chat, magic-link auth.

### Technical details

**Files to add:**

- `supabase/migrations/<ts>_phase_b_linking.sql` — `link_quote_requests_to_user`, `admin_link_quote_request`, extend `handle_new_user`, replace `qr_customer_select_own` policy.
- `src/components/dashboard/tabs/QuoteRequestsTab.tsx` — new tab.
- `src/components/admin/LinkQuoteRequestDialog.tsx` — admin manual link UI.

**Files to edit:**

- `src/pages/quote/QuoteStart.tsx` — pass email/loggedIn flag to thank-you state.
- `src/pages/quote/QuoteThankYou.tsx` — dashboard CTAs branched on auth state.
- `src/pages/Auth.tsx` — email prefill + post-auth linker RPC call.
- `src/pages/Dashboard.tsx` — mount new tab, surface account_number in header.
- `src/pages/admin/QuoteRequests.tsx` — link badges, manual-link action.

**No edits to:** `submit-build-plan` (already links logged-in users), payment functions, supplier/quote resolvers, contract-summary code, types.ts.