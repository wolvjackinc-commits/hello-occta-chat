import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateStaffEvidence } from "./validate.ts";
import { buildContractSpeedMatrix, evidenceSha256, NETWORK_EVIDENCE_SOURCE, NETWORK_EVIDENCE_VERSION } from "../_shared/networkEvidence.ts";

const now = Date.parse("2026-10-07T09:00:00Z");
const base = {
  technology: "FTTP", eligible_plan: "superfast",
  minimum_download_mbps: 200, normally_available_download_mbps: 300, maximum_download_mbps: 330, advertised_download_mbps: 330,
  minimum_upload_mbps: 30, normally_available_upload_mbps: 45, maximum_upload_mbps: 50, advertised_upload_mbps: 50,
  retrieved_at: "2026-10-07T08:00:00Z",
};

Deno.test("valid evidence accepted", () => assertEquals(validateStaffEvidence(base, "superfast", now).ok, true));
Deno.test("zero/negative speed rejected", () => {
  const r = validateStaffEvidence({ ...base, minimum_upload_mbps: 0 }, "superfast", now);
  assertEquals(r.ok ? "" : r.error, "speeds_must_be_positive");
});
Deno.test("min>normal rejected", () => {
  const r = validateStaffEvidence({ ...base, minimum_download_mbps: 310 }, "superfast", now);
  assertEquals(r.ok ? "" : r.error, "download_speeds_incoherent");
});
Deno.test("plan mismatch rejected", () => {
  const r = validateStaffEvidence(base, "gigabit", now);
  assertEquals(r.ok ? "" : r.error, "selected_plan_not_in_evidence");
});
Deno.test("stale and future evidence rejected", () => {
  assertEquals(validateStaffEvidence({ ...base, retrieved_at: "2026-08-01T00:00:00Z" }, "superfast", now).ok, false);
  assertEquals(validateStaffEvidence({ ...base, retrieved_at: "2026-10-08T00:00:00Z" }, "superfast", now).ok, false);
});
Deno.test("validated evidence passes the contract gate with server hash", async () => {
  const ev = {
    evidence_version: NETWORK_EVIDENCE_VERSION, source: NETWORK_EVIDENCE_SOURCE, verified: true as const,
    retrieved_at: base.retrieved_at, postcode: "HD3 3WU", technology: "FTTP", eligible_occta_plans: ["superfast" as const],
    provider_reference: null, speeds: {
      minimum_download_mbps: 200, normally_available_download_mbps: 300, maximum_download_mbps: 330,
      minimum_upload_mbps: 30, normally_available_upload_mbps: 45, maximum_upload_mbps: 50,
    },
  };
  assertEquals(buildContractSpeedMatrix(ev, "superfast", now).ok, true);
  assertEquals((await evidenceSha256(ev)).length, 64);
});
