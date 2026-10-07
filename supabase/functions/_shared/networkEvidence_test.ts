import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContractSpeedMatrix, evidenceSha256, isVerifiedNetworkEvidence } from "./networkEvidence.ts";

const now = Date.parse("2026-10-07T08:00:00Z");
const evidence = {
  evidence_version: "occta-network-evidence-v1",
  source: "OCCTA_VERIFIED_NETWORK_EVIDENCE",
  verified: true,
  retrieved_at: "2026-10-06T10:00:00Z",
  postcode: "HD3 3WU",
  technology: "FTTP",
  eligible_occta_plans: ["essential", "superfast"],
  provider_reference: null,
  speeds: {
    minimum_download_mbps: 200, normally_available_download_mbps: 900, maximum_download_mbps: 1000,
    minimum_upload_mbps: 50, normally_available_upload_mbps: 100, maximum_upload_mbps: 115,
  },
};

Deno.test("absent evidence -> network_validation_required (fail closed)", () => {
  const r = buildContractSpeedMatrix(null, "essential", now);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "network_validation_required");
});

Deno.test("unverified / incomplete evidence rejected", () => {
  assert(!isVerifiedNetworkEvidence({ ...evidence, verified: false }));
  assert(!isVerifiedNetworkEvidence({ ...evidence, speeds: { ...evidence.speeds, minimum_upload_mbps: 0 } }));
  assert(!isVerifiedNetworkEvidence({ ...evidence, source: "SOMETHING_ELSE" }));
});

Deno.test("verified generic evidence produces min/normal/max/advertised matrix capped to plan", () => {
  const r = buildContractSpeedMatrix(evidence, "superfast", now);
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.matrix.technology, "FTTP");
    assertEquals(r.matrix.minimum_download_mbps, 200);
    assertEquals(r.matrix.normally_available_download_mbps, 330);
    assertEquals(r.matrix.maximum_download_mbps, 330);
    assertEquals(r.matrix.advertised_download_mbps, 330);
    assertEquals(r.matrix.advertised_upload_mbps, 50);
  }
});

Deno.test("plan not in verified list or stale evidence rejected", () => {
  assertEquals(buildContractSpeedMatrix(evidence, "gigabit", now).ok, false);
  assertEquals(buildContractSpeedMatrix(evidence, "essential", now + 40 * 86400_000).ok, false);
});

Deno.test("evidence hash is stable sha256 hex", async () => {
  const h = await evidenceSha256(evidence);
  assert(/^[0-9a-f]{64}$/.test(h));
  assertEquals(h, await evidenceSha256(evidence));
});
