// Refer-a-friend bill credit on invoices.
//
// The database (referral_apply_credit_to_invoice) decides how much credit an
// invoice gets, writes the negative invoice_lines, the ledger movements and
// the new invoice totals in one transaction. This helper only mirrors those
// lines into the totals used for the PDF and email, so all three agree.
//
// VAT: a referral credit is a reduction in the price of OCCTA's own supply, so
// it reduces the VAT on the bill (net = round(gross / 1.2), same rounding as
// itemiseInvoice). Business credits are net amounts and their VAT falls too.
// Structural copies of billingHelpers' ComputedLine / ComputedTotals, kept here
// so this module stays free of Deno and PDF imports (it is unit-tested in Node).
export type ComputedLine = {
  description: string;
  period_label: string | null;
  net_minor: number;
  vat_minor: number;
  gross_minor: number;
  vat_rate: number;
};
export type ComputedTotals<V = string> = {
  lines: ComputedLine[];
  subtotal_net_minor: number;
  vat_total_minor: number;
  total_gross_minor: number;
  vat_mode: V;
  vat_rate: number;
};

export type ReferralCreditRow = {
  reward_id: string;
  invoice_line_id?: string | null;
  description: string;
  gross_minor: number;
  net_minor: number;
  vat_rate: number;
};

export function parseReferralCreditRows(data: unknown): ReferralCreditRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    const gross = Math.round(Number(row.gross_minor));
    const net = Math.round(Number(row.net_minor));
    if (!Number.isFinite(gross) || !Number.isFinite(net) || gross >= 0 || net > 0) throw new Error("referral_credit_row_invalid");
    return {
      reward_id: String(row.reward_id ?? ""),
      invoice_line_id: row.invoice_line_id ? String(row.invoice_line_id) : null,
      description: String(row.description ?? "Referral credit"),
      gross_minor: gross,
      net_minor: net,
      vat_rate: Number(row.vat_rate ?? 0),
    };
  });
}

/** Append credit lines to computed totals. Never lets the total go below zero. */
export function mergeReferralCredit<T extends ComputedTotals<unknown>>(totals: T, rows: ReferralCreditRow[]): T {
  if (!rows.length) return totals;
  const credit: ComputedLine[] = rows.map((r) => ({
    description: r.description,
    period_label: null,
    net_minor: r.net_minor,
    vat_minor: r.gross_minor - r.net_minor,
    gross_minor: r.gross_minor,
    vat_rate: r.vat_rate,
  }));
  const lines = [...totals.lines, ...credit];
  const subtotal = totals.subtotal_net_minor + credit.reduce((s, l) => s + l.net_minor, 0);
  const vat = totals.vat_total_minor + credit.reduce((s, l) => s + l.vat_minor, 0);
  if (subtotal + vat < 0) throw new Error("referral_credit_exceeds_invoice");
  return { ...totals, lines, subtotal_net_minor: subtotal, vat_total_minor: vat, total_gross_minor: subtotal + vat };
}
