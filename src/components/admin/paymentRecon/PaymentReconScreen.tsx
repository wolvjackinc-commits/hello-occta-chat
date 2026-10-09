import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAccountNumberValid, normalizeAccountNumber } from "@/lib/account";
import {
  CATEGORY_LABELS,
  CASE_LABELS,
  PAYER_ALIAS_HELP,
  STATUS_LABELS,
  bankLinesForAccount,
  itemsInCategory,
  summarise,
  type AccountRow,
  type MatchCategory,
  type PaymentRow,
  type ProfileRef,
  type ReconState,
} from "@/lib/paymentRecon/engine";
import { ImportDialog } from "./ImportDialog";
import type { FileKind } from "@/lib/paymentRecon/engine";

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `£${value.toFixed(2)}`;
}

function show(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

function bankMatchLabel(account: AccountRow, state: ReconState): string {
  const lines = bankLinesForAccount(account, state);
  if (!lines.length) return account.seenIn || "No bank match";
  return lines.map((line) => {
    const batch = line.matchedPayoutRef || line.payoutRef;
    if (batch && !line.matchedAccountKey) return [line.bankDateRaw, `payout batch ${batch}`, line.description].filter(Boolean).join(" · ");
    return [line.bankDateRaw, line.payerName || line.description, batch ? `batch ${batch}` : ""].filter(Boolean).join(" · ");
  }).join("; ");
}

function CaseBadges({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {codes.map((code) => (
        <Badge key={code} variant="outline" className="border-2 text-[10px]">{CASE_LABELS[code] ?? code}</Badge>
      ))}
    </div>
  );
}

function LinkFields({ onLink }: { onLink: (accountNumber: string | null, invoiceNumber: string | null) => Promise<void> }) {
  const [accountNumber, setAccountNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-wrap gap-2 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const account = accountNumber.trim();
        const invoice = invoiceNumber.trim();
        if (!account && !invoice) {
          setError("Enter an Occta account or an invoice number.");
          return;
        }
        if (account && !isAccountNumberValid(account)) {
          setError("Account numbers look like OCC and 8 digits.");
          return;
        }
        setError("");
        void onLink(account ? normalizeAccountNumber(account) : null, invoice || null);
      }}
    >
      <Input aria-label="Link account" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="Account OCC…" className="h-8 w-36 border-2 border-foreground" />
      <Input aria-label="Link invoice" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Invoice" className="h-8 w-32 border-2 border-foreground" />
      <Button type="submit" size="sm" variant="outline">Link</Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}

function PaymentTable({ payments }: { payments: PaymentRow[] }) {
  return (
    <div className="overflow-auto border-2 border-foreground">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b-2 border-foreground">
          <tr className="text-left">
            {["Customer", "Invoice", "Method", "Amount", "Submitted", "Collected", "Failed", "ARUDD / ADDACS", "Processed / payout", "Bank", "Invoiced?", "Category"].map((heading) => (
              <th key={heading} className="p-2 whitespace-nowrap">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.eventKey} className="border-b border-foreground/10 align-top">
              <td className="p-2">{show(payment.customerName)}<div className="text-xs text-muted-foreground">{show(payment.occtaRef)} · {show(payment.paymentRef)}</div></td>
              <td className="p-2">{show(payment.invoiceNumber || payment.linkedInvoiceNumber)}</td>
              <td className="p-2">{show(payment.method)}{payment.occtaMethod ? <div className="text-xs">Occta: {payment.occtaMethod}</div> : null}</td>
              <td className="p-2">{money(payment.amount)}</td>
              <td className="p-2">{show(payment.submittedAtRaw)}</td>
              <td className="p-2">{show(payment.collectionDateRaw)}</td>
              <td className="p-2">{show(payment.failedAtRaw)}</td>
              <td className="p-2">{show(payment.failureReason)}{payment.caseCodes.includes("failed_attempt_existing_charge") ? <div className="text-xs">Existing charge, not extra debt</div> : null}</td>
              <td className="p-2">{show(payment.processedAtRaw)}<div className="text-xs text-muted-foreground">{show(payment.payoutRef)}</div></td>
              <td className="p-2">{show(payment.bankReceivedAtRaw)}<div className="text-xs">{show(payment.bankDescription)}</div></td>
              <td className="p-2">{show(payment.chargeKind)}</td>
              <td className="p-2">{CATEGORY_LABELS[payment.matchCategory]}<CaseBadges codes={payment.caseCodes} /></td>
            </tr>
          ))}
          {payments.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">No payments imported yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentReconScreen({
  state,
  profiles,
  liveBalances,
  initialTab = "customers",
  busy,
  onImport,
  onLink,
  onMarkDraft,
}: {
  state: ReconState;
  profiles: ProfileRef[];
  liveBalances: Record<string, number>;
  initialTab?: string;
  busy?: boolean;
  onImport: (fileKind: FileKind, fileName: string, csvText: string) => Promise<void>;
  onLink: (subjectType: "account" | "payment" | "bank" | "mandate", subjectKey: string, accountNumber: string | null, invoiceNumber: string | null) => Promise<void>;
  onMarkDraft: (rowKey: string) => Promise<void>;
}) {
  const [openImport, setOpenImport] = useState(false);
  const [query, setQuery] = useState("");
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const summary = useMemo(() => summarise(state), [state]);
  const last = [...state.imports].sort((a, b) => b.lastImportedAt.localeCompare(a.lastImportedAt))[0] ?? null;
  const needle = query.trim().toLowerCase();
  const matches = (parts: Array<string | null | undefined>) => !needle || parts.join(" ").toLowerCase().includes(needle);

  const profileFor = (account: AccountRow) => {
    const ref = (account.linkedAccountNumber || account.occtaRef || "").toUpperCase();
    return profiles.find((profile) => (profile.account_number ?? "").toUpperCase() === ref) ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">PAYMENT RECONCILIATION</h1>
          <p className="text-sm text-muted-foreground">AccessPay, bank statement and Occta balances. Imports do not change invoices or send email.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {last ? `Last updated ${new Date(last.lastImportedAt).toLocaleString()} · ${last.importedByEmail || "admin"} · ${last.fileName}` : "Last updated — not imported yet"}
          </p>
        </div>
        <Button onClick={() => setOpenImport(true)}>Import CSV</Button>
      </div>
      <p className="text-sm border-2 border-foreground p-3">{PAYER_ALIAS_HELP}</p>
      <Card className="border-2 border-foreground p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-xs uppercase text-muted-foreground">Collected</div><div className="font-display text-xl">{money(summary.collected)}</div><div className="text-xs text-muted-foreground">All received payments and bank credits. Genuine receipts are included. Unlinked is separate.</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Failed attempts</div><div className="font-display text-xl">{money(summary.failedAttempts)}</div><div className="text-xs text-muted-foreground">Extra debt {money(summary.failedExtraDebt)}. Existing-charge failures are not added again.</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Outstanding</div><div className="font-display text-xl">{money(summary.outstanding)}</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Unlinked</div><div className="font-display text-xl">{money(summary.unlinked)}</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Genuine business receipts</div><div className="font-display text-xl">{money(summary.genuineReceived)}</div><div className="text-xs text-muted-foreground">Not counted as discrepancies.</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Discrepancy items</div><div className="font-display text-xl">{summary.discrepancyCount}</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Matched customers</div><div className="font-display text-xl">{summary.matchedCount}</div></div>
      </Card>
      <Input aria-label="Search reconciliation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, payer, ref, invoice" className="max-w-md border-2 border-foreground" />
      <Tabs defaultValue={initialTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="mandates">Mandates</TabsTrigger>
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="unlinked">Unlinked</TabsTrigger>
          <TabsTrigger value="genuine">Genuine unmatched</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="payouts">Payout batches</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <div className="overflow-auto border-2 border-foreground">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b-2 border-foreground">
                <tr className="text-left">
                  {["Customer", "Payer / statement", "AccessPay", "Bank match", "DD / mandate", "Outstanding", "Invoiced", "Uninvoiced", "Status", "Next action"].map((heading) => (
                    <th key={heading} className="p-2">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.accounts.filter((account) => matches([account.customerName, account.payerName, account.bankPayerName, account.occtaRef, ...account.nameAliases])).map((account) => {
                  const profile = profileFor(account);
                  const live = profile ? liveBalances[profile.id] : undefined;
                  const open = openAccount === account.rowKey;
                  const payments = state.payments.filter((payment) => payment.accountKey === account.rowKey || (account.occtaRef && payment.occtaRef === account.occtaRef));
                  const mandates = state.mandates.filter((mandate) => mandate.accountKey === account.rowKey || (account.occtaRef && mandate.occtaRef === account.occtaRef));
                  return (
                    <tr key={account.rowKey} className="border-b border-foreground/10 align-top">
                      <td className="p-2" colSpan={10}>
                        <div className="grid md:grid-cols-10 gap-2">
                          <div className="md:col-span-1">
                            <button type="button" className="font-medium underline" onClick={() => setOpenAccount(open ? null : account.rowKey)}>{account.customerName}</button>
                            <div className="text-xs">{account.occtaRef ? <Link className="underline" to={`/admin/customers/${account.occtaRef}`}>{account.occtaRef}</Link> : "No Occta ref"}</div>
                          </div>
                          <div>{show(account.payerName)}<div className="text-xs text-muted-foreground">{account.nameAliases.join(", ") || "—"}</div></div>
                          <div>{show(account.accesspayStatus)}</div>
                          <div>{bankMatchLabel(account, state)}</div>
                          <div>{show(account.occtaMandateStatus || account.ddStatus)}<div className="text-xs">{show(account.method)}</div></div>
                          <div>{money(account.balanceOutstanding)}<div className="text-xs text-muted-foreground">Live invoices {live == null ? "—" : money(live)}</div></div>
                          <div>{money(account.invoicedAmount)}</div>
                          <div>{money(account.uninvoicedAmount)}{account.balanceKind ? <div className="text-xs">{account.balanceKind}</div> : null}</div>
                          <div>{STATUS_LABELS[account.reconciledStatus]}<div className="text-xs">{CATEGORY_LABELS[account.matchCategory]}</div><CaseBadges codes={account.caseCodes} /></div>
                          <div>{show(account.nextAction)}{account.notes ? <div className="text-xs text-muted-foreground">{account.notes}</div> : null}
                            {account.caseCodes.includes("draft_invoice_mark_due_no_email") && (
                              <Button size="sm" variant="outline" className="mt-2" onClick={() => void onMarkDraft(account.rowKey)}>
                                {account.draftMarkedDueAt ? "Marked due (no email)" : "Mark draft due (no email)"}
                              </Button>
                            )}
                          </div>
                        </div>
                        {open && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs uppercase text-muted-foreground">Payment history</div>
                            <PaymentTable payments={payments} />
                            <div className="text-xs uppercase text-muted-foreground">Mandates</div>
                            <MandateTable mandates={mandates} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {state.accounts.length === 0 && <tr><td colSpan={10} className="p-4 text-muted-foreground">Import a customer status file to list accounts.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentTable payments={state.payments.filter((payment) => matches([payment.customerName, payment.occtaRef, payment.paymentRef, payment.invoiceNumber, payment.failureReason, payment.bankDescription]))} />
        </TabsContent>
        <TabsContent value="mandates" className="mt-4"><MandateTable mandates={state.mandates} /></TabsContent>
        <TabsContent value="matched" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Tied to an Occta customer, a payout batch, or a payer-name alias.</p>
          <ItemList category="matched" state={state} onLink={onLink} />
        </TabsContent>
        <TabsContent value="unlinked" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Money received that has not been identified yet. Linking writes an audit entry and does not change the invoice ledger.</p>
          <ItemList category="unlinked" state={state} onLink={onLink} />
        </TabsContent>
        <TabsContent value="genuine" className="mt-4 space-y-3">
          <p className="text-sm">Genuine business payments that are not matched to an Occta customer. These receipts are excluded from discrepancies and exceptions.</p>
          <ItemList category="genuine_unmatched" state={state} onLink={onLink} />
        </TabsContent>
        <TabsContent value="discrepancies" className="mt-4">
          <ItemList category="discrepancy" state={state} onLink={onLink} />
        </TabsContent>
        <TabsContent value="payouts" className="mt-4 space-y-3">
          {state.payouts.map((payout) => {
            const collections = state.payments.filter((payment) => payment.payoutRef === payout.payoutRef);
            const credits = state.bankLines.filter((line) => line.payoutRef === payout.payoutRef || line.matchedPayoutRef === payout.payoutRef);
            return (
              <Card key={payout.payoutRef} className="border-2 border-foreground p-3 text-sm">
                <div className="font-display">{payout.payoutRef}</div>
                <div>AccessPay payout {money(payout.amount)} · fee {money(payout.feeAmount)} · bank credit {money(payout.bankAmount ?? credits[0]?.amount)} · {payout.matchCategory}</div>
                <div className="text-xs text-muted-foreground">{show(payout.processedRaw)} {show(payout.bankDescription || credits[0]?.description)}</div>
                <div className="mt-2">Collections: {collections.length ? collections.map((payment) => `${payment.paymentRef || payment.customerName} ${money(payment.amount)}`).join(", ") : "None imported"}</div>
              </Card>
            );
          })}
          {state.payouts.length === 0 && <p className="text-sm text-muted-foreground">No payout batches imported yet.</p>}
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="overflow-auto border-2 border-foreground">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b-2 border-foreground">{["When", "Who", "File", "Kind", "Rows", "Times"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
              <tbody>
                {state.imports.map((item) => (
                  <tr key={`${item.fileKind}:${item.contentSha256}`} className="border-b border-foreground/10">
                    <td className="p-2">{new Date(item.lastImportedAt).toLocaleString()}</td>
                    <td className="p-2">{item.importedByEmail || "—"}</td>
                    <td className="p-2">{item.fileName}</td>
                    <td className="p-2">{item.fileKind}</td>
                    <td className="p-2">{item.rowCount}</td>
                    <td className="p-2">{item.importCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-sm space-y-1">
            {state.audit.map((entry) => (
              <div key={entry.auditKey} className="border-b border-foreground/10 py-1">{entry.createdAt} · {entry.actorEmail || "admin"} · {entry.action} · {entry.subjectType} {entry.accountNumber || ""} {entry.invoiceNumber || ""}</div>
            ))}
            {state.timeline.slice(-12).map((entry) => (
              <div key={entry.timelineKey} className="text-xs text-muted-foreground">{entry.subjectType} {entry.fieldName}: {entry.previousValue || "—"} → {entry.newValue || "—"}</div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <ImportDialog
        open={openImport}
        busy={!!busy}
        onOpenChange={setOpenImport}
        onImport={async (kind, name, text) => {
          await onImport(kind, name, text);
          setOpenImport(false);
        }}
      />
    </div>
  );
}

function MandateTable({ mandates }: { mandates: ReconState["mandates"] }) {
  return (
    <div className="overflow-auto border-2 border-foreground">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b-2 border-foreground">
          <tr className="text-left">{["Customer", "Reference", "Status", "AccessPay", "Created", "Submitted", "Cancelled", "Flags"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {mandates.map((mandate) => (
            <tr key={mandate.mandateKey} className="border-b border-foreground/10">
              <td className="p-2">{show(mandate.customerName)}<div className="text-xs">{show(mandate.occtaRef)}</div></td>
              <td className="p-2">{show(mandate.mandateReference)}</td>
              <td className="p-2">{show(mandate.status)}</td>
              <td className="p-2">{show(mandate.accesspayStatus)}</td>
              <td className="p-2">{show(mandate.createdRaw)}</td>
              <td className="p-2">{show(mandate.submittedRaw)}</td>
              <td className="p-2">{show(mandate.cancelledRaw)}</td>
              <td className="p-2">{[mandate.isTest && "Test", mandate.isDuplicate && "Duplicate", mandate.neverSubmitted && "Never submitted"].filter(Boolean).join(", ") || "—"}</td>
            </tr>
          ))}
          {mandates.length === 0 && <tr><td colSpan={8} className="p-4 text-muted-foreground">No mandates imported yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ItemList({
  category,
  state,
  onLink,
}: {
  category: MatchCategory;
  state: ReconState;
  onLink: (subjectType: "account" | "payment" | "bank" | "mandate", subjectKey: string, accountNumber: string | null, invoiceNumber: string | null) => Promise<void>;
}) {
  const items = itemsInCategory(state, category);
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing in this section.</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={`${item.kind}:${item.key}`} className="border-2 border-foreground p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.kind} · {money(item.amount)} · {CATEGORY_LABELS[item.category]}</div>
          </div>
          {category === "unlinked" && (item.kind === "bank" || item.kind === "payment" || item.kind === "account") && (
            <LinkFields onLink={(accountNumber, invoiceNumber) => onLink(item.kind as "bank" | "payment" | "account", item.key, accountNumber, invoiceNumber)} />
          )}
        </Card>
      ))}
    </div>
  );
}

