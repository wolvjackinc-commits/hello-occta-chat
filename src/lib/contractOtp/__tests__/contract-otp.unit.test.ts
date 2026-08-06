import { describe, it, expect } from "vitest";
import { normaliseUkMobile, maskMobile } from "../../../../supabase/functions/_shared/otpPhone";

describe("UK mobile normalisation for SMS OTP", () => {
  it("accepts common UK formats and normalises to 44 digits only", () => {
    for (const input of ["07900123456", "+447900123456", "447900123456", "07900 123 456", "0044 7900123456"]) {
      expect(normaliseUkMobile(input)).toBe("447900123456");
    }
  });

  it("never returns a leading + or 00", () => {
    const n = normaliseUkMobile("+447900123456")!;
    expect(n.startsWith("44")).toBe(true);
    expect(/^\d+$/.test(n)).toBe(true);
  });

  it("rejects invalid or non-mobile numbers", () => {
    for (const bad of ["", null, undefined, "01234567890", "0790012345", "0790012345678", "447012345678", "abc"]) {
      expect(normaliseUkMobile(bad as string)).toBeNull();
    }
  });

  it("masks to the last four digits only", () => {
    expect(maskMobile("447900123456")).toBe("******3456");
  });
});

describe("OTP provider contract", () => {
  it("uses the official endpoints and the exact passcode placeholder", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile("supabase/functions/_shared/contractOtp.ts", "utf8"),
    );
    expect(src).toContain("https://api.thesmsworks.co.uk/v1/otp/send");
    expect(src).toContain("https://api.thesmsworks.co.uk/v1/otp/verify");
    expect(src).toContain("{{passcode}}");
    expect(src).toContain('Deno.env.get("SMS_WORKS_JWT")');
  });

  it("keeps the SMS template GSM-safe and under 160 characters", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile("supabase/functions/_shared/contractOtp.ts", "utf8"),
    );
    const m = src.match(/OTP_TEMPLATE\s*=\s*\n?\s*"([^"]+)"/);
    expect(m).toBeTruthy();
    const template = m![1];
    expect(template.length).toBeLessThan(160);
    expect(/^[\w\s.,'{}/?!:;()+\-@$&#%=*<>"\[\]]+$/.test(template)).toBe(true);
  });

  it("never stores the passcode or the full mobile number", async () => {
    const fs = await import("node:fs/promises");
    for (const f of [
      "supabase/functions/send-contract-otp/index.ts",
      "supabase/functions/verify-contract-otp/index.ts",
    ]) {
      const src = await fs.readFile(f, "utf8");
      expect(src).not.toMatch(/insert\([^)]*passcode/s);
      expect(src).not.toMatch(/console\.\w+\([^)]*passcode/);
      expect(src).not.toMatch(/phone_full|full_number/);
    }
  });

  it("does not leak the provider JWT to the browser", async () => {
    const fs = await import("node:fs/promises");
    const front = await fs.readFile("src/components/contract/ContractSmsVerification.tsx", "utf8");
    expect(front).not.toMatch(/SMS_WORKS_JWT|thesmsworks/i);
  });
});

describe("server-side signing enforcement", () => {
  it("accept-contract-summary independently requires a verified challenge", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile("supabase/functions/accept-contract-summary/index.ts", "utf8"),
    );
    expect(src).toContain("requireVerifiedOtp");
    expect(src).toContain("consumeOtpChallenge");
  });

  it("challenge lookup is scoped by journey, order reference, phone hash and consumption", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile("supabase/functions/_shared/contractOtp.ts", "utf8"),
    );
    for (const guard of [
      'eq("session_or_order_reference"',
      'eq("journey_type"',
      'eq("phone_hash"',
      'is("consumed_at", null)',
      'not("verified_at", "is", null)',
    ]) {
      expect(src).toContain(guard);
    }
  });
});