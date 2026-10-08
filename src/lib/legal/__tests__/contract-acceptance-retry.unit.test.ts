import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
describe("contract acceptance retry safety", () => {
  it("checks accepted state before OTP replay validation", () => {
    const src = read("supabase/functions/accept-contract-summary/index.ts");
    expect(src.indexOf("Idempotency: already accepted")).toBeGreaterThan(-1);
    expect(src.indexOf("Idempotency: already accepted")).toBeLessThan(src.indexOf("Independent server-side SMS OTP gate"));
  });
  it("recovers UI from committed acceptance after response loss", () => {
    const src = read("src/pages/quote/journey/AgreementStep.tsx");
    expect(src).toContain("const recovered = await loadDetail()");
    expect(src).toContain("recovered?.accepted_at");
  });
  it("does not mutate append-only acceptance evidence in post-contract handoff", () => {
    const src = read("supabase/functions/journey2-apply-postcontract/index.ts");
    expect(src).not.toMatch(/from\("contract_acceptances"\)\s*\n\s*\.update/);
    expect(src).toContain("contract_acceptance_id: journey.contract_acceptance_id");
  });
});
