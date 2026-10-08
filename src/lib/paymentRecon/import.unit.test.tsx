import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  applyImport,
  bankLinesForAccount,
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

  it("keeps stored payment fields when a later file leaves them blank, in either order", async () => {
    const events = [
      "customer,occta_ref,payment_ref,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,bank_received_at,bank_description,status,invoice_number,occta_recorded,occta_method",
      "Quinn Example,OCC10000011,PAY-DEMO-KEEP,DD,10.00,1 Oct 2026,8 Oct 2026,,,10 Oct 2026,APS-DISB-20261010,10 Oct 2026,APS RE OCCTA SEG,Paid,INV-DEMO-11,yes,DD",
    ].join("\n");
    const access = [
      "record_type,customer,occta_ref,payer_name,name_aliases,payment_ref,mandate_ref,invoice_number,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,fee_amount,status,accesspay_status,mandate_status,mandate_created_at,mandate_submitted_at,mandate_cancelled_at,is_test,is_duplicate,never_submitted,charge_kind,failure_treatment",
      "collection,Quinn Example,OCC10000011,,,PAY-DEMO-KEEP,MAN-DEMO-11,,DD,10.00,1 Oct 2026,8 Oct 2026,,,10 Oct 2026,APS-DISB-20261010,,Paid,Active,,,,,,,,,invoiced,",
    ].join("\n");
    const kept = (state: ReconState) => {
      const row = state.payments.find((payment) => payment.paymentRef === "PAY-DEMO-KEEP");
      expect(row?.invoiceNumber).toBe("INV-DEMO-11");
      expect(row?.occtaRecorded).toBe(true);
      expect(row?.occtaMethod).toBe("DD");
      expect(row?.bankReceivedAtRaw).toBe("10 Oct 2026");
      expect(row?.bankDescription).toBe("APS RE OCCTA SEG");
      expect(row?.mandateRef).toBe("MAN-DEMO-11");
      expect(state.payments.filter((payment) => payment.paymentRef === "PAY-DEMO-KEEP")).toHaveLength(1);
    };
    for (const order of [
      [["payment_events", events], ["accesspay_daily", access], ["accesspay_daily", access]],
      [["accesspay_daily", access], ["payment_events", events]],
    ] as const) {
      let state = emptyState();
      for (const [kind, csvText] of order) {
        const result = await applyImport(state, kind, { ...meta, csvText });
        expect(result.errors, result.errors.join(";")).toEqual([]);
        state = result.state;
      }
      kept(state);
    }
  });

  it("totals every received payment and bank credit, with genuine included and unlinked separate", async () => {
    const customers = [
      "Customer,Occta ref,Method,Amount due £,Due date,Last payment received,Seen in,Status,Balance outstanding £,Next action,Payer name",
      "Quinn Example,OCC10000031,DD,0,1 Oct 2026,1 Oct 2026 £999.00,Bank,Paid,0,None,Quinn Example",
    ].join("\n");
    const events = [
      "customer,occta_ref,payment_ref,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,bank_received_at,bank_description,status",
      "Quinn Example,OCC10000031,PAY-Q,DD,10.00,1 Oct 2026,6 Oct 2026,,,6 Oct 2026,APS-DISB-20261006,6 Oct 2026,APS RE OCCTA SEG,Paid",
      "Sample Civic Hall,,PAY-G,Bank transfer,5.00,,1 Sep 2026,,,,,,,genuine_unmatched",
      "Riley Example,OCC10000003,PAY-F,DD,7.00,1 Oct 2026,8 Oct 2026,9 Oct 2026,ARUDD 0,,,,,Failed",
    ].join("\n");
    const bank = [
      "bank_date,amount,description,payer_name,reference,payout_ref",
      "6 Oct 2026,10.00,APS RE OCCTA SEG,QUINN,APS-DISB-20261006,APS-DISB-20261006",
      "7 Oct 2026,3.00,FPS QUINN EXAMPLE,Quinn Example,,",
      "4 Oct 2026,4.00,UNKNOWN SAMPLE CREDIT,UNKNOWN SAMPLE,,",
    ].join("\n");
    let state = emptyState();
    for (const [kind, csvText] of [
      ["customer_status", customers],
      ["payment_events", events],
      ["bank_statement", bank],
    ] as const) {
      const result = await applyImport(state, kind, { ...meta, csvText });
      expect(result.errors, result.errors.join(";")).toEqual([]);
      state = result.state;
    }
    const summary = summarise(state);
    expect(summary.collected).toBe(18);
    expect(summary.genuineReceived).toBe(5);
    expect(summary.unlinked).toBe(4);
  });

  it("drops a retried Direct Debit failure from discrepancies and keeps it in history", async () => {
    const events = [
      "customer,occta_ref,payment_ref,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,bank_received_at,bank_description,status,invoice_number,mandate_ref",
      "Avery Example,OCC10000021,MAN-DEMO-21-20261008,DD,12.00,1 Oct 2026,8 Oct 2026,9 Oct 2026,ARUDD 0 - Refer to payer,,,,,Failed,INV-DEMO-21,MAN-DEMO-21",
      "Avery Example,OCC10000021,MAN-DEMO-21-20261015,DD,12.00,10 Oct 2026,15 Oct 2026,,,,16 Oct 2026,APS-DISB-20261016,,Paid,INV-DEMO-21,MAN-DEMO-21",
      "Blake Example,OCC10000022,MAN-DEMO-22-20261001,DD,8.00,1 Sep 2026,1 Oct 2026,2 Oct 2026,ARUDD 0,,,,,Failed,,MAN-DEMO-22",
      "Blake Example,OCC10000022,MAN-DEMO-22-20261020,DD,8.00,10 Oct 2026,20 Oct 2026,,,,21 Oct 2026,,,Paid,,MAN-DEMO-22",
      "Casey Wait,OCC10000023,MAN-DEMO-23-20261020,DD,4.00,1 Oct 2026,20 Oct 2026,21 Oct 2026,ARUDD 0,,,,,Failed,INV-DEMO-23,MAN-DEMO-23",
      "Casey Wait,OCC10000023,MAN-DEMO-23-20260901,DD,4.00,1 Sep 2026,1 Sep 2026,,,,2 Sep 2026,,,Paid,INV-DEMO-23,MAN-DEMO-23",
    ].join("\n");
    const result = await applyImport(emptyState(), "payment_events", { ...meta, csvText: events });
    expect(result.errors, result.errors.join(";")).toEqual([]);
    const titles = itemsInCategory(result.state, "discrepancy").map((item) => item.title);
    expect(titles).not.toContain("Avery Example");
    expect(titles).not.toContain("Blake Example");
    expect(titles).toContain("Casey Wait");
    const averyFail = result.state.payments.find((payment) => payment.paymentRef === "MAN-DEMO-21-20261008");
    const blakeFail = result.state.payments.find((payment) => payment.paymentRef === "MAN-DEMO-22-20261001");
    expect(averyFail?.reconciledStatus).toBe("failed");
    expect(averyFail?.matchCategory).toBe("matched");
    expect(averyFail?.caseCodes).toContain("failed_attempt_resolved");
    expect(blakeFail?.matchCategory).toBe("matched");
    expect(result.state.payments.find((payment) => payment.paymentRef === "MAN-DEMO-21-20261015")?.reconciledStatus).toBe("paid");
  });

  it("shows one AccessPay payout bank line on every customer in the batch", async () => {
    const customers = [
      "Customer,Occta ref,Method,Amount due £,Due date,Last payment received,Seen in,Status,Balance outstanding £,Next action",
      "Quinn Example,OCC10000031,DD,10,1 Oct 2026,None,,Paid,0,None",
      "Reese Example,OCC10000032,DD,15,1 Oct 2026,None,,Paid,0,None",
    ].join("\n");
    const events = [
      "customer,occta_ref,payment_ref,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,bank_received_at,bank_description,status",
      "Quinn Example,OCC10000031,PAY-Q1,DD,10.00,1 Oct 2026,5 Oct 2026,,,6 Oct 2026,APS-DISB-20261006,,,Paid",
      "Reese Example,OCC10000032,PAY-R1,DD,15.00,1 Oct 2026,5 Oct 2026,,,6 Oct 2026,APS-DISB-20261006,,,Paid",
    ].join("\n");
    const bank = [
      "bank_date,amount,description,payer_name,reference,payout_ref",
      "6 Oct 2026,25.00,APS RE OCCTA SEG,Quinn Example,APS-DISB-20261006,APS-DISB-20261006",
    ].join("\n");
    let state = emptyState();
    for (const [kind, csvText] of [
      ["customer_status", customers],
      ["payment_events", events],
      ["bank_statement", bank],
    ] as const) {
      const result = await applyImport(state, kind, { ...meta, csvText });
      expect(result.errors, result.errors.join(";")).toEqual([]);
      state = result.state;
    }
    const line = state.bankLines[0];
    expect(line.matchedPayoutRef).toBe("APS-DISB-20261006");
    expect(line.matchedAccountKey).toBeNull();
    const quinn = state.accounts.find((account) => account.customerName === "Quinn Example");
    const reese = state.accounts.find((account) => account.customerName === "Reese Example");
    expect(quinn && bankLinesForAccount(quinn, state).map((item) => item.lineKey)).toContain(line.lineKey);
    expect(reese && bankLinesForAccount(reese, state).map((item) => item.lineKey)).toContain(line.lineKey);
    const outsider = { ...quinn!, rowKey: "ref:OCC10000099", occtaRef: "OCC10000099", customerName: "Quinn Example" };
    expect(bankLinesForAccount(outsider, state)).toHaveLength(0);
    const quinnSlice = customerReconSlice(state, { accountNumber: "OCC10000031", fullName: "Quinn Example" }, []);
    const reeseSlice = customerReconSlice(state, { accountNumber: "OCC10000032", fullName: "Reese Example" }, []);
    expect(quinnSlice.bankLines.map((item) => item.lineKey)).toContain(line.lineKey);
    expect(reeseSlice.bankLines.map((item) => item.lineKey)).toContain(line.lineKey);
  });
});
