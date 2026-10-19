// Monthly service lines for an invoice, built from the accepted Contract
// Summary. Pure (no jsPDF import) so it can be unit tested.

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
  const lines: MonthlyLine[] = [];
  const baseMinor = prorate(args.contractMonthlyMinor);
  if (baseMinor > 0) {
    lines.push({ description: args.serviceDescription, amount_minor: baseMinor, period_label: args.periodLabel });
  }
  const charges: ContractAddonCharge[] = [];
  const list = Array.isArray(args.addons) ? args.addons as Array<{ id?: string; label?: string; monthly?: number }> : [];
  for (const addon of list) {
    const monthly = Number(addon?.monthly ?? 0);
    if (!Number.isFinite(monthly) || monthly <= 0) continue;
    const monthlyMinor = Math.round(monthly * 100);
    const amountMinor = prorate(monthlyMinor);
    if (amountMinor <= 0) continue;
    const label = String(addon?.label ?? addon?.id ?? "Monthly add-on");
    lines.push({ description: label, amount_minor: amountMinor, period_label: args.periodLabel });
    charges.push({ id: addon?.id ? String(addon.id) : null, label, monthly_minor: monthlyMinor, amount_minor: amountMinor });
  }
  return { lines, addons: charges };
}
