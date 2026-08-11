import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  resolveNoticePeriod,
  parseNoticeText,
  noticeText,
} from "../../../../supabase/functions/_shared/noticePeriod";

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("notice period is derived, never invented", () => {
  it("keeps normal 30-day quotes at 30 days", () => {
    expect(resolveNoticePeriod({ id: "q", notice_period: "30 days", plan_term: "flex_30" })).toEqual({
      days: 30,
      text: "30 days",
      source: "quote_text",
    });
    // Governed Build Plan terms with no stored text still resolve to 30.
    expect(resolveNoticePeriod({ notice_period: null, plan_term: "price_lock_24" })?.days).toBe(30);
  });

  it("preserves a custom non-30 notice exactly", () => {
    expect(resolveNoticePeriod({ notice_period: "14 days" })?.days).toBe(14);
    expect(resolveNoticePeriod({ notice_period: "90 calendar days" })?.days).toBe(90);
    expect(resolveNoticePeriod({ notice_period: "1 month" })?.days).toBe(30);
    expect(resolveNoticePeriod({ notice_period: "3 months" })?.days).toBe(90);
    expect(resolveNoticePeriod({ notice_period: "none" })?.days).toBe(0);
  });

  it("prefers an explicit two-doc snapshot override", () => {
    const r = resolveNoticePeriod({
      notice_period: "30 days",
      plan_term: "flex_30",
      final_snapshot: { two_doc: { broadband: { notice_period_days: 60 } } },
    });
    expect(r).toEqual({ days: 60, text: "60 days", source: "snapshot_override" });
  });

  it("fails safely into manual review for legacy unparseable notice data", () => {
    expect(resolveNoticePeriod({ notice_period: "as agreed by phone" })).toBeNull();
    expect(resolveNoticePeriod({ notice_period: null, plan_term: "legacy_thing" })).toBeNull();
    expect(resolveNoticePeriod({})).toBeNull();
    expect(parseNoticeText("see contract")).toBeNull();
  });

  it("renders singular/plural labels used in contract text", () => {
    expect(noticeText(1)).toBe("1 day");
    expect(noticeText(45)).toBe("45 days");
    expect(noticeText(0)).toBe("No notice period");
  });
});

describe("text, snapshot and PDF agree on the notice period", () => {
  it("generate-contract-summary stores the derived value, not a hardcoded 30", () => {
    const src = read("supabase/functions/generate-contract-summary/index.ts");
    expect(src).toContain("resolveNoticePeriod");
    expect(src).toContain("notice_period_days: notice.days");
    expect(src).toContain("notice_period: notice.text");
    expect(src).not.toContain("notice_period_days: 30");
    expect(src).not.toContain("Cancel with 30 days' notice");
    expect(src).toContain("notice_period_unresolved");
  });

  it("service component snapshots derive the broadband notice", () => {
    const src = read("supabase/functions/_shared/serviceComponents.ts");
    expect(src).toContain("resolveNoticePeriod");
    expect(src).not.toContain('String(q.notice_period ?? "30 days")');
    expect(src).not.toContain("Cancel with 30 days' notice at any time");
  });

  it("two-doc generators fail safe when the notice cannot be resolved", () => {
    for (const p of [
      "supabase/functions/generate-contract-information-pack/index.ts",
      "supabase/functions/generate-service-aware-cs/index.ts",
    ]) {
      expect(read(p)).toContain("notice_period_unresolved");
    }
  });
});