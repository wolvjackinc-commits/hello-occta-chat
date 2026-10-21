-- READ-ONLY. Lists invoices that charged monthly add-ons twice.
--
-- Between commit d6815d1d ("Fix billing for accepted Contract Summary add-ons",
-- 3 Sep 2026) and the fix on claude/fix-addon-double-billing, process-first-billing
-- and process-recurring-billing billed the full Contract Summary monthly price
-- (which already includes Priority support / Static IP / Digital Voice / Paper
-- billing) AND a separate line for each add-on. Every separate add-on line on
-- those invoices is therefore pure overcharge.
--
-- Only SELECTs; changes nothing. Run in the Supabase SQL editor.

WITH inv AS (
  SELECT i.id, i.invoice_number, i.invoice_type, i.status, i.issue_date, i.created_at,
         i.billing_period_start, i.billing_period_end, i.total, i.user_id,
         i.service_id, i.order_id,
         COALESCE(s.contract_summary_id, o.contract_summary_id) AS cs_id
  FROM public.invoices i
  LEFT JOIN public.services s ON s.id = i.service_id
  LEFT JOIN public.orders o ON o.id = i.order_id
  WHERE i.invoice_type IN ('monthly', 'first_pro_rata')   -- the two billing workers
    AND i.status <> 'cancelled'
),
addon_labels AS (
  SELECT DISTINCT inv.id AS invoice_id,
         COALESCE(a->>'label', a->>'id', 'Monthly add-on') AS label
  FROM inv
  JOIN public.contract_summaries cs ON cs.id = inv.cs_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(cs.selected_addons) = 'array' THEN cs.selected_addons ELSE '[]'::jsonb END
  ) AS a
  WHERE jsonb_typeof(a) = 'object'
    AND COALESCE(a->>'monthly', '') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (a->>'monthly')::numeric > 0
),
addon_lines AS (
  -- Workers write line descriptions as "<label> (<period label>)".
  SELECT DISTINCT l.id, l.invoice_id, l.description, l.line_total
  FROM public.invoice_lines l
  JOIN addon_labels al ON al.invoice_id = l.invoice_id
   AND (l.description = al.label
        OR left(l.description, length(al.label) + 2) = al.label || ' (')
)
SELECT inv.invoice_number,
       inv.invoice_type,
       inv.status,                                   -- e.g. sent / awaiting_dd_collection / paid
       inv.issue_date,
       inv.billing_period_start,
       inv.billing_period_end,
       p.account_number,
       inv.total                               AS invoiced_total,
       sum(al.line_total)                      AS overcharge_incl_vat,
       inv.total - sum(al.line_total)          AS correct_total,
       string_agg(al.description, '; ' ORDER BY al.description) AS duplicated_addon_lines,
       inv.id                                  AS invoice_id,
       inv.user_id
FROM inv
JOIN addon_lines al ON al.invoice_id = inv.id
LEFT JOIN public.profiles p ON p.id = inv.user_id
GROUP BY inv.id, inv.invoice_number, inv.invoice_type, inv.status, inv.issue_date,
         inv.billing_period_start, inv.billing_period_end, inv.total, inv.user_id,
         p.account_number
ORDER BY inv.issue_date, inv.invoice_number;
