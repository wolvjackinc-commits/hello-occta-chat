import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin Direct Debit next collection uses the shared helpers", () => {
  it("does not keep a private triple-month amount or an unrolled invoice date", () => {
    const email = read("src/components/admin/CustomerSendEmailDialog.tsx");
    const section = read("src/components/admin/CustomerDDSection.tsx");
    for (const src of [email, section]) {
      expect(src).toContain('from "@/lib/dd/nextCollectionAmount"');
      expect(src).toContain('from "@/lib/dd/nextCollectionDate"');
      expect(src).not.toContain("* 3");
      expect(src).not.toContain("setDate");
    }
    expect(read("src/lib/generateDDMandatePdf.ts")).not.toContain("monthly_price_incl_vat");
  });
});
