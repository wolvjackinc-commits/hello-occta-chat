import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContractSpeedMatrix } from "./networkEvidence.ts";
import { derivePlanEstimateBucket, manualExitBasis, planEstimatePatch, sendReadinessBlockers, validateCustomerServiceDate } from "./manualQuoteContract.ts";

const alan = {
  customer_type: "residential", service_type: "broadband", plan_type: "flex", plan_name: "Flex",
  estimated_download_speed: 80, estimated_upload_speed: 20, speed_bucket: null, plan_term: null,
  cease_fee_gross: null, contract_length_months: null, notice_period: "30 days",
};

Deno.test("80/20 maps to essential plan estimate; other speeds do not", () => {
  assertEquals(derivePlanEstimateBucket(80, 20), "essential");
  assertEquals(derivePlanEstimateBucket(75, 20), null);
  assertEquals(derivePlanEstimateBucket(null, null), null);
});

Deno.test("plan estimate patch is labelled estimate, hashed, and passes the gate", async () => {
  const p = await planEstimatePatch(alan, "AB1 2CD");
  assert(p);
  assertEquals(p.speed_bucket, "essential");
  assert(/^[0-9a-f]{64}$/.test(String(p.supplier_availability_sha256)));
  const g = buildContractSpeedMatrix(p.supplier_availability_snapshot, p.speed_bucket);
  assert(g.ok && g.matrix.basis === "occta_plan_estimate");
  assertEquals((p.supplier_availability_snapshot as any).verified, false);
});

Deno.test("flex consumer without fixed cease fee uses benchmark capped wording; fixed term stays blocked", () => {
  assertEquals(manualExitBasis(alan), "benchmark_capped_flex");
  assertEquals(manualExitBasis({ ...alan, plan_type: "contract_saver", contract_length_months: 24 }), null);
  assertEquals(manualExitBasis({ ...alan, cease_fee_gross: 50 }), "fixed_fee");
});

Deno.test("send readiness: Alan's quote is sendable; unmatched speeds are blocked", () => {
  assertEquals(sendReadinessBlockers(alan), []);
  const b = sendReadinessBlockers({ ...alan, estimated_download_speed: 67 });
  assertEquals(b.map((x) => x.code), ["speed_basis_missing"]);
});

Deno.test("customer service date must be 1..90 days ahead", () => {
  const now = new Date("2026-11-02T16:00:00Z");
  assertEquals(validateCustomerServiceDate("2026-11-02", now), null);
  assertEquals(validateCustomerServiceDate("2026-11-03", now), "2026-11-03");
  assertEquals(validateCustomerServiceDate("2027-02-01", now), null);
  assertEquals(validateCustomerServiceDate("2026-02-30", now), null);
});

import { offerConsistencyBlockers } from "./manualQuoteContract.ts";

Deno.test("placeholder link text in notes blocks sending", () => {
  const b = offerConsistencyBlockers({ monthly_gross: 42.98, customer_notes: "Use [INSERT YOUR SECURE OCCTA QUOTATION LINK]" });
  if (!b.some((x) => x.code === "placeholder_text")) throw new Error("expected placeholder_text");
});

Deno.test("notes quoting £42.98/month on a £37.99 quote block sending", () => {
  const b = offerConsistencyBlockers({ monthly_gross: 37.99, customer_notes: "Total £42.98 per month including router" });
  if (!b.some((x) => x.code === "monthly_price_mismatch")) throw new Error("expected mismatch");
});

Deno.test("notes matching the headline monthly price pass", () => {
  const b = offerConsistencyBlockers({ monthly_gross: 42.98, customer_notes: "Total £42.98/month. Max charge £114 including VAT." });
  if (b.length) throw new Error(JSON.stringify(b));
});
