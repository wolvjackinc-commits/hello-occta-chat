import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  applyImport,
  emptyState,
  itemsInCategory,
  linkSubject,
  markDraftDue,
  matchAccountToProfile,
  summarise,
  textHitsNames,
  type AccountRow,
  type ReconState,
} from "./engine";
import { PaymentReconScreen } from "@/components/admin/paymentRecon/PaymentReconScreen";
import { CustomerReconCard, customerReconSlice } from "@/components/admin/paymentRecon/CustomerPaymentReconPanel";

const root = path.resolve(__dirname, "../../..");
const read = (name: string) => readFileSync(path.join(root, "docs/examples", name), "utf8");

const meta = {
  fileName: "sample.csv",
  importedBy: "00000000-0000-4000-8000-000000000001",
  importedByEmail: "demo.admin@example.com",
  importedAt: "2026-10-08T12:00:00.000Z",
};

async function loadSamples(): Promise<ReconState> {
  let state = emptyState();
  for (const [kind, file] of [
    ["customer_status", "payment-reconciliation-customer-status.sample.csv"],
    ["payment_events", "payment-reconciliation-payment-events.sample.csv"],
    ["accesspay_daily", "payment-reconciliation-accesspay-daily.sample.csv"],
    ["bank_statement", "payment-reconciliation-bank-statement.sample.csv"],
  ] as const) {
    const result = await applyImport(state, kind, { ...meta, fileName: file, csvText: read(file) });
    expect(result.errors, result.errors.join(";")).toEqual([]);
    state = result.state;
  }
  return state;
}

describe("payment reconciliation imports", () => {
  it("imports every sample file idempotently and keeps the worked examples", async () => {
    const once = await loadSamples();
    const twiceEvents = await applyImport(once, "payment_events", {
      ...meta,
      fileName: "payment-reconciliation-payment-events.sample.csv",
      csvText: read("payment-reconciliation-payment-events.sample.csv"),
    });
    expect(twiceEvents.state.payments).toHaveLength(once.payments.length);
    expect(twiceEvents.state.timeline).toHaveLength(once.timeline.length);
    expect(twiceEvents.state.imports.find((item) => item.fileKind === "payment_events")?.importCount).toBe(2);

    const nina = once.accounts.find((account) => account.customerName === "Nina Example");
    expect(nina?.payerName).toBe("Harmonic Spa");
    expect(nina?.nameAliases).toContain("HAIRMONIC HEAD SPA");
    const bank = once.bankLines.find((line) => line.payerName === "HAIRMONIC HEAD SPA");
    expect(bank?.matchCategory).toBe("matched");
    expect(bank?.matchedAccountKey).toBe(nina?.rowKey);
    expect(textHitsNames("HAIRMONIC HEAD SPA", ["Harmonic Spa"])).toBe(false);

    const civic = itemsInCategory(once, "genuine_unmatched").map((item) => item.title);
    expect(civic).toContain("Sample Civic Hall");
    expect(itemsInCategory(once, "discrepancy").map((item) => item.title)).not.toContain("Sample Civic Hall");

    const summary = summarise(once);
    expect(summary.genuineReceived).toBe(40);
    expect(summary.failedExtraDebt).toBe(0);
    expect(summary.failedAttempts).toBe(25);
    expect(summary.outstanding).toBe(193);
    expect(summary.unlinked).toBe(21);

    const payout = once.payouts.find((item) => item.payoutRef === "BATCH-DEMO-1");
    expect(payout?.feeAmount).toBe(1.5);
    expect(payout?.bankAmount).toBe(20);
    expect(payout?.matchCategory).toBe("matched");
    expect(once.payments.filter((payment) => payment.payoutRef === "BATCH-DEMO-1").length).toBeGreaterThan(0);

    const riley = once.payments.find((payment) => payment.paymentRef === "PAY-DEMO-3");
    expect(riley?.failureReason).toContain("ARUDD");
    expect(riley?.caseCodes).toContain("failed_attempt_existing_charge");
    expect(riley?.submittedAtRaw).toBe("1 Oct 2026");
    expect(riley?.collectionDateRaw).toBe("8 Oct 2026");
    expect(riley?.failedAtRaw).toBe("9 Oct 2026");

    expect(once.accounts.find((account) => account.customerName === "Olivia Example")?.caseCodes).toContain("opening_balance_uninvoiced");
    expect(once.accounts.find((account) => account.customerName === "Sam Example")?.caseCodes).toContain("mandate_cancelled_occta_active");
    expect(once.accounts.find((account) => account.customerName === "Jordan Example")?.caseCodes).toContain("bank_receipt_not_in_occta");
    expect(once.accounts.find((account) => account.customerName === "Taylor Example")?.caseCodes).toContain("mislabeled_card_was_transfer");
    expect(once.accounts.find((account) => account.customerName === "Northwind Workshops")?.matchCategory).toBe("discrepancy");
    expect(once.accounts.find((account) => account.customerName === "Casey Example")?.caseCodes).toContain("draft_invoice_mark_due_no_email");
    expect(once.mandates.find((mandate) => mandate.mandateReference === "MAN-DEMO-NW")?.neverSubmitted).toBe(true);
    expect(once.mandates.find((mandate) => mandate.mandateReference === "MAN-DEMO-6")?.isTest).toBe(true);
    expect(once.bankLines.find((line) => line.payerName === "UNKNOWN SAMPLE")?.matchCategory).toBe("unlinked");
  });

  it("accepts a quoted customer-status row and preserves a manual link", async () => {
    const csv = [
      "Customer,Occta ref,Method,Amount due £,Due date,Last payment received,Seen in,Status,Balance outstanding £,Next action",
      "\"Alex Example, Jr\",OCC10000009,DD,10.00,10 Oct 2026 23:59,None,,Pending,10.00,\"Check, then wait\"",
    ].join("\n");
    const first = await applyImport(emptyState(), "customer_status", { ...meta, csvText: csv });
    expect(first.errors).toEqual([]);
    const linked = linkSubject(first.state, {
      subjectType: "account",
      subjectKey: "ref:OCC10000009",
      accountNumber: "OCC10000009",
      invoiceNumber: "INV-DEMO-9",
      actorId: meta.importedBy,
      actorEmail: meta.importedByEmail,
      at: "2026-10-08T13:00:00.000Z",
    });
    expect(linked.audit).toHaveLength(1);
    const second = await applyImport(linked, "customer_status", { ...meta, importedAt: "2026-10-08T14:00:00.000Z", csvText: csv });
    expect(second.state.accounts).toHaveLength(1);
    expect(second.state.accounts[0].linkedInvoiceNumber).toBe("INV-DEMO-9");
    expect(second.state.accounts[0].customerName).toBe("Alex Example, Jr");
    const marked = markDraftDue(second.state, { rowKey: "ref:OCC10000009", at: "2026-10-08T15:00:00.000Z", actorId: null, actorEmail: null });
    expect(marked.accounts[0].draftMarkedDueAt).toBe("2026-10-08T15:00:00.000Z");
  });

  it("matches a payer alias to a different personal name", () => {
    const account = {
      rowKey: "name:alex example",
      customerName: "Alex Example",
      payerName: "Harmonic Spa",
      bankPayerName: "HAIRMONIC HEAD SPA",
      nameAliases: ["HAIRMONIC HEAD SPA"],
      occtaRef: null,
      linkedAccountNumber: null,
    } as AccountRow;
    expect(matchAccountToProfile(account, [{ id: "p1", account_number: "OCC10000008", full_name: "Harmonic Spa" }]).how).toBe("payer");
    expect(textHitsNames("FPS HAIRMONIC HEAD SPA", account.nameAliases)).toBe(true);
  });

  it("does not write the invoice ledger from the importer", () => {
    const source = [
      readFileSync(path.join(root, "src/lib/paymentRecon/db.ts"), "utf8"),
      readFileSync(path.join(root, "supabase/functions/admin-payment-recon-import/index.ts"), "utf8"),
      readFileSync(path.join(root, "supabase/functions/_shared/paymentReconEngine.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/from\("invoices"\)\s*\.(update|upsert|insert|delete)/);
    expect(source).not.toMatch(/from\("payment_attempts"\)/);
    expect(source).not.toMatch(/from\("dd_mandates"\)\s*\.(update|upsert|insert|delete)/);
  });

  it("renders the reconciliation sections for an admin", async () => {
    const state = await loadSamples();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PaymentReconScreen
          state={state}
          profiles={[{ id: "nina", account_number: "OCC10000007", full_name: "Nina Example" }]}
          liveBalances={{}}
          onImport={async () => {}}
          onLink={async () => {}}
          onMarkDraft={async () => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /payment reconciliation/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Harmonic Spa/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Not counted as discrepancies/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByText(/PAY-DEMO-3/)).toBeInTheDocument();
    expect(screen.getByText(/ARUDD 0 - Refer to payer/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Matched" }));
    expect(screen.getAllByText("Nina Example").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "Genuine unmatched" }));
    expect(screen.getByText(/excluded from discrepancies/i)).toBeInTheDocument();
    const slice = customerReconSlice(state, { accountNumber: "OCC10000007", fullName: "Nina Example" }, [
      { id: "nina", account_number: "OCC10000007", full_name: "Nina Example" },
    ]);
    render(
      <MemoryRouter>
        <CustomerReconCard accounts={slice.accounts} payments={slice.payments} mandates={slice.mandates} bankLines={slice.bankLines} timeline={slice.timeline} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Payment timeline/)).toBeInTheDocument();
    expect(screen.getAllByText(/Harmonic Spa/).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/HAIRMONIC HEAD SPA/).length).toBeGreaterThan(1);
  });
});
