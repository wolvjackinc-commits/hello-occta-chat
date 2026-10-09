/**
 * Next Direct Debit collection amount from the accepted contract's monthly price.
 *
 * billing_settings has no billing interval. billing_mode is anniversary or
 * fixed_day (which day to invoice). payment_terms_days is how many days the
 * invoice is due, not how many months are collected. contract_length is the
 * minimum term (for example "Flex 30 — 30-day rolling"), not the collection
 * cadence. None of those multiply the monthly price.
 *
 * contract_summaries.payment_schedule is the billing-cycle text. The amount
 * is one month unless that text explicitly says quarterly.
 */
export function nextCollectionAmount(input: {
  monthlyPriceInclVat: number | null | undefined;
  paymentSchedule?: string | null;
  contractLength?: string | null;
  billingMode?: string | null;
  paymentTermsDays?: number | null;
}): number | null {
  const monthly = Number(input.monthlyPriceInclVat ?? 0);
  if (!Number.isFinite(monthly) || monthly <= 0) return null;
  const months = /\bquarterly\b/i.test(input.paymentSchedule ?? "") ? 3 : 1;
  return Number((monthly * months).toFixed(2));
}
