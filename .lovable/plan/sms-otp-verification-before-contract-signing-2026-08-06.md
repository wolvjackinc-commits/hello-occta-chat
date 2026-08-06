# SMS OTP verification before contract signing

Add a mobile verification step immediately before the electronic signature, using The SMS Works OTP service. Both existing journeys keep working exactly as they do today.

## What the customer sees

At the existing signing stage, after the declarations and before the signature button:

```text
Verify your mobile number
We will text a six-digit code to ******3456.
[ Send verification code ]
   -> [ 000000 ]  [ Verify code ]   Resend code (60s)
   -> Mobile number verified
```

The signature button stays disabled until the number is verified. The number cannot be edited here — a "Change number" link returns the customer to the existing customer-details step and clears any earlier verification.

Customer messages stay plain: incorrect code, expired code, please wait before requesting another code, we could not send the code at the moment, mobile number verified. No provider or technical detail is ever shown.

## Both journeys, one component

Journey 1 and Journey 2.0 already share the same final signing screen and the same server-side acceptance function, so the verification block is added once and appears correctly in both. Nothing about routing, pricing, plans, add-ons, details, start dates, Direct Debit, contract generation, feature switches or order submission changes. The journey type (journey_1 / journey_2) is read server-side from the order record, never trusted from the browser.

## Outage handling

Verification is required and enforced on the server. An admin-only setting allows a temporary bypass during a provider outage; every bypass is recorded in the audit trail. Default is on.

## Technical detail

**Database migration** — new table `sms_otp_challenges` with exactly the agreed fields (challenge_id, journey_type, session_or_order_reference, phone_masked, phone_hash, sms_message_id, expires_at, verified_at, send_attempts, verify_attempts, timestamps), plus `consumed_at` so a verification cannot be reused. Row Level Security on, with no policies for anonymous or signed-in users (service-role access only, matching the existing secure server pattern). The passcode, the full mobile number and any provider credential are never stored; the number is kept only as a mask plus a salted SHA-256 hash. The migration also adds one boolean platform setting for the admin bypass.

**Edge function `send-contract-otp`** — validates the journey token, loads the mobile from `quote_requests.phone` for that order (never from the browser), refuses if already signed, normalises to `44…` digits-only and validates it is a UK mobile, mints a random `challenge_id`, enforces limits (max 3 sends per order per hour, 60 seconds between sends, one active challenge), calls `POST /v1/otp/send` with the agreed body and the `{{passcode}}` template, stores the returned `messageid`, and returns only `{ ok, challenge_id, phone_masked, expires_in }`. It also supports a read-only `status` action so the screen can show the masked number and any existing verification after a page refresh.

**Edge function `verify-contract-otp`** — calls `POST /v1/otp/verify` and accepts the verification only when the provider status is VERIFIED, the returned messageid and metadata challenge_id match the stored challenge, journey type and order reference match, the order's mobile is unchanged, the challenge is unexpired, the contract is unsigned, and verify attempts are under 5. On success it stamps `verified_at` server-side and writes the audit entry (time, journey, masked number, message reference). The passcode is never stored or logged.

**Enforcement** — `accept-contract-summary` (used by both journeys) gains an independent server-side check for a valid, unconsumed, verified challenge for that same order and mobile. Signing is refused otherwise, so calling the function directly cannot bypass verification. On success the challenge is marked consumed and its evidence is linked to the existing acceptance record. Supplier submission logic is untouched.

**Frontend** — one new component `src/components/contract/ContractSmsVerification.tsx` in the existing brutalist style (`autocomplete="one-time-code"`, `inputmode="numeric"`, accessible labels, live countdown, buttons disabled while in flight). It is mounted in the shared `AgreementStep`, where the current free-text mobile field becomes a read-only masked display sourced from the order.

**Secret** — `SMS_WORKS_JWT` is not configured yet. Once the functions exist I will open the secure secret form for it; it is read only via `Deno.env.get("SMS_WORKS_JWT")` inside the two edge functions and never appears in frontend code, VITE variables, browser storage, the database, logs or responses. The SMS Works API key and secret are not requested or stored.

## Testing

Automated tests mock only the provider HTTP response: incorrect code, expired challenge, resend rules, send limit, verify-attempt limit, invalid UK mobile, provider unavailable, insufficient credit, missing JWT, number changed after verification, direct bypass attempt, double-click and refresh. Then, once the secret is in place and you give me a test mobile, 2–4 real sends to prove the live path on each journey. Journeys run in the existing isolated test mode so no wholesale or supplier order is created. Nothing is published or deployed — I stop after testing for your review.