-- READ-ONLY. Lists first invoices whose pro-rata used the wrong month length.
--
-- Until 20261020120000_first_invoice_prorata_current_cycle, confirm_service_live_tx
-- divided the first period by the length of the billing cycle AFTER the live
-- date instead of the cycle the live date falls in. Examples (anchor day 1):
--   live 15 Jan -> charged 17/28 of a month, correct 17/31 (overcharge)
--   live  1 Apr -> charged 30/31 of a month, correct full month (undercharge)
--
-- Shows the base service line only. Add-on lines are covered separately by
-- addon-double-billing-affected-invoices.sql.
--
-- Only SELECTs; changes nothing. Run in the Supabase SQL editor.

WITH first_inv AS (
  SELECT i.id, i.invoice_number, i.invoice_type, i.status, i.issue_date, i.user_id,
         i.billing_period_start AS live_date,
         i.billing_period_end   AS period_end,
         (i.pro_rata->>'monthly_minor')::int     AS monthly_minor,
         (i.pro_rata->>'amount_minor')::int      AS charged_service_minor,
         (i.pro_rata->>'billable_days')::int     AS old_billable_days,
         (i.pro_rata->>'full_cycle_days')::int   AS old_full_cycle_days,
         s.billing_anchor_day                    AS anchor
  FROM public.invoices i
  JOIN public.services s ON s.id = i.service_id
  WHERE i.invoice_type IN ('first_pro_rata', 'monthly')
    AND i.pro_rata IS NOT NULL
    AND COALESCE(i.pro_rata->>'calc_method', '') IN ('anchor_v1', 'anchor_v2')
    AND i.status <> 'cancelled'
),
cycle AS (
  SELECT f.*,
         make_date(
           EXTRACT(YEAR FROM (date_trunc('month', f.period_end) - interval '1 month'))::int,
           EXTRACT(MONTH FROM (date_trunc('month', f.period_end) - interval '1 month'))::int,
           LEAST(LEAST(GREATEST(f.anchor, 1), 31),
                 EXTRACT(DAY FROM (date_trunc('month', f.period_end) - interval '1 day'))::int)
         ) AS cycle_start
  FROM first_inv f
),
fixed AS (
  SELECT c.*,
         (c.period_end - c.cycle_start)                                   AS full_cycle_days,
         LEAST(c.period_end - c.live_date, c.period_end - c.cycle_start)  AS billable_days
  FROM cycle c
)
SELECT f.invoice_number,
       f.status,
       f.issue_date,
       p.account_number,
       f.live_date,
       f.period_end - 1                                          AS period_end_inclusive,
       f.old_billable_days || '/' || f.old_full_cycle_days       AS charged_fraction,
       f.billable_days || '/' || f.full_cycle_days               AS correct_fraction,
       f.charged_service_minor / 100.0                           AS charged_service,
       CASE WHEN f.billable_days >= f.full_cycle_days THEN f.monthly_minor
            ELSE round(f.monthly_minor::numeric * f.billable_days / f.full_cycle_days)::int
       END / 100.0                                               AS correct_service,
       (f.charged_service_minor -
        CASE WHEN f.billable_days >= f.full_cycle_days THEN f.monthly_minor
             ELSE round(f.monthly_minor::numeric * f.billable_days / f.full_cycle_days)::int
        END) / 100.0                                             AS overcharge_positive_undercharge_negative,
       f.id AS invoice_id,
       f.user_id
FROM fixed f
LEFT JOIN public.profiles p ON p.id = f.user_id
WHERE f.old_full_cycle_days IS DISTINCT FROM f.full_cycle_days
   OR f.old_billable_days IS DISTINCT FROM f.billable_days
ORDER BY f.issue_date, f.invoice_number;
