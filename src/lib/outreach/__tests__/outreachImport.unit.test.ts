import { describe, expect, it } from "vitest";
import { csvToObjects, parseCsv, toCsv } from "../csv";
import { mapImportRow } from "../importMapping";
import { svixSignature, verifySvix } from "../../../../supabase/functions/_shared/svix.ts";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and embedded newlines", () => {
    const csv = '﻿name,notes\r\n"Tom, Jerry & Co","He said ""hi""\nthen left"\r\nPlain,x\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "notes"],
      ["Tom, Jerry & Co", 'He said "hi"\nthen left'],
      ["Plain", "x"],
    ]);
  });

  it("maps rows to lower-cased headers and skips blank lines", () => {
    expect(csvToObjects("Business_Name,Email\nA Ltd,info@a.co.uk\n,\n")).toEqual([{ business_name: "A Ltd", email: "info@a.co.uk" }]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["a", 'b "q"', "c,d"], ["1", "", "line\nbreak"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("mapImportRow", () => {
  const leadListRow = {
    business_name: "Fixby Healthcare Ltd",
    public_email: "Info@FixbyHealthcare.com",
    email_type: "role",
    legal_form_hint: "limited company",
    companies_house_number: "13569061",
    companies_house_match_basis: "exact name + full postcode",
    email_ok_for_cold_b2b: "TRUE",
    priority: "A",
    category: "Care Homes & Social Care",
  };

  it("accepts a verified limited company from the lead list", () => {
    const r = mapImportRow(leadListRow)!;
    expect(r.email).toBe("info@fixbyhealthcare.com");
    expect(r.legal_form).toBe("limited_company");
    expect(r.companies_house_verified).toBe(true);
    expect(r.companies_house_number).toBe("13569061");
    expect(r.priority).toBe("A");
  });

  it("does not verify rows without a valid company number", () => {
    expect(mapImportRow({ ...leadListRow, companies_house_number: "https://www.cqc.org.uk/location/1-1" })!.companies_house_verified).toBe(false);
    expect(mapImportRow({ ...leadListRow, companies_house_number: "" })!.companies_house_verified).toBe(false);
  });

  it("does not verify rows the list did not mark safe", () => {
    expect(mapImportRow({ ...leadListRow, email_ok_for_cold_b2b: "FALSE" })!.companies_house_verified).toBe(false);
  });

  it("keeps unverified legal-form hints unknown", () => {
    expect(mapImportRow({ ...leadListRow, legal_form_hint: "limited company? (name suffix; not verified at Companies House)" })!.legal_form).toBe("unknown");
  });

  it("rejects rows without a usable email or name", () => {
    expect(mapImportRow({ business_name: "X", email: "nope" })).toBeNull();
    expect(mapImportRow({ business_name: " ", email: "info@x.co.uk" })).toBeNull();
  });

  it("accepts Scottish company numbers", () => {
    expect(mapImportRow({ ...leadListRow, companies_house_number: "sc813845" })!.companies_house_number).toBe("SC813845");
  });
});

describe("svix webhook signatures", () => {
  // Published Svix example values.
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const id = "msg_p5jXN8AQM9LWM0D4loKWxJek";
  const timestamp = "1614265330";
  const body = '{"test": 2432232314}';

  it("matches the published example signature", async () => {
    expect(await svixSignature(secret, id, timestamp, body)).toBe("g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
  });

  it("verifies valid signatures and rejects tampering or stale timestamps", async () => {
    const sig = `v1,${await svixSignature(secret, id, timestamp, body)}`;
    const now = Number(timestamp) + 10;
    expect(await verifySvix({ secret, id, timestamp, signatureHeader: `v1,bogus ${sig}`, body, nowSeconds: now })).toBe(true);
    expect(await verifySvix({ secret, id, timestamp, signatureHeader: sig, body: body + " ", nowSeconds: now })).toBe(false);
    expect(await verifySvix({ secret, id: "msg_other", timestamp, signatureHeader: sig, body, nowSeconds: now })).toBe(false);
    expect(await verifySvix({ secret, id, timestamp, signatureHeader: sig, body, nowSeconds: now + 3600 })).toBe(false);
    expect(await verifySvix({ secret: "whsec_!!notbase64", id, timestamp, signatureHeader: sig, body, nowSeconds: now })).toBe(false);
  });
});
