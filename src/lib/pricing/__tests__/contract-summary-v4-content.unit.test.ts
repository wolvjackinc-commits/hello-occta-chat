import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Contract Summary V4 content gates", () => {
  it("never falls back from an unknown broadband cease fee to a claim that no fee applies", () => {
    const src = read("supabase/functions/generate-contract-summary/index.ts");
    expect(src).not.toContain("No cease or early termination charges apply to this plan beyond statutory notice");
    expect(src).toContain("termination_charges_unresolved");
    expect(src).toContain("network cease/migration-away charge");
  });

  it("uses a fair-loss ETF method and preserves penalty-free rights", () => {
    const src = read("supabase/functions/generate-contract-summary/index.ts");
    expect(src).toContain("less VAT that no longer becomes due");
    expect(src).toContain("less costs OCCTA reasonably saves");
    expect(src).toContain("penalty-free exit right");
  });

  it("keeps accepted PDF evidence immutable", () => {
    const src = read("supabase/functions/generate-contract-summary-pdf/index.ts");
    expect(src).toContain("Accepted Contract Summary has no stored PDF");
    expect(src).toContain("upsert: false");
    expect(src).toContain("Existing Contract Summary PDF reused");
  });

  it("marks customer information refreshes as non-signable", () => {
    const view = read("src/pages/dashboard/ContractSummaryAuthedView.tsx");
    expect(view).toContain("No action required");
    expect(view).toContain("if (!csId || cs?.is_information_update) return");
    expect(view).toContain("does not replace your original accepted agreement");
  });

  it("ships the V4 supplier source and current safe future headline values", () => {
    const migration = read("supabase/migrations/20260810144000_contract_summary_v4_ratecard.sql");
    expect(migration).toContain("giacom_broadband_ratecard_v4.0");
    expect(migration).toContain("95.00");
    expect(migration).toContain("43.99");
    expect(migration).toContain("58.99");
  });
});
