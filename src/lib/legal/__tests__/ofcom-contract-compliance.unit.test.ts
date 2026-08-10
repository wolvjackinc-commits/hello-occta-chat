/**
 * Ofcom contract-summary compliance guardrails (GC C1 / Jan 2025).
 * These are static-source assertions: the PDF renderer and acceptance guards
 * live in Deno edge functions, so we assert on their source text rather than
 * importing the Deno runtime into vitest.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const PDF = "supabase/functions/generate-contract-summary-pdf/index.ts";
const TERMS_APP = "src/lib/legal/fullContractTerms.ts";
const TERMS_EDGE = "supabase/functions/_shared/fullContractTerms.ts";
const ACCEPT_PATHS = [
  "supabase/functions/accept-contract-summary/index.ts",
  "supabase/functions/accept-contract-summary-authed/index.ts",
  "supabase/functions/accept-service-aware-cs/index.ts",
];

describe("statutory intro sentences", () => {
  const src = read(PDF);
  const expected = [
    "This contract summary provides the main elements of this service offer as required by EU law.",
    "It helps to make a comparison between service offers.",
    "Complete information about the service is provided in other documents.",
  ];
  it("contains exactly the three prescribed sentences, verbatim, in order", () => {
    const block = src.slice(src.indexOf("CS_STATUTORY_INTRO"), src.indexOf("CS_SECTION_ORDER"));
    const found = expected.map((s) => block.indexOf(s));
    expect(found.every((i) => i >= 0)).toBe(true);
    expect(found).toEqual([...found].sort((a, b) => a - b));
    // no fourth quoted sentence smuggled into the intro block
    const quoted = block.match(/"[^"]{25,}"/g) ?? [];
    expect(quoted.length).toBe(3);
  });
  it("renders the intro only for real contract summaries, not information refreshes", () => {
    expect(src).toMatch(/if \(cs\.is_information_update\)[\s\S]{0,2000}CS_STATUTORY_INTRO/);
  });
});

describe("prescribed section order", () => {
  const src = read(PDF);
  const order = [
    "Services and equipment",
    "Speeds of the internet service and remedies",
    "Price",
    "Duration, renewal and termination",
    "Features for end-users with disabilities",
    "Other relevant information",
  ];
  it("declares the six Ofcom headings in the prescribed order", () => {
    const block = src.slice(src.indexOf("CS_SECTION_ORDER"), src.indexOf("const BODY_PT"));
    const idx = order.map((h) => block.indexOf(h));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
  it("emits sections 1..6 using the declared order array", () => {
    for (let i = 0; i < 6; i++) {
      expect(src).toContain(`section(${i + 1}, CS_SECTION_ORDER[${i}])`);
    }
  });
});

describe("minimum font size", () => {
  const src = read(PDF);
  it("body/label/heading point sizes are all >= 10pt", () => {
    for (const name of ["BODY_PT", "LABEL_PT", "HEADING_PT"]) {
      const m = src.match(new RegExp(`const ${name} = ([0-9.]+)`));
      expect(m, `${name} missing`).toBeTruthy();
      expect(Number(m![1])).toBeGreaterThanOrEqual(10);
    }
  });
  it("no body text is rendered below 10pt (footer excepted)", () => {
    const sizes = [...src.matchAll(/setNormal\(([0-9.]+)\)|textBlock\([^,]+,\s*([0-9.]+)/g)]
      .map((m) => Number(m[1] ?? m[2]))
      .filter((n) => Number.isFinite(n));
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(10);
  });
});

describe("information update hard-block", () => {
  it("every acceptance edge function refuses is_information_update documents", () => {
    for (const p of ACCEPT_PATHS) {
      const src = read(p);
      expect(src, p).toMatch(/is_information_update/);
      expect(src, p).toMatch(/409/);
    }
  });
  it("a DB trigger blocks acceptance at the database layer", () => {
    const dir = path.join(root, "supabase/migrations");
    const sql = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(sql).toMatch(/enforce_information_update_never_accepted/);
    expect(sql).toMatch(/trg_cs_info_update_never_accepted/);
    expect(sql).toMatch(/enforce_acceptance_not_information_update/);
  });
});

describe("UI semantics for information refreshes", () => {
  it("customer portal labels the refresh and requires no reacceptance", () => {
    const src = read("src/components/dashboard/tabs/ContractSummariesTab.tsx");
    expect(src).toContain("Current Contract Information");
    expect(src).toMatch(/no reacceptance required/i);
    expect(src).toContain("is_information_update");
    // download stays available; no accept action on the list
    expect(src).toMatch(/downloadPdf/);
    expect(src).not.toMatch(/Accept Contract Summary/);
  });
  it("customer contract detail view offers no accept action for refreshes", () => {
    const src = read("src/pages/dashboard/ContractSummaryAuthedView.tsx");
    expect(src).toMatch(/cs\?\.is_information_update\)\s*return/);
    expect(src).toMatch(/infoUpdate\s*=\s*!!cs\.is_information_update/);
    expect(src).toMatch(/infoUpdate \?[\s\S]{0,400}For your records/);
  });
  it("admin customer detail selects and labels the flag, not as pending", () => {
    const src = read("src/pages/admin/CustomerDetail.tsx");
    expect(src).toMatch(/select\("id, cs_number, status[^"]*is_information_update/);
    expect(src).toContain("Current Contract Information — information update only / no reacceptance required.");
    expect(src).toMatch(/isInfoUpdate \? "N\/A — information update"/);
  });
});

describe("legal text cleanup (new documents only)", () => {
  const banned: Array<[string, RegExp]> = [
    ["named ADR provider", /Ombudsman Services: Communications/i],
    ["voluntary speeds code membership", /Voluntary Code of Practice on Broadband Speeds/i],
    ["compensation scheme thresholds", /Ofcom Automatic Compensation Scheme/i],
    ["blanket IPv4 promise", /unique public IPv4 address/i],
    ["router ownership promise", /remains your property once delivered/i],
    ["manufacturer warranty free replacement", /free of charge within the manufacturer's warranty period/i],
    ["fixed late fee", /late-payment fee of £5/i],
    ["fixed suspension timing", /suspended after 30 days of non-payment/i],
    ["exact support hours", /09:00–18:00 Monday to Friday/i],
    ["24/7 claim", /24\/7/],
    ["exact liability cap", /total charges you have paid OCCTA for that service in that 12-month period/i],
    ["transparency report claim", /annual transparency report/i],
  ];
  for (const file of [TERMS_APP, TERMS_EDGE]) {
    // Only assert on the customer-facing sections, not the file's own header comments.
    const whole = read(file);
    const src = whole.slice(whole.indexOf("FULL_CONTRACT_SECTIONS"));
    it.each(banned)(`${file} no longer promises %s`, (_label, re) => {
      expect(re.test(src)).toBe(false);
    });
    it(`${file} keeps lawful customer rights`, () => {
      expect(src).toMatch(/Consumer Contracts Regulations 2013/);
      expect(src).toMatch(/Consumer Rights Act 2015/);
      expect(src).toMatch(/Alternative Dispute Resolution/);
      expect(src).toMatch(/One Touch Switch/);
      expect(src).toMatch(/UK GDPR/);
    });
  }
  it("both copies stay in sync on the cleaned sections and version", () => {
    expect(read(TERMS_APP)).toMatch(/FULL_CONTRACT_TERMS_VERSION = "2026-08-a"/);
    expect(read(TERMS_EDGE)).toMatch(/FULL_CONTRACT_TERMS_VERSION = "2026-08-a"/);
  });
});

describe("no supplier / internal cost leakage in customer documents", () => {
  const leaky = /wholesale_cost|supplier_cost|cost_price|margin_pct|margin_amount|internal_margin|buy_price|supplier_products|supplier_profiles/i;
  it("the customer PDF renderer never references internal cost fields", () => {
    expect(leaky.test(read(PDF))).toBe(false);
  });
  it("customer-facing contract terms never reference internal cost fields", () => {
    expect(leaky.test(read(TERMS_APP))).toBe(false);
    expect(leaky.test(read(TERMS_EDGE))).toBe(false);
  });
  it("customer portal contract views never reference internal cost fields", () => {
    expect(leaky.test(read("src/components/dashboard/tabs/ContractSummariesTab.tsx"))).toBe(false);
    expect(leaky.test(read("src/pages/dashboard/ContractSummaryAuthedView.tsx"))).toBe(false);
  });
});

describe("OTP path unchanged", () => {
  it("contract signing still enforces server-side SMS OTP", () => {
    const step = read("src/pages/quote/journey/AgreementStep.tsx");
    expect(step).toMatch(/ContractSmsVerification/);
    const otpUi = read("src/components/contract/ContractSmsVerification.tsx");
    expect(otpUi).toMatch(/send-contract-otp/);
    expect(otpUi).toMatch(/verify-contract-otp/);
    expect(fs.existsSync(path.join(root, "supabase/functions/send-contract-otp/index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(root, "supabase/functions/verify-contract-otp/index.ts"))).toBe(true);
  });
});

describe("admin CustomerDetail treats information updates as records-only", () => {
  const src = () => read("src/pages/admin/CustomerDetail.tsx");
  it("selects is_information_update and supersedes metadata", () => {
    expect(src()).toMatch(/is_information_update, supersedes_id/);
  });
  it("stage logic uses the latest ordinary contractual Contract Summary", () => {
    const s = src();
    expect(s).toMatch(/find\(\(c: any\) => c\?\.is_information_update !== true\)/);
    expect(s).toMatch(/const contractualCs = cs && cs\.is_information_update !== true \? cs : null/);
    expect(s).toMatch(/!contractualCs\s*\n?\s*\?\s*"Quote issued"/);
    expect(s).toMatch(/contractualCs\.status !== "accepted"/);
  });
  it("unified documents label info updates as Current Contract Information", () => {
    expect(src()).toMatch(/is_information_update === true \? "Current Contract Information" : "Contract Summary"/);
  });
  it("info update rows never render a pending Accepted date", () => {
    expect(src()).toMatch(/isInfoUpdate \? "N\/A — information update"/);
  });
});

describe("Customer360Header receives only contractual contract summaries", () => {
  it("the header prop filters out information-update rows before picking newest", () => {
    const s = read("src/pages/admin/CustomerDetail.tsx");
    expect(s).toMatch(
      /cs=\{\(data\?\.contractSummaries \?\? \[\]\)\.find\(\(c: any\) => c\?\.is_information_update !== true\) \?\? null\}/
    );
    expect(s).not.toMatch(/cs=\{\(data\?\.contractSummaries \?\? \[\]\)\[0\]/);
  });
  it("UnifiedDocuments keeps a PDF download for every contract summary row", () => {
    expect(read("src/pages/admin/CustomerDetail.tsx")).toMatch(
      /kind: c\.is_information_update === true \? "Current Contract Information" : "Contract Summary",[\s\S]{0,200}AdminCsDownloadButton csId=\{c\.id\}/
    );
  });
});

describe("authoritative OCCTA support number", () => {
  it("is 0800 260 6626 across contact configuration", () => {
    const c = read("src/lib/constants.ts");
    expect(c).toMatch(/CONTACT_PHONE_DISPLAY = "0800 260 6626"/);
    expect(c).toMatch(/tel:08002606626/);
    expect(c).not.toMatch(/6453/);
  });
});
