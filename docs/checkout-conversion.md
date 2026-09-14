# Mobile checkout conversion

This change keeps the existing Journey 2 step order and server validation. The
address screen reveals contact details after a usable address is selected or
entered. Name, email and the existing Terms/Privacy acknowledgement remain
required before proceeding because the current session service requires early
contact capture. It does not promise address-specific availability: the existing
supplier validation and agreement wording remain in place.

Plan cards compare the selected term, explicitly label the term and show setup
charges and the separate router choice. Savings use catalogue prices rounded to
pennies and explain the 24-month comparison assumption. Router and extras previews
replace their previous contributions rather than adding twice. The mobile total
and final review use the server's saved price snapshot, including its authoritative
one-off total, with a line-item fallback for older snapshots. Cashback stays separate.

Private-link recovery reuses the existing session expiry. It copies the current
order path only on request, without query parameters, and explains that only
completed steps are saved. It neither extends expiry nor sends new reminder emails.
No bank details or other new personal-data drafts are stored in the browser.

## Funnel measurement

New conversion events use the existing `track_checkout_event` RPC and its existing
order-token-to-session association. They require analytics consent and exclude
test sessions. Operational tracking is unchanged. Query `checkout_tracking_events`
for `details->>'surface' = 'journey2_conversion'`, grouped by `stage`,
`details->>'action'`, `details->>'device_type'` and `details->>'source_type'`.
Use distinct `journey_session_id` for conversion counts rather than event counts.

- `view` / `resumed`: a loaded internal step, including contract and review;
- `saved`: a successful server response for a selection step;
- `validation_error`: native form validation blocked progression;
- `save_error`: a rejected or failed step request;
- `submitted`: successful final Journey 2 submission.

Source category comes from the existing first-touch session attribution. Device
category is viewport-based: mobile below 768px, tablet below 1024px, else desktop.
Missing/unrecognised attribution is `unknown`. Custom acknowledgement errors are
still shown to the customer and are not inferred as native validation errors.
The existing server funnel is the source for all-session completion and abandonment
counts; consented browser telemetry is a subset and must not be presented as all traffic.
Do not copy form values, arbitrary URL parameters or order links into event metadata.

## Validation and release

Regression tests cover progressive address capture, legal gating, term comparison,
router eligibility/price previews, Digital Voice consent, authoritative totals,
recovery fallback, analytics consent/privacy, final submission consent, payment
gating and idempotent retry. Existing pricing, Ofcom, isolation and duplicate-order
suites remain enabled. Run the existing CI, typecheck and production build before
merging. Database-backed CI must pass as well; a successful mocked unit suite is
not a substitute for those checks. No Lovable AI or build-credit operation is needed.
