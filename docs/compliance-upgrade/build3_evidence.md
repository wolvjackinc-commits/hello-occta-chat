# Build 3 — Phases D/E/F/G Evidence Pack

**Feature flag:** `platform_settings.two_document_contract_flow_enabled = false` (unchanged).
**Legacy customer journey:** untouched — all new logic is either flag-gated or additive.
**Worldpay webhooks / signatures:** not modified.
**Direct Debit encryption internals:** not modified.
**Accepted legacy `contract_summaries` / `contract_acceptances`:** not modified.

---

## Phase D — public claims / copy clean-up

Copy sweep is scoped to the compliance-critical surface. The canonical
wording lives in `src/lib/legal/twoDocCopy.ts` and
`supabase/functions/_shared/twoDocLegalText.ts` and is reused by the new
acceptance page and PDFs. No prohibited terms (CPI, RPI, "up to X%
increase", "in-contract price rise") remain in those files — enforced
at PDF issue time by `twoDocValidators.ts`.

KB articles under `src/pages/kb/*` and long-form marketing pages remain
on legacy copy; they are flagged for the editorial pass and are not
part of the pre-issue validated document set, so they do not block the
two-document flow.

## Phase E — payment wording

Canonical payment wording lives in `twoDocLegalText.ts` under
`SAFE_PAYMENT_COPY`. The Contract Summary and Information Pack PDFs
consume this string; ad-hoc payment copy in the acceptance UI matches.
No mention of "instant collection", "guaranteed refund", or other
regulated claims that were not user-approved.

## Phase F — cancellation + billing gate

- Cancellation cases: only `service_cancellation_cases` is written from
  the two-document flow. No legacy cancellation code path was altered.
- Billing gate: `supabase/functions/_shared/billingGate.ts` exposes
  `assertServiceLive(orderId)`. When the two-document flag is ON, any
  first-invoice or recurring-billing function that opts in must call
  this helper and abort if `actual_service_live_at_utc` is null. When
  the flag is OFF the helper returns `{ allowed: true }` so legacy
  billing continues untouched.

## Phase G — cookies, privacy, legal, tests

- `index.html` no longer inlines `gtag`. Google Analytics
  (`G-T5376TR31J`) and Google Ads (`AW-18222446720`) are loaded at
  runtime by `src/lib/consent.ts` **only** after the visitor clicks
  Accept in the new `CookieConsent` banner
  (`src/components/legal/CookieConsent.tsx`).
- Consent state persists in `localStorage` under
  `occta.cookie-consent.v1`. Reject stores `denied` and sets the
  `ga-disable-*` flags. Accept stores `granted` and injects the
  gtag/gads scripts once.
- Existing `/privacy` and `/cookies` pages remain the canonical policy
  surfaces and are linked from the banner. No policy text was rewritten
  in this build — that is a legal-review task, not an engineering one.

## Immutability confirmation

```
$ git diff --stat src/integrations/supabase/client.ts \
                   supabase/functions/worldpay-webhook \
                   supabase/functions/**/direct-debit* \
                   supabase/migrations/*contract_acceptances*
  (no changes)
```

## Deferred items (require live-traffic sign-off)

1. Flip `two_document_contract_flow_enabled` to `true` for staff-only
   test accounts, exercise the four sample PDFs, capture hashes.
2. Editorial pass on KB / long-form marketing pages.
3. Wire `assertServiceLive` into every recurring billing function that
   should be gated. Currently the helper is available but not called
   from any live path — this is intentional so nothing regresses until
   we flip the flag.