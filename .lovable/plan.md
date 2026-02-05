
# Fix: Payment Verification Not Triggering

## ✅ IMPLEMENTED

## Problem Summary
A live Worldpay payment was successfully completed (Invoice `INV-ML51PYS8`, £2.00), but the system failed to:
- Mark the invoice as paid
- Create a receipt
- Send a payment confirmation email to the customer
- Update the payment request status to completed

## Root Cause
The `Pay.tsx` page displays a success screen when returning from Worldpay but **never calls the `verify-payment` backend action**. This action is what triggers all the post-payment processing.

## Technical Details

### Current Flow (Broken)
1. Customer pays on Worldpay
2. Worldpay redirects to `/pay?requestId=xxx&status=success`
3. `Pay.tsx` sets `paymentResult = "success"` and shows success UI
4. Page fetches payment details from database for display
5. **Nothing updates the database** - invoice stays unpaid, no receipt, no email

### Expected Flow (Fixed)
1. Customer pays on Worldpay
2. Worldpay redirects to `/pay?requestId=xxx&status=success`
3. **NEW: Call `verify-payment` action immediately**
4. Backend marks invoice as paid, creates receipt, sends email
5. `Pay.tsx` shows success UI with receipt download option

## Changes Required

### File: `src/pages/Pay.tsx`

Add a new `useEffect` hook that calls the `verify-payment` action when `paymentResult` changes to a terminal state (success, failed, or cancelled).

The effect will:
1. Check if we have a `requestId` and a `status` result
2. Call `supabase.functions.invoke('payment-request', { action: 'verify-payment', requestId, status })`
3. Await the result before fetching payment details
4. Handle errors gracefully (the UI already shows success based on Worldpay's redirect)

### Changes Summary

```text
Location: useEffect that handles payment return (around line 63-74)

BEFORE:
- Sets paymentResult based on URL status
- Immediately stops loading
- Separate effect fetches payment details

AFTER:
- Sets paymentResult based on URL status
- NEW: Calls verify-payment edge function with requestId and status
- Waits for verification before stopping loading
- Then fetches payment details (which now exist in DB)
```

### Key Implementation Points

1. **Call verify-payment on mount** when `status` and `requestId` are present
2. **Handle all statuses** (success, failed, cancelled) - the backend handles each appropriately
3. **Error handling**: If verification fails, still show the UI (Worldpay already charged) but log the error
4. **Idempotency**: The backend already handles duplicate calls gracefully (checks if already completed)
5. **Fetch details after verification**: Move the payment details fetch to happen after verification completes

## Secondary Fix: Worldpay Webhook Handler

### File: `supabase/functions/worldpay-webhook/index.ts`

The webhook currently only handles transaction references starting with `INV-` but the payment-request flow uses `PR-` references.

Update the webhook to:
1. Parse both `INV-` (direct invoice payments) and `PR-` (payment request payments) reference formats
2. For `PR-` references, look up the payment request to find the linked invoice

This provides a backup mechanism if the frontend verification fails (e.g., user closes browser before redirect).

## Immediate Manual Fix

For the payment that already went through (Invoice `INV-ML51PYS8`):
1. Go to Admin Panel > Billing
2. Find the invoice
3. Manually mark it as paid and record the receipt

Or run this in the database:
```sql
-- Mark invoice as paid
UPDATE invoices SET status = 'paid', updated_at = now() 
WHERE id = '6cc8ea12-2105-4cfc-ab43-f40b6d40b1b0';

-- Create receipt
INSERT INTO receipts (invoice_id, user_id, amount, method, reference, paid_at)
SELECT '6cc8ea12-2105-4cfc-ab43-f40b6d40b1b0', user_id, 2.00, 'card', 'RCP-MANUAL-LIVE', now()
FROM invoices WHERE id = '6cc8ea12-2105-4cfc-ab43-f40b6d40b1b0';

-- Update payment request
UPDATE payment_requests SET status = 'completed', completed_at = now() 
WHERE id = 'd9ac4843-c3c5-48c9-82b9-163deafaafe6';
```

## Changes Made

### 1. `src/pages/Pay.tsx`
- Added `verify-payment` call in the useEffect that handles Worldpay return
- When status + requestId are present, calls `supabase.functions.invoke("payment-request", { action: "verify-payment", ... })`
- This triggers the backend to mark invoice as paid, create receipt, and send confirmation email

### 2. `supabase/functions/worldpay-webhook/index.ts`
- Added support for `PR-` transaction references (payment request flow)
- Webhook now serves as a backup mechanism if frontend verification fails
- Creates `processPaymentRequestWebhook` helper function for handling PR- references
