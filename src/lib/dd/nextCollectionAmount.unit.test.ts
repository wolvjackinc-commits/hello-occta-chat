import { describe, expect, it } from "vitest";
import { nextCollectionAmount } from "./nextCollectionAmount";

describe("next collection amount", () => {
  it("uses one month unless the payment schedule explicitly says quarterly", () => {
    expect(nextCollectionAmount({
      monthlyPriceInclVat: 10,
      contractLength: "Flex 30 — 30-day rolling",
      billingMode: "fixed_day",
      paymentTermsDays: 14,
      paymentSchedule: "Monthly service is then billed in advance on your agreed billing date.",
    })).toBe(10);

    expect(nextCollectionAmount({
      monthlyPriceInclVat: 10,
      paymentSchedule: "Service is billed quarterly in advance.",
    })).toBe(30);
  });
});
