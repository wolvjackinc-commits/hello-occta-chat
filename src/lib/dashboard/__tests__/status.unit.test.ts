import { describe, expect, it } from "vitest";
import {
  isActiveTicket,
  isOutstandingInvoice,
  summarizeOutstandingInvoices,
} from "@/lib/dashboard/status";
import { formatSetupDate } from "@/components/dashboard/DirectDebitStatus";

describe("outstanding invoice rule (desktop must match app mode)", () => {
  it("treats every unsettled status as outstanding", () => {
    for (const s of ["draft", "sent", "overdue", "issued", "unpaid", "partially_paid", "ISSUED"]) {
      expect(isOutstandingInvoice(s)).toBe(true);
    }
  });

  it("excludes settled statuses", () => {
    for (const s of ["paid", "cancelled", "void", "written_off", "PAID"]) {
      expect(isOutstandingInvoice(s)).toBe(false);
    }
  });

  it("summarises count, total and next due date without double counting", () => {
    const rows = [
      { id: "a", status: "issued", total: "10.50", due_date: "2026-10-01" },
      { id: "b", status: "unpaid", total: 20, due_date: "2026-09-20" },
      { id: "c", status: "partially_paid", total: null, due_date: null },
      { id: "d", status: "paid", total: 999, due_date: "2026-01-01" },
      { id: "e", status: "written_off", total: 999, due_date: "2026-01-02" },
      { id: "f", status: "overdue", total: "not-a-number", due_date: "not-a-date" },
    ];
    const s = summarizeOutstandingInvoices(rows);
    expect(s.count).toBe(4);
    expect(s.total).toBeCloseTo(30.5);
    expect(s.nextDueDate).toBe("2026-09-20");
    expect(s.nextDueInvoiceId).toBe("b");
  });

  it("handles empty and nullish input", () => {
    const s = summarizeOutstandingInvoices(null);
    expect(s).toMatchObject({ count: 0, total: 0, nextDueDate: null, nextDueInvoiceId: null });
  });
});

describe("unresolved ticket rule", () => {
  it("includes waiting_customer and waiting_occta", () => {
    for (const s of ["open", "in_progress", "waiting_customer", "waiting_occta"]) {
      expect(isActiveTicket(s)).toBe(true);
    }
  });

  it("excludes resolved and closed", () => {
    for (const s of ["resolved", "closed", "", null, undefined]) {
      expect(isActiveTicket(s as any)).toBe(false);
    }
  });

  it("badge counts unread active tickets across all four statuses", () => {
    const tickets = [
      { id: "1", status: "waiting_occta", unread: true },
      { id: "2", status: "waiting_customer", unread: false },
      { id: "3", status: "closed", unread: true },
    ];
    const active = tickets.filter((t) => isActiveTicket(t.status));
    expect(active.map((t) => t.id)).toEqual(["1", "2"]);
    expect(active.filter((t) => t.unread).length).toBe(1);
  });
});

describe("Direct Debit set-up date", () => {
  it("never invents a date", () => {
    expect(formatSetupDate(null)).toBeNull();
    expect(formatSetupDate(undefined)).toBeNull();
    expect(formatSetupDate("")).toBeNull();
    expect(formatSetupDate("nonsense")).toBeNull();
  });

  it("formats real timestamps in UK style", () => {
    expect(formatSetupDate("2026-09-15T10:00:00Z")).toBe("15 Sep 2026");
  });
});
