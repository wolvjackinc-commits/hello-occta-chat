import { describe, expect, it } from "vitest";
import { consumerContractReleaseBlock, CONSUMER_CONTRACT_VERSION } from "../../../../supabase/functions/_shared/consumerContractRelease";
import { readFileSync } from "node:fs";

describe("consumer contract release pause", () => {
  it.each(["residential", "consumer", null, undefined, "", "BUSINESS"])(
    "fails closed for stored classification %s", (kind) => {
      expect(consumerContractReleaseBlock(kind)?.error).toBe("consumer_contract_issuance_paused");
    },
  );
  it("keeps the separate business path unchanged", () => {
    expect(consumerContractReleaseBlock("business")).toBeNull();
  });
  it("identifies the target version without treating it as release approval", () => {
    expect(CONSUMER_CONTRACT_VERSION).toBe("2026.10.1");
    expect(consumerContractReleaseBlock("residential")?.blockers).toContain("verified_fixed_broadband_speed_matrix");
  });
  it.each(["accept-contract-summary", "accept-service-aware-cs"])(
    "%s gates new acceptance after handling historical accepted records", (endpoint) => {
      const source = readFileSync(`supabase/functions/${endpoint}/index.ts`, "utf8");
      const gate = source.indexOf("consumerContractReleaseBlock(cs.customer_type)");
      expect(gate).toBeGreaterThan(source.indexOf('cs.status === "accepted"'));
      expect(gate).toBeLessThan(source.indexOf('.from("contract_acceptances").insert'));
    },
  );
  it("returns stored PDFs and refuses replacement evidence before new rendering", () => {
    const source = readFileSync("supabase/functions/generate-contract-summary-pdf/index.ts", "utf8");
    const gate = source.indexOf("consumerContractReleaseBlock(cs.customer_type)");
    expect(gate).toBeGreaterThan(source.indexOf("if (storageKey)"));
    expect(gate).toBeGreaterThan(source.indexOf("accepted_cs_missing_pdf"));
    expect(gate).toBeLessThan(source.indexOf("const bytes = renderPdf(cs)"));
  });
});
