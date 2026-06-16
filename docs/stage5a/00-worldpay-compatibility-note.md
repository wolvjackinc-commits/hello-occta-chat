# Stage 5A §0 — Worldpay Compatibility Note

Status: **Discovery only.** No code, migrations or secrets changed.
Scope: confirm the exact API surface OCCTA's live Worldpay integration uses today, so Stage 5A token-setup / MIT work can be designed against the real contract instead of generic Access Worldpay examples.

Sources inspected:
- `supabase/functions/worldpay-payment/index.ts` (lines 1–277, complete file)
- `supabase/functions/worldpay-webhook/index.ts` (lines 1–520, complete file)
- Project memories: `payments/worldpay-hpp-integration`, `payments/worldpay-live-configuration`, `payments/worldpay-hpp-api-constraints`, `payments/worldpay-3ds-browser-constraints`, `payments/webhook-reference-fail-safe`, `payments/token-hashing-standard`.

No live calls were made to Worldpay during discovery.

---

## 1. Product currently in use

OCCTA is on **Access Worldpay — Hosted Payment Pages (SMB eCommerce)**.

Evidence:
- `worldpay-payment/index.ts` posts to `${baseUrl}/payment_pages` with media type `application/vnd.worldpay.payment_pages-v1.hal+json`, which is the Access Worldpay HPP v1 contract.
- `worldpay-webhook/index.ts` validates the **SMB eCommerce event envelope** (`eventId`, `eventTimestamp`, `eventDetails.classification='payment'`, `eventDetails.type`, `eventDetails.transactionReference`) and defaults `WORLDPAY_GATEWAY_TYPE` to `smb_ecommerce`.
- An "Access Enterprise" branch exists for HMAC-signed webhooks but is gated behind `WORLDPAY_GATEWAY_TYPE=access_enterprise` and is not the live path.

## 2. Endpoints, hosts, versioning

| Concern | Live value |
|---|---|
| Live base URL | `https://access.worldpay.com` |
| Test base URL | `https://try.access.worldpay.com` |
| Mode toggle | env `WORLDPAY_LIVE_MODE=true` selects live |
| HPP create endpoint | `POST /payment_pages` |
| Accept / Content-Type | `application/vnd.worldpay.payment_pages-v1.hal+json` |
| Auth | HTTP Basic — `Authorization: Basic base64(WORLDPAY_API_USERNAME:WORLDPAY_API_PASSWORD)` |
| Merchant identifier | `merchant.entity = WORLDPAY_ENTITY_ID` |

The HPP response is consumed at two locations:
- `result.url` (string), or
- `result._links.checkout.href` (HAL link).

## 3. Current HPP request body (verbatim shape from production code)

```jsonc
{
  "transactionReference": "INV-<invoiceId>-<epochMs>",
  "merchant": { "entity": "<WORLDPAY_ENTITY_ID>" },
  "narrative": { "line1": "Invoice <number>" },
  "value": { "currency": "GBP", "amount": <minor units> },
  "resultURLs": {
    "successURL": "...",
    "failureURL": "...",
    "cancelURL": "...",
    "errorURL": "...",
    "pendingURL": "...",
    "expiryURL": "..."
  },
  "riskData": { "account": { "email": "<customer email>" } } // optional
}
```

**Critically absent from the live request:**
- `tokenCreation` / `tokenCreation.type`
- `customerAgreement` / `customerAgreement.type`
- `storedCardUsage` (`first` / `subsequent`)
- `schemeTransactionReference`
- `agreement` (recurring/subscription) blocks
- Any `paymentInstrument` or saved-card reference

The HPP request also omits `shopperBrowserPaymentOrigin` in practice (per memory `payments/worldpay-hpp-api-constraints`: HPP rejects it on this account).

## 4. Webhook contract observed in live code

SMB eCommerce event envelope:

```jsonc
{
  "eventId": "<uuid>",
  "eventTimestamp": "<ISO8601>",
  "eventDetails": {
    "classification": "payment",
    "type": "sentForAuthorization | authorized | sentForSettlement | refused | cancelled | expired | error",
    "transactionReference": "<the reference we sent>",
    "amount": { "value": <minor units>, "currencyCode": "GBP" } // present on settlement
  }
}
```

- **Settlement event** that flips PRs to paid: `sentForSettlement` (the only event allowed to mark paid). Requires `amount.value` + `amount.currencyCode`.
- **No token-related event types** are received or handled today — there is zero evidence in production that this account currently emits token-creation events on the SMB eCommerce webhook.
- **Webhook auth (SMB path):** no HMAC signature is required or validated. Trust is established by exact `transactionReference` match plus amount/currency match on settlement (per memory `payments/worldpay-webhook-security`, fail-closed is implemented on the Access Enterprise path; SMB path relies on reference + shape validation).
- **Webhook auth (Access Enterprise path, available but not the live default):** HMAC-SHA256 over raw body with secret `WORLDPAY_WEBHOOK_SECRET`, supplied in header `x-wp-signature`.

## 5. Stored credentials, tokens, recurring — current state

| Capability | In code today? | Notes |
|---|---|---|
| Token creation requested on HPP | **No** | No `tokenCreation` block in the live request body |
| Token captured from webhook | **No** | No handler reads `paymentInstrument.tokenHref`, no `payment_tokens` table |
| Token storage (encrypted) | **No** | Only PR/invoice token hashes per memory `payments/token-hashing-standard` |
| Scheme reference captured | **No** | Not requested, not read |
| CIT/MIT distinction | **No** | All charges are one-off CIT via HPP |
| Subsequent MIT charge endpoint used | **None** | No MIT calls exist |
| Zero-value verification | **Unknown** | Not exercised; not confirmed on this product |
| Recurring / subscription product | **Unknown** | Worldpay say it's enabled on the entity; the existing HPP integration does not exercise it and the field shape it accepts on this specific product is unverified |
| Separate credentials for recurring | **Unknown** | OCCTA must confirm with Worldpay whether the same `WORLDPAY_API_USERNAME` / entity can run subsequent MIT, or whether a separate Direct API credential is issued |

## 6. Risks if we assume Access Worldpay generic examples

Public Access Worldpay documentation shows:
- HPP `tokenCreation.type='worldpay'` + `customerAgreement.type='subscription'` returning `paymentInstrument.tokenHref` on the verified event.
- Subsequent MIT via `POST /api/payments` with `instruction.paymentInstrument.type='token'`, `instruction.tokenHref`, `agreement.type='subscription'`, `storedCardUsage='subsequent'`, `schemeTransactionReference`.

**None of these are confirmed on OCCTA's actual entity / product.** Memory `payments/worldpay-hpp-api-constraints` already documents one case where the public example field (`shopperBrowserPaymentOrigin`) is rejected by this account. Building 5A on assumed fields risks a repeat of that failure mode at the worst possible time (first stored-credential setup).

## 7. Open items OCCTA must confirm with Worldpay before §4 code is written

Send these exact questions to Worldpay support / account manager and capture written answers:

1. On entity `<WORLDPAY_ENTITY_ID>`, on the **HPP `/payment_pages` (v1.hal+json) product**, are `tokenCreation`, `customerAgreement`, and `storedCardUsage` accepted in the request body? If not, which Worldpay product on this entity must be used to capture a reusable token at the first cardholder interaction?
2. Does this product support a **zero-value account verification** (auth-only £0.00 / £0.01) on the first CIT, or must the first stored-credential transaction be a real-value payment?
3. On the **SMB eCommerce webhook** for this entity, what is the exact `eventDetails.type` and payload location for:
   - token creation success,
   - token creation failure,
   - scheme transaction reference returned for stored-credential use?
4. For subsequent **Merchant Initiated Transactions** on this entity:
   - Confirm the exact endpoint (`/api/payments` vs other) and required `Accept`/`Content-Type` media type.
   - Confirm the exact request shape for `agreement`, `storedCardUsage='subsequent'`, `paymentInstrument`/`tokenHref`, and `schemeTransactionReference`.
   - Confirm whether MIT requires the same Basic-auth credentials as HPP or a separate API username/password.
5. Confirm webhook events for MIT settlement, failure, and refund use the same SMB envelope (`sentForSettlement` etc.) as one-off HPP today, or a different event set.
6. Confirm whether token revocation is supported via API (so cancellation in §11 of the main plan can revoke provider-side) and the exact endpoint.

## 8. Concrete impact on the Stage 5A build plan

Until §7 is answered in writing:

- **Do not** add `tokenCreation` / `customerAgreement` to any production HPP request.
- **Do not** call `/api/payments` for MIT.
- **Do not** add a new webhook event branch matching assumed Access docs.
- **Do** keep `WORLDPAY_RECURRING_ENABLED=false` in production (per approved plan §1 of the addendum).
- **Do** proceed with the parts of the plan that are not Worldpay-shape-dependent:
  - migration scaffolding for `order_journeys`, `contract_billing_snapshots`, `dd_intake_requests`, `billing_outbox`, `recurring_payment_authorisations`, `services` ALTERs (service-role only on ciphertext);
  - unified `/order/:token` journey UI for approve → CS accept → start date → **manual-invoice payment method** → submit → master email + Order Pack;
  - DD intake schema + encryption plumbing **behind `DD_INTAKE_ENABLED=false`** until OCCTA supplies approved DDI/Guarantee wording and SUN/provider details.
- The card-setup function (`worldpay-card-setup`), MIT charge function (`worldpay-mit-charge`) and the new webhook event branches will be implemented **after** Worldpay's written answers are pasted into this note and reviewed.

## 9. Decision required from you

Please confirm:

- (a) you accept this compatibility note as the accurate picture of the live integration, and
- (b) you authorise Lovable to proceed with the non-Worldpay-shape-dependent parts of Stage 5A listed in §8 above (DB migration with sensitive-table grants restricted to `service_role`, `/order/:token` UI through the manual-invoice path, DD plumbing behind a disabled flag), while we wait for Worldpay's written answers to §7 before any token-setup or MIT code is written.

Once (b) is approved, the immediate next deliverable will be the single Stage 5A migration for review.
