
# Stage 1 — Final quote: email link, branded view, Proceed action, dashboard refresh

Goal: when admin approves a final quote, the customer (a) gets a branded email with a one-click button that opens their final quote, (b) sees a properly branded `/quote/:token` page with a working "Proceed with this quote" button, and (c) sees the proceed state reflected on their dashboard. Admin gets notified so they can generate the Contract Summary manually. No payment, supplier order, service, invoice, DD, or provisioning side effects.

## What the customer sees

1. **Email** (template "final-quote-ready", branded OCCTA, single primary CTA "View your final quote") sent the moment admin approves and clicks "Send final quote". Button links to `https://www.occta.co.uk/quote/{quote_token}`. No login required — token is already validated server-side by `get-quote-by-token`.
2. **Final quote page** `/quote/:token` — already exists, gets a polish pass:
   - OCCTA logo + quote number + plan name (already there)
   - Add: customer name + service postcode (from quote), validity date, "No payment is taken at this stage" notice (already there, made more prominent)
   - Add: Digital Voice add-on line + emergency-call warning when applicable
   - Add: primary CTA **"Proceed with this quote"** (only if `status in ('approved','sent','viewed')` and `expires_at > now()`).
   - After clicking: confirmation state ("Thanks — we'll prepare your Contract Summary"). Button hidden on subsequent visits if intent already recorded.
3. **Dashboard → Quotes tab**: the row shows a new badge **"Proceeding"** once intent is recorded, plus a "View final quote" link that opens `/quote/:token` in a new tab. If the quote has no token (legacy), button is disabled with "Final quote not ready yet".

Strictly customer-safe data only — no supplier name, SKU, cost, margin, or admin notes. `get-quote-by-token` already strips these; verify no new fields leak.

## What the admin sees

- In `/admin/quote-requests` (and the per-quote card on `AdminQuotes`): a new badge **"Customer proceeded — ready for CS"** when `quotes.customer_intent_proceeded_at` is set, plus the existing "Generate Contract Summary" button highlighted.
- Internal email to `notifications@occta.co.uk` via existing `admin-notify` edge function: "Customer accepted final quote {quote_number} — generate Contract Summary".
- No automatic CS generation, no automatic payment request.

## Technical changes

### Database (one migration)

- `quotes`: add nullable `customer_intent_proceeded_at timestamptz`, `customer_intent_ip text`, `customer_intent_ua text`.
- New SECURITY DEFINER RPC `customer_proceed_with_quote(_token text)` (search_path=public):
  - Look up quote by `share_token = _token` (same column `get-quote-by-token` uses).
  - Validate: status in `('approved','sent','viewed')`, `expires_at > now()`, `customer_intent_proceeded_at IS NULL`.
  - Set `customer_intent_proceeded_at = now()`, record IP/UA from params.
  - Insert `quote_events` row `type='customer_intent_proceed'`.
  - Insert `activity_log` via existing `log_event(...)` with source_module='quotes'.
  - Return `{ ok: true }` or `{ ok: false, reason }`. No side effects beyond logging.
- Grants: `GRANT EXECUTE ON FUNCTION public.customer_proceed_with_quote(text) TO anon, authenticated;`

### Edge functions

- **New** `supabase/functions/send-final-quote-email/index.ts` — invoked by admin "Send final quote" button (replaces ad-hoc current path if needed). Inputs: `quote_id`. Builds token URL, enqueues branded template via `send-transactional-email`. Logs `quote_events` `email_sent`.
- **Update** `get-quote-by-token`: include `customer_intent_proceeded_at`, `customer_name`, `service_postcode` (already customer-safe), `digital_voice_addon` flag if present in quote.final_snapshot. Continue stripping supplier_* fields.
- **New** `supabase/functions/customer-proceed-with-quote/index.ts` — thin wrapper that calls the RPC with `req.headers` IP/UA, returns the RPC result, CORS headers, no auth required (token is the auth). After success, fires `admin-notify` with template `"customer_proceeded_quote"`.

### Email template

- Add `supabase/functions/_shared/transactional-email-templates/final-quote-ready.tsx` registered in `registry.ts`. Props: `customerName`, `quoteNumber`, `planName`, `monthlyPriceLine`, `validUntil`, `quoteUrl`. Brutalist styling consistent with existing OCCTA templates. Subject: `Your OCCTA quote {quoteNumber} is ready`. Single primary CTA → `quoteUrl`. Plain copy explains: no payment yet, Contract Summary will follow.
- Add `customer-proceeded-quote` internal admin alert template (or reuse existing admin-notify HTML if already template-driven).

### Frontend

- `src/pages/quote/QuoteView.tsx`:
  - Add customer name, postcode, validity, Digital Voice warning block (when flag true).
  - Add `<ProceedButton />` component; on click calls `supabase.functions.invoke('customer-proceed-with-quote', { body: { token } })`, then sets local "proceeded" state. Disabled while in-flight; shows toast on error.
  - Hide button when `quote.customer_intent_proceeded_at` is set; show "Thanks — Contract Summary coming next" block instead.
- `src/components/dashboard/tabs/QuotesTab.tsx`:
  - Extend `get_customer_quotes` SECURITY DEFINER RPC to also return `share_token` (already public via token URL — safe) and `customer_intent_proceeded_at`.
  - Render "View final quote" button (opens `/quote/{share_token}` in new tab) when token + status allow. Disabled with tooltip otherwise.
  - Add "Proceeding" badge when intent set.
- `src/pages/admin/QuoteRequests.tsx` / `src/pages/admin/Quotes.tsx`:
  - Show "Customer proceeded" badge + timestamp when `customer_intent_proceeded_at` set.
  - Existing "Send final quote" button wired to new `send-final-quote-email` function.

### Security / RLS

- No new client-side reads of `quotes`. All customer access still through `get_customer_quotes` RPC and tokenised `get-quote-by-token`.
- `customer_proceed_with_quote` RPC is the only write path from customer; validates token + status + expiry. No body trust.
- Email template inputs HTML-escaped (existing `escapeHtml` helper).
- New columns are nullable, no existing RLS policy needs changes.

## Out of scope for Stage 1

Contract Summary email/PDF, Documents hub, payment receipts, admin Customer 360, admin sidebar reorg — those are Stages 2–5.

## Verification / report after build

- Files changed list.
- Migration applied (column + RPC + grants).
- Manual test against quote `QT-2606-a294fe6a` (or a fresh approved quote): email enqueued, token URL opens branded page, Proceed sets timestamp, dashboard reflects state, admin badge appears.
- Confirm no payment_request / contract_summary / service / invoice / dd_mandate rows created during the flow.
- TS build clean.
- Confirm supplier fields absent from `get-quote-by-token` response payload.
