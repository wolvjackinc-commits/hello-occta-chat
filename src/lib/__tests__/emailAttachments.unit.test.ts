import { describe, expect, it } from "vitest";
import {
  parseAttachmentRefs,
  safeFilename,
  toBase64,
  resolveAttachments,
  MAX_ATTACHMENTS,
} from "../../../supabase/functions/_shared/emailAttachments";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

describe("parseAttachmentRefs", () => {
  it("accepts none", () => {
    expect(parseAttachmentRefs(undefined)).toEqual({ refs: [] });
  });
  it("accepts invoices and files, de-duplicated", () => {
    const r = parseAttachmentRefs([
      { kind: "invoice", invoice_id: ID1 },
      { kind: "invoice", invoice_id: ID1 },
      { kind: "user_file", user_file_id: ID2 },
    ]);
    expect(r).toEqual({ refs: [{ kind: "invoice", invoice_id: ID1 }, { kind: "user_file", user_file_id: ID2 }] });
  });
  it("rejects raw paths, bytes or bad ids", () => {
    expect("error" in parseAttachmentRefs([{ kind: "user_file", path: "x/y.pdf" }])).toBe(true);
    expect("error" in parseAttachmentRefs([{ kind: "invoice", invoice_id: "../../etc" }])).toBe(true);
    expect("error" in parseAttachmentRefs("nope")).toBe(true);
  });
  it("caps the count", () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ({
      kind: "invoice",
      invoice_id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
    }));
    expect("error" in parseAttachmentRefs(many)).toBe(true);
  });
});

describe("safeFilename", () => {
  it("drops paths and unsafe characters", () => {
    expect(safeFilename("../../a<b>.pdf", "x")).toBe("ab.pdf");
    expect(safeFilename("", "fallback.pdf")).toBe("fallback.pdf");
  });
});

describe("toBase64", () => {
  it("encodes bytes", () => {
    expect(toBase64(new TextEncoder().encode("hello"))).toBe("aGVsbG8=");
  });
});

function fakeSupabase(rows: Record<string, any>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: rows[`${table}:${id}`] ?? null }) }),
      }),
    }),
    storage: {
      from: () => ({
        download: async () => ({ data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }, error: null }),
      }),
    },
  };
}

describe("resolveAttachments", () => {
  it("loads the customer's own invoice PDF", async () => {
    const sb = fakeSupabase({ [`invoices:${ID1}`]: { id: ID1, user_id: CUSTOMER, invoice_number: "INV-1", pdf_storage_key: "k" } });
    const out = await resolveAttachments(sb, CUSTOMER, [{ kind: "invoice", invoice_id: ID1 }]);
    expect(out[0]).toMatchObject({ filename: "OCCTA invoice INV-1.pdf", contentType: "application/pdf", bytes: 3 });
  });
  it("refuses another customer's file", async () => {
    const sb = fakeSupabase({ [`user_files:${ID2}`]: { id: ID2, user_id: ID1, file_name: "a.pdf", file_path: "p" } });
    await expect(resolveAttachments(sb, CUSTOMER, [{ kind: "user_file", user_file_id: ID2 }])).rejects.toThrow(/doesn't belong/);
  });
  it("refuses an invoice without a PDF", async () => {
    const sb = fakeSupabase({ [`invoices:${ID1}`]: { id: ID1, user_id: CUSTOMER, invoice_number: "INV-2", pdf_storage_key: null } });
    await expect(resolveAttachments(sb, CUSTOMER, [{ kind: "invoice", invoice_id: ID1 }])).rejects.toThrow(/no PDF/);
  });
});
