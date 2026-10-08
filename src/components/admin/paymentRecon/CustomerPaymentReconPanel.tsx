import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CASE_LABELS,
  STATUS_LABELS,
  accountBelongsToCustomer,
  bankLinesForAccount,
  type AccountRow,
  type BankLine,
  type MandateRow,
  type PaymentRow,
  type ProfileRef,
  type ReconState,
  type TimelineRow,
} from "@/lib/paymentRecon/engine";
import { fetchReconState, markReconDraftDue } from "@/lib/paymentRecon/db";

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `£${value.toFixed(2)}`;
}

export function customerReconSlice(state: ReconState, customer: { accountNumber: string | null; fullName: string | null }, profiles: ProfileRef[]) {
  const accounts = state.accounts.filter((account) => accountBelongsToCustomer(account, customer, profiles));
  const keys = new Set(accounts.map((account) => account.rowKey));
  const refs = new Set(accounts.map((account) => account.occtaRef).filter(Boolean));
  const payments = state.payments.filter((payment) => (payment.accountKey && keys.has(payment.accountKey)) || (payment.occtaRef && refs.has(payment.occtaRef)) || accounts.some((account) => payment.customerName && account.customerName === payment.customerName && !payment.occtaRef));
  const mandates = state.mandates.filter((mandate) => (mandate.accountKey && keys.has(mandate.accountKey)) || (mandate.occtaRef && refs.has(mandate.occtaRef)));
  const bankLines = [...new Map(accounts.flatMap((account) => bankLinesForAccount(account, state)).map((line) => [line.lineKey, line])).values()];
  const timeline = state.timeline.filter((entry) => payments.some((payment) => payment.eventKey === entry.subjectKey) || mandates.some((mandate) => mandate.mandateKey === entry.subjectKey) || bankLines.some((line) => line.lineKey === entry.subjectKey));
  return { accounts, payments, mandates, bankLines, timeline };
}

export function CustomerReconCard({
  accounts,
  payments,
  mandates,
  bankLines = [],
  timeline,
  onMarkDraft,
}: {
  accounts: AccountRow[];
  payments: PaymentRow[];
  mandates: MandateRow[];
  bankLines?: BankLine[];
  timeline: TimelineRow[];
  onMarkDraft?: (rowKey: string) => void;
}) {
  return (
    <Card className="border-2 border-foreground p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">Payment reconciliation</h3>
        <Button asChild variant="outline" size="sm"><Link to="/admin/billing/payment-reconciliation">Open reconciliation</Link></Button>
      </div>
      <p className="text-xs text-muted-foreground">Imported reconciliation only. This does not change invoices, payments, allocations or send email.</p>
      {accounts.length === 0 && <p className="text-sm text-muted-foreground">No imported reconciliation for this customer yet.</p>}
      {accounts.map((account) => (
        <div key={account.rowKey} className="border-2 border-foreground/20 p-3 text-sm space-y-1">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-2">{STATUS_LABELS[account.reconciledStatus]}</Badge>
            <span>Outstanding {money(account.balanceOutstanding)}</span>
          </div>
          <div>Direct Debit / mandate: {account.occtaMandateStatus || account.ddStatus || "—"} · AccessPay: {account.accesspayStatus || "—"}</div>
          <div>Payer: {account.payerName || "—"}{account.nameAliases.length ? ` · statement names: ${account.nameAliases.join(", ")}` : ""}</div>
          <div>Last DD: {account.lastDdDateRaw || "—"} {account.lastDdResult || ""} {account.lastDdAmount != null ? money(account.lastDdAmount) : ""} · Next DD: {account.nextDdDateRaw || "—"} {account.nextDdAmount != null ? money(account.nextDdAmount) : ""}</div>
          <div>Next action: {account.nextAction || "—"}</div>
          {account.caseCodes.map((code) => <div key={code} className="text-xs">{CASE_LABELS[code] ?? code}</div>)}
          {account.caseCodes.includes("draft_invoice_mark_due_no_email") && onMarkDraft && (
            <Button size="sm" variant="outline" onClick={() => onMarkDraft(account.rowKey)}>
              {account.draftMarkedDueAt ? "Marked due (no email)" : "Mark draft due (no email)"}
            </Button>
          )}
        </div>
      ))}
      {mandates.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Mandates</div>
          {mandates.map((mandate) => (
            <div key={mandate.mandateKey}>{mandate.mandateReference || "Mandate"} · {mandate.status || "—"} · created {mandate.createdRaw || "—"} · submitted {mandate.submittedRaw || "—"} · cancelled {mandate.cancelledRaw || "—"} {[mandate.isTest && "test", mandate.isDuplicate && "duplicate", mandate.neverSubmitted && "never submitted"].filter(Boolean).join(" ")}</div>
          ))}
        </div>
      )}
      {payments.length > 0 && (
        <div className="overflow-auto">
          <div className="font-medium text-sm mb-1">Payment timeline</div>
          <table className="w-full text-xs">
            <thead><tr className="text-left">{["Invoice", "Amount", "Submitted", "Collected", "Failed", "Reason", "Processed", "Bank", "Balance"].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.eventKey} className="border-t border-foreground/10">
                  <td className="p-1">{payment.invoiceNumber || payment.linkedInvoiceNumber || "—"}</td>
                  <td className="p-1">{money(payment.amount)} {payment.chargeKind || ""}</td>
                  <td className="p-1">{payment.submittedAtRaw || "—"}</td>
                  <td className="p-1">{payment.collectionDateRaw || "—"}</td>
                  <td className="p-1">{payment.failedAtRaw || "—"}</td>
                  <td className="p-1">{payment.failureReason || "—"}</td>
                  <td className="p-1">{payment.processedAtRaw || "—"} {payment.payoutRef || ""}</td>
                  <td className="p-1">{payment.bankReceivedAtRaw || "—"} {payment.bankDescription || ""}</td>
                  <td className="p-1">{money(payment.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bankLines.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Bank statement match</div>
          {bankLines.map((line) => {
            const batch = line.matchedPayoutRef || line.payoutRef;
            const sharedBatch = Boolean(batch && !line.matchedAccountKey);
            return (
              <div key={line.lineKey}>
                {sharedBatch
                  ? `Payout batch ${batch} · bank credit ${money(line.amount)} · ${line.bankDateRaw || "—"} · ${line.description || line.payerName || "—"}`
                  : `${line.bankDateRaw || "—"} · ${line.payerName || line.description || "—"} · ${money(line.amount)} · batch ${batch || "—"}`}
              </div>
            );
          })}
        </div>
      )}
      {timeline.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          {timeline.map((entry) => <div key={entry.timelineKey}>{entry.fieldName}: {entry.previousValue || "—"} → {entry.newValue || "—"}</div>)}
        </div>
      )}
    </Card>
  );
}

export function CustomerPaymentReconPanel({ accountNumber, fullName }: { accountNumber: string | null; fullName: string | null }) {
  const query = useQuery({
    queryKey: ["payment-recon-customer", accountNumber, fullName],
    queryFn: () => fetchReconState(),
  });
  const profiles: ProfileRef[] = [{ id: "self", account_number: accountNumber, full_name: fullName }];
  const slice = query.data ? customerReconSlice(query.data, { accountNumber, fullName }, profiles) : null;
  if (query.isError) return <Card className="border-2 border-foreground p-4 text-sm">Reconciliation data is not available yet.</Card>;
  return (
    <CustomerReconCard
      accounts={slice?.accounts ?? []}
      payments={slice?.payments ?? []}
      mandates={slice?.mandates ?? []}
      bankLines={slice?.bankLines ?? []}
      timeline={slice?.timeline ?? []}
      onMarkDraft={(rowKey) => void markReconDraftDue(rowKey).then(() => query.refetch())}
    />
  );
}
