import { describe, expect, it } from "vitest";
import { contractLabel } from "./contractLabel";

describe("contractLabel", () => {
  it.each([
    [{ plan_name: "Essential Fibre — Price Lock 24", contract_type: "Price Lock 24 — 24 months minimum term." }, "Price Lock 24"],
    [{ plan_name: "Superfast Fibre — Flex 30", contract_type: "Flex 30 — rolling monthly." }, "Flex 30"],
    [{ plan_name: "Flex", contract_type: "30-day rolling. Cancel with 30 days' notice.", minimum_term_months: 30 }, "Flex 30"],
    [{ plan_name: "Contract Saver", contract_type: "12 months minimum term.", minimum_term_months: 12 }, "Contract Saver"],
    [{ plan_name: "BT FTTP 80/20 – Business Fixed 12", contract_type: "Fixed 12 months – paper agreement" }, "Fixed 12 months"],
    [{ plan_name: "Broadband — BTW FTTC 40/10", contract_type: null }, "See your Contract Summary"],
  ])("%o → %s", (row, label) => {
    expect(contractLabel(row)).toBe(label);
  });
});
