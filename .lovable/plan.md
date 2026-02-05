
Goal: Fix invoice payment flow failing at Worldpay 3DS with “The current origin is not supported… targetOrigin…” by ensuring the invoice-token payment path (/pay → backend function “payment-request”) passes and uses an explicit, stable browser origin for Worldpay/Cardinal postMessage checks (same fix pattern already applied to the direct invoice checkout flow in “worldpay-payment”).

What I believe is happening (root cause)
- You have two different Worldpay session-creation flows:
  1) Logged-in invoice payment flow (dashboard “Pay invoice” /pay-invoice) that ultimately uses `worldpay-payment` edge function (already updated to include `shopperBrowserPaymentOrigin`).
  2) Tokenized/public-style flow (`/pay?token=...`) that uses the `payment-request` edge function action `create-worldpay-session`.
- The error you pasted is consistent with Cardinal/3DS failing its origin validation when the merchant origin is missing or mismatched.
- `payment-request` currently:
  - Does not accept `paymentOrigin` from the frontend
  - Does not send `shopperBrowserPaymentOrigin` to Worldpay when creating the HPP session
- `src/pages/Pay.tsx` currently:
  - Builds `returnUrl` using `getPaymentReturnOrigin()` (good)
  - But does not pass `paymentOrigin` to the backend (missing)

Scope of changes (no database changes required)
A) Frontend: `src/pages/Pay.tsx`
- Update `handleProceedToPayment` to:
  - Compute `paymentOrigin = getPaymentReturnOrigin()`
  - Compute `returnUrl = \`\${paymentOrigin}/pay?requestId=\${paymentData.id}\``
  - Pass BOTH `returnUrl` and `paymentOrigin` to `supabase.functions.invoke("payment-request", { body: ... })`
- Add minimal defensive logging (console) for:
  - `paymentOrigin`
  - `returnUrl`
  - This helps confirm the browser is using the published domain when the payment starts.

B) Backend function: `supabase/functions/payment-request/index.ts` (action: `create-worldpay-session`)
- Extend payload parsing to accept `paymentOrigin`:
  - From: `const { token, returnUrl } = data;`
  - To: `const { token, returnUrl, paymentOrigin } = data;`
- Derive a stable origin string:
  - `shopperBrowserPaymentOrigin = paymentOrigin || new URL(returnUrl).origin` (try/catch)
- Include `shopperBrowserPaymentOrigin` in the JSON body sent to Worldpay `/payment_pages`, mirroring the working pattern in `supabase/functions/worldpay-payment/index.ts`:
  - Add:
    - `...(shopperBrowserPaymentOrigin ? { shopperBrowserPaymentOrigin } : {})`
- Add targeted logs (server-side) around session creation:
  - `returnUrl`, `paymentOrigin`, `shopperBrowserPaymentOrigin`
  - Worldpay response status and any returned errors (already logs some in other function; we’ll match that level here)

C) Validation / UX safety checks (small but important)
- Ensure `returnUrl` already includes `requestId=...` before appending `&status=...` (it does today). Keep as-is.
- Ensure the `/pay` page’s “open on stable origin” guard remains intact (it already prevents starting from preview origins). This fix is still needed because even on the published domain Worldpay wants the explicit origin value for 3DS postMessage.

How we will confirm it’s fixed (end-to-end)
1) From the customer dashboard, click “Pay” on an invoice (the flow that creates `/pay?token=...`).
2) Confirm you are redirected/opened on the published domain (not the preview domain).
3) Complete card entry + 3DS step-up.
4) Verify it returns to `/pay?requestId=...&status=success` and shows the success UI.
5) Also verify `payment_attempts` transitions from `pending` to `success` (and invoice becomes `paid`) as expected.

Extra diagnostics if it still fails after this
- If the error persists, we will capture:
  - Exact URL/origin where the 3DS error occurs (published domain vs preview domain)
  - The Worldpay session response fields (in function logs) to confirm the origin field is being accepted
- Then we can adjust additional Worldpay HPP parameters if needed, but the missing `shopperBrowserPaymentOrigin` in the `payment-request` flow is the first concrete, code-level inconsistency that must be corrected.

Files to change (implementation phase)
- `src/pages/Pay.tsx` (pass `paymentOrigin`)
- `supabase/functions/payment-request/index.ts` (include `shopperBrowserPaymentOrigin` in the HPP session creation request)
