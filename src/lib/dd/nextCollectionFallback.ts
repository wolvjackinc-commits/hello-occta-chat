/**
 * Next collection shown on the admin Direct Debit card.
 *
 * A billing date from nextCollectionDate is used as-is. When that date is
 * missing, a non-cancelled mandate can show the AccessPay date stored on the
 * matching payment_recon_accounts row. The amount stays the contract amount.
 * This does not write billing settings or any other table.
 */
export type AccessPaySchedule = {
  occtaRef: string | null;
  nextDdOn: string | null;
  nextDdAmount: number | null;
};

export type NextCollectionDisplay = {
  date: string;
  amount: number | null;
  perAccessPay: boolean;
  accessPayAmountNote: number | null;
};

export function resolveNextCollectionDisplay(input: {
  mandateStatus: string;
  billingDate: string | null;
  contractAmount: number | null;
  accountNumber: string | null;
  schedules: AccessPaySchedule[];
}): NextCollectionDisplay | null {
  if (input.mandateStatus === "cancelled" || input.mandateStatus === "failed") return null;
  if (input.billingDate && input.contractAmount != null && input.contractAmount > 0) {
    return {
      date: input.billingDate,
      amount: input.contractAmount,
      perAccessPay: false,
      accessPayAmountNote: null,
    };
  }
  if (input.billingDate) return null;

  const schedule = input.schedules.find((row) => sameAccount(row.occtaRef, input.accountNumber) && calendarDay(row.nextDdOn));
  const date = calendarDay(schedule?.nextDdOn);
  if (!schedule || !date) return null;
  const amount = input.contractAmount != null && input.contractAmount > 0 ? input.contractAmount : null;
  return {
    date,
    amount,
    perAccessPay: true,
    accessPayAmountNote: amountsDiffer(schedule.nextDdAmount, amount) ? schedule.nextDdAmount : null,
  };
}

function sameAccount(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const b = (right ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return a.length > 0 && a === b;
}

function calendarDay(value: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec((value ?? "").trim());
  return match?.[1] ?? null;
}

function amountsDiffer(accessPay: number | null, contract: number | null): accessPay is number {
  if (accessPay == null || !Number.isFinite(accessPay)) return false;
  if (contract == null) return true;
  return Math.round(accessPay * 100) !== Math.round(contract * 100);
}
