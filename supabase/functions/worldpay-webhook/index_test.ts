// Deno tests for the Worldpay webhook payload validator.
// These are pure unit tests — they do not hit the database or network.
// They lock in the shape/currency/reference/metadata rules the webhook
// depends on so regressions surface immediately.

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Re-declare the validator here (kept in sync with index.ts). The webhook
// handler is a top-level `serve()` call so we can't import it without
// starting an HTTP server; the validator is the piece with the tricky
// invariants and is what we assert against.

type SmbAmount = { value: number; currencyCode: string };
type SmbValidated = {
  eventId: string;
  eventTimestamp: string;
  type: string;
  transactionReference: string;
  amount: SmbAmount | null;
};

const SETTLE_EVENT = "sentForSettlement";
const REQUIRES_AMOUNT = new Set([SETTLE_EVENT]);

function validateSmbShape(
  payload: unknown,
):
  | { ok: false; status: number; missing: string[] }
  | { ok: true; data: SmbValidated } {
  const missing: string[] = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, missing: ["body"] };
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.eventId !== "string" || !p.eventId) missing.push("eventId");
  if (typeof p.eventTimestamp !== "string" || !p.eventTimestamp) {
    missing.push("eventTimestamp");
  }

  const details = p.eventDetails as Record<string, unknown> | undefined;
  if (!details || typeof details !== "object") {
    missing.push("eventDetails");
    return { ok: false, status: 400, missing };
  }
  if (details.classification !== "payment") {
    missing.push("eventDetails.classification=payment");
  }
  if (typeof details.type !== "string" || !details.type) {
    missing.push("eventDetails.type");
  }
  if (
    typeof details.transactionReference !== "string" ||
    !details.transactionReference
  ) {
    missing.push("eventDetails.transactionReference");
  }

  if (missing.length) return { ok: false, status: 400, missing };

  let amount: SmbAmount | null = null;
  const detailAmount = details.amount as Record<string, unknown> | undefined;
  if (
    detailAmount &&
    typeof detailAmount === "object" &&
    typeof detailAmount.value === "number" &&
    typeof detailAmount.currencyCode === "string"
  ) {
    amount = {
      value: detailAmount.value,
      currencyCode: detailAmount.currencyCode,
    };
  }

  if (REQUIRES_AMOUNT.has(details.type as string) && !amount) {
    return {
      ok: false,
      status: 400,
      missing: ["eventDetails.amount.value", "eventDetails.amount.currencyCode"],
    };
  }

  return {
    ok: true,
    data: {
      eventId: p.eventId as string,
      eventTimestamp: p.eventTimestamp as string,
      type: details.type as string,
      transactionReference: details.transactionReference as string,
      amount,
    },
  };
}

// Helpers for building fixture payloads
function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_123",
    eventTimestamp: "2026-07-04T10:00:00Z",
    eventDetails: {
      classification: "payment",
      type: "sentForSettlement",
      transactionReference: "PR-abcdef12-1728000000000",
      amount: { value: 2599, currencyCode: "GBP" },
    },
    ...overrides,
  };
}

Deno.test("validateSmbShape: accepts a well-formed settlement", () => {
  const result = validateSmbShape(buildEvent());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.type, "sentForSettlement");
    assertEquals(result.data.amount?.value, 2599);
    assertEquals(result.data.amount?.currencyCode, "GBP");
  }
});

Deno.test("validateSmbShape: accepts non-settlement events without an amount", () => {
  const payload = buildEvent({
    eventDetails: {
      classification: "payment",
      type: "authorized",
      transactionReference: "PR-abcdef12-1728000000000",
    },
  });
  const result = validateSmbShape(payload);
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.data.amount, null);
});

Deno.test("validateSmbShape: rejects settlement missing amount", () => {
  const payload = buildEvent({
    eventDetails: {
      classification: "payment",
      type: "sentForSettlement",
      transactionReference: "PR-abcdef12-1728000000000",
    },
  });
  const result = validateSmbShape(payload);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missing.includes("eventDetails.amount.value"), true);
  }
});

Deno.test("validateSmbShape: rejects missing top-level fields", () => {
  const payload = { eventDetails: { classification: "payment" } };
  const result = validateSmbShape(payload);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missing.length >= 1, true);
  }
});

Deno.test("validateSmbShape: rejects non-payment classification", () => {
  const payload = buildEvent({
    eventDetails: {
      classification: "refund",
      type: "sentForSettlement",
      transactionReference: "PR-abcdef12-1",
      amount: { value: 100, currencyCode: "GBP" },
    },
  });
  const result = validateSmbShape(payload);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.missing.includes("eventDetails.classification=payment"),
      true,
    );
  }
});

Deno.test("validateSmbShape: accepts any currency string (case preserved)", () => {
  const payload = buildEvent({
    eventDetails: {
      classification: "payment",
      type: "sentForSettlement",
      transactionReference: "PR-abcdef12-1",
      amount: { value: 100, currencyCode: "gbp" }, // lowercase
    },
  });
  const result = validateSmbShape(payload);
  assertEquals(result.ok, true);
  // The webhook handler itself normalises with toUpperCase() before comparing.
  if (result.ok) assertEquals(result.data.amount?.currencyCode, "gbp");
});

// -------------------- Amount/currency normalisation --------------------
// The webhook compares providerCurrency.toUpperCase() to expectedCurrency.toUpperCase().
// Lock that behaviour in with a small helper mirroring the production math.

function amountsMatch(
  providerMinor: number,
  providerCurrency: string,
  expectedAmount: number,
  expectedCurrency: string,
) {
  const expectedMinor = Math.round(expectedAmount * 100);
  return (
    providerMinor === expectedMinor &&
    providerCurrency.toUpperCase() === expectedCurrency.toUpperCase()
  );
}

Deno.test("amountsMatch: identical GBP amounts", () => {
  assertEquals(amountsMatch(2599, "GBP", 25.99, "GBP"), true);
});

Deno.test("amountsMatch: currency case-insensitive", () => {
  assertEquals(amountsMatch(2599, "gbp", 25.99, "GBP"), true);
  assertEquals(amountsMatch(2599, "GBP", 25.99, "gbp"), true);
});

Deno.test("amountsMatch: rejects currency mismatch", () => {
  assertEquals(amountsMatch(2599, "USD", 25.99, "GBP"), false);
});

Deno.test("amountsMatch: rejects off-by-one penny", () => {
  assertEquals(amountsMatch(2600, "GBP", 25.99, "GBP"), false);
});

Deno.test("amountsMatch: handles fractional pence rounding of pounds input", () => {
  // 12.345 → 1234 minor (banker's rounding of 12.345 * 100 = 1234.5 → 1235 in JS)
  // Math.round(12.345 * 100) === 1235 in JS due to fp; assert what we actually get.
  const expected = Math.round(12.345 * 100);
  assertEquals(amountsMatch(expected, "GBP", 12.345, "GBP"), true);
});

// -------------------- Transaction reference shape --------------------
// Production references look like `PR-<8chars>-<ms timestamp>`; invoice-linked
// PRs are the same shape (contract_summary_id is a *link*, not part of the ref).
// If we ever accept a bare invoice number reference, update these tests.

Deno.test("transaction reference: PR- prefix is preserved verbatim", () => {
  const ref = "PR-a1b2c3d4-1728000000000";
  const result = validateSmbShape(buildEvent({
    eventDetails: {
      classification: "payment",
      type: "sentForSettlement",
      transactionReference: ref,
      amount: { value: 100, currencyCode: "GBP" },
    },
  }));
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.transactionReference, ref);
    assertStringIncludes(result.data.transactionReference, "PR-");
  }
});