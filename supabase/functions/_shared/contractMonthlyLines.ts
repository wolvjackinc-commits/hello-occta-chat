// Monthly service lines for an invoice, built from the accepted Contract
// Summary. Pure (no jsPDF import) so it can be unit tested.
//
// The Contract Summary's monthly price already includes the monthly add-ons:
// every quote path stores monthly_gross = resolver monthly_total_incl_vat
// (broadband + router + add-ons) and generate-contract-summary copies it to
// monthly_price_incl_vat alongside selected_addons. So add-ons are itemised
// out of the contracted price, never charged on top of it. The invoice total
// for the period always equals the (pro-rated) contracted price.

export interface MonthlyLine {
  description: string;
  amount_minor: number;
  period_label?: string | null;
}

export interface ContractAddonCharge {
  id: string | null;
  label: string;
  monthly_minor: number;
  amount_minor: number;
}

export function buildContractMonthlyLines(args: {
  serviceDescription: string;
  /** Contract monthly price in minor units, in the invoice's VAT basis. */
  contractMonthlyMinor: number;
  /** contract_summaries.selected_addons: [{ id, label, monthly }], monthly in £ incl. VAT. */
  addons: unknown;
  periodLabel: string;
  vatMode: "inclusive" | "exclusive";
  vatRate: number;
  /** Pro-rata rule for the period; identity for a full month. */
  prorate?: (monthlyMinor: number) => number;
}): { lines: MonthlyLine[]; addons: ContractAddonCharge[] } {
  const prorate = args.prorate ?? ((m: number) => m);
  const totalMinor = prorate(args.contractMonthlyMinor);
  if (!(totalMinor > 0)) return { lines: [], addons: [] };

  const factor = 1 + (Number(args.vatRate) || 0) / 100;
  const charges: ContractAddonCharge[] = [];
  const list = Array.isArray(args.addons) ? args.addons as Array<{ id?: string; label?: string; monthly?: number }> : [];
  for (const addon of list) {
    const monthly = Number(addon?.monthly ?? 0);
    if (!Number.isFinite(monthly) || monthly <= 0) continue;
    const inclMinor = Math.round(monthly * 100);
    const monthlyMinor = args.vatMode === "exclusive" ? Math.round(inclMinor / factor) : inclMinor;
    const amountMinor = prorate(monthlyMinor);
    if (amountMinor <= 0) continue;
    charges.push({
      id: addon?.id ? String(addon.id) : null,
      label: String(addon?.label ?? addon?.id ?? "Monthly add-on"),
      monthly_minor: monthlyMinor,
      amount_minor: amountMinor,
    });
  }

  const addonsMinor = charges.reduce((s, c) => s + c.amount_minor, 0);
  const baseLine = { description: args.serviceDescription, period_label: args.periodLabel };
  // Add-ons that don't fit inside the contracted price mean the snapshot
  // doesn't match the pricing model; bill the contracted price as one line.
  if (addonsMinor >= totalMinor) {
    return { lines: [{ ...baseLine, amount_minor: totalMinor }], addons: [] };
  }
  return {
    lines: [
      { ...baseLine, amount_minor: totalMinor - addonsMinor },
      ...charges.map((c) => ({ description: c.label, amount_minor: c.amount_minor, period_label: args.periodLabel })),
    ],
    addons: charges,
  };
}
