# Fix blank city broadband pages

## Changes
- Update only `src/pages/LocationBroadband.tsx` to wrap its unchanged page content in `AvailabilityProvider`.
- Add `src/pages/LocationBroadband.test.tsx` with focused London, Manchester, and invalid-city route tests using the requested mocks.

## Validation
- Run only `npx vitest run src/pages/LocationBroadband.test.tsx`.
- If failures occur, adjust test mocks only; do not alter product behavior.

## Constraints
- Do not move the provider to `App.tsx`.
- Do not edit any other existing file, page content, links, styles, pricing, SEO, or business logic.
