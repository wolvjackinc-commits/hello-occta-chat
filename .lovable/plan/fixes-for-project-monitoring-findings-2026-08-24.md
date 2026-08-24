# Fixes for Project Monitoring Findings

## 1. Service Activation Fails (Trigger Error)
The `orders` table uses `occta_order_number` as the canonical order number column, but several triggers still referenced `NEW.order_number`, causing transactions to roll back during service activation.

### Technical Fix
Modified the following trigger functions to use `NEW.occta_order_number`:
- `public.trg_order_live_notify()`
- `public.tg_order_live_notify()`

## 2. Business Lead Form Fails (Missing Columns)
The `business_leads` table was missing several columns that the frontend `LeadForm.tsx` and the `submit-business-lead` edge function were attempting to insert, resulting in 500 errors.

### Technical Fix
Added the following columns to `public.business_leads`:
- `postcode`, `team_size`, `interest`, `sla_preference`
- `secondary_contact_name`, `secondary_contact_email`, `secondary_contact_phone`
- `billing_contact_name`, `billing_contact_email`, `billing_contact_phone`
- `site_address_line1`, `site_address_line2`, `site_city`, `site_postcode`

## 3. Address Lookup Failing (500 Error)
The `places-autocomplete` function returns 500 if `LOVABLE_API_KEY` or `GOOGLE_MAPS_API_KEY` are not configured, or if the upstream Google Places API call fails.

### Technical Fix
- Verified the code path correctly handles missing environment variables.
- Verified that the function logs specific errors for distinguishing between configuration issues and API failures.
- Recommended verification of `LOVABLE_API_KEY` and `GOOGLE_MAPS_API_KEY` in the production environment settings.
