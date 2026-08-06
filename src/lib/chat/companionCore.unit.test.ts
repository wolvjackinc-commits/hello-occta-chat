import { describe, expect, it } from "vitest";
import {
  detectAccountIntent,
  detectPublicIntent,
  extractAccountNumber,
  extractDateOfBirth,
  maskAccountNumber,
  redactSensitiveText,
  type CompanionMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";

const messages = (...content: string[]): CompanionMessage[] =>
  content.map((text) => ({ role: "user", content: text }));

describe("OCCTA companion intent routing", () => {
  it("does not mistake a general SIM question for personal account data", () => {
    const conversation = messages("What SIM plans do you offer?");
    expect(detectAccountIntent(conversation)).toBeNull();
    expect(detectPublicIntent(conversation[0].content)).toBe("sim");
  });

  it("recognises personal, logged-in account requests", () => {
    expect(detectAccountIntent(messages("Show my services"))).toBe("services");
    expect(detectAccountIntent(messages("What plan am I on?"))).toBe("services");
    expect(detectAccountIntent(messages("Track my order"))).toBe("orders");
    expect(detectAccountIntent(messages("When is my engineer appointment?"))).toBe("installation");
    expect(detectAccountIntent(messages("Check my latest invoice"))).toBe("invoices");
  });

  it("keeps account intent active across step-by-step verification turns", () => {
    const conversation = messages(
      "Check my account",
      "OCC12345678",
      "15/01/1990",
    );
    expect(detectAccountIntent(conversation)).toBe("overview");
    expect(extractAccountNumber(conversation)).toBe("OCC12345678");
    expect(extractDateOfBirth(conversation)).toBe("1990-01-15");
  });

  it("routes common support questions without requiring the model", () => {
    expect(detectPublicIntent("What do the red router lights mean?"))).toBe("router_lights");
    expect(detectPublicIntent("Flex 30 or Price Lock: which is better?"))).toBe("contract_choice");
    expect(detectPublicIntent("How much broadband speed do I need?"))).toBe("speed_need");
    expect(detectPublicIntent("Can I use an eSIM?"))).toBe("esim");
    expect(detectPublicIntent("Is there a known outage?"))).toBe("service_status");
  });
});

describe("OCCTA companion privacy controls", () => {
  it("masks account numbers in stored and logged text", () => {
    expect(maskAccountNumber("OCC12345678")).toBe("OCC••••5678");
    expect(redactSensitiveText("My account is OCC12345678"))
      .toBe("My account is OCC••••5678");
  });

  it("removes dates of birth and obvious credentials", () => {
    const redacted = redactSensitiveText(
      "DOB 15/01/1990 password: Secret123 pin=4411",
    );
    expect(redacted).toContain("[date of birth provided securely]");
    expect(redacted).not.toContain("15/01/1990");
    expect(redacted).not.toContain("Secret123");
    expect(redacted).not.toContain("4411");
  });

  it("rejects impossible UK and ISO calendar dates", () => {
    expect(extractDateOfBirth(messages("31/02/1990"))).toBeNull();
    expect(extractDateOfBirth(messages("1990-02-31"))).toBeNull();
  });
});
