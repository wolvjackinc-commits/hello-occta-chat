/**
 * Supplier-neutral network validation evidence for OCCTA broadband contracts.
 *
 * This module deliberately contains no supplier API integration. A broadband
 * contract may use only structured evidence recorded by an authorised OCCTA
 * operator from the current network/wholesale source being used at the time.
 *
 * Historical accepted evidence is never rewritten.
 */

export type SpeedBucket = "essential" | "superfast" | "ultrafast" | "gigabit";

export type ContractSpeedMatrix = {
  source: "VERIFIED_NETWORK_EVIDENCE";
  source_retrieved_at: string;
  technology: string;
  minimum_download_mbps: number;
  normally_available_download_mbps: number;
  maximum_download_mbps: number;
  advertised_download_mbps: number;
  minimum_upload_mbps: number;
  normally_available_upload_mbps: number;
  maximum_upload_mbps: number;
  advertised_upload_mbps: number;
  derivation: string;
};

export type VerifiedNetworkEvidence = {
  evidence_version: "network-validation-v1";
  source: string;
  source_reference: string | null;
  verified_exact_address: true;
  retrieved_at: string;
  postcode: string;
  address_reference: string | null;
  primary_technology: string;
  eligible_occta_plans: SpeedBucket[];
  plan_speed_matrices: Partial<Record<SpeedBucket, {
    minimum_download_mbps: number;
    normally_available_download_mbps: number;
    maximum_download_mbps: number;
    advertised_download_mbps: number;
    minimum_upload_mbps: number;
    normally_available_upload_mbps: number;
    maximum_upload_mbps: number;
    advertised_upload_mbps: number;
  }>>;
  verified_by?: string | null;
};

const PLAN_CAPS: Record<SpeedBucket, { download: number; upload: number }> = {
  essential: { download: 80, upload: 20 },
  superfast: { download: 330, upload: 50 },
  ultrafast: { download: 550, upload: 75 },
  gigabit: { download: 1000, upload: 115 },
};

function positive(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sourceAllowed(source: unknown): boolean {
  return String(source ?? "").trim().length > 0;
}

export function buildContractSpeedMatrix(
  evidence: unknown,
  bucket: unknown,
): { ok: true; matrix: ContractSpeedMatrix } | { ok: false; error: string } {
  const e = evidence as VerifiedNetworkEvidence | null;
  const b = String(bucket ?? "") as SpeedBucket;

  if (
    !e ||
    e.evidence_version !== "network-validation-v1" ||
    e.verified_exact_address !== true ||
    !sourceAllowed(e.source)
  ) {
    return { ok: false, error: "verified_network_evidence_missing" };
  }

  if (!PLAN_CAPS[b] || !e.eligible_occta_plans?.includes(b)) {
    return { ok: false, error: "selected_plan_not_verified_available" };
  }

  const age = Date.now() - new Date(e.retrieved_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 30 * 86400_000) {
    return { ok: false, error: "network_evidence_stale" };
  }

  const m = e.plan_speed_matrices?.[b];
  if (!m) return { ok: false, error: "network_speed_matrix_missing" };

  const minD = positive(m.minimum_download_mbps);
  const normalD = positive(m.normally_available_download_mbps);
  const maxD = positive(m.maximum_download_mbps);
  const advD = positive(m.advertised_download_mbps);
  const minU = positive(m.minimum_upload_mbps);
  const normalU = positive(m.normally_available_upload_mbps);
  const maxU = positive(m.maximum_upload_mbps);
  const advU = positive(m.advertised_upload_mbps);
  if ([minD, normalD, maxD, advD, minU, normalU, maxU, advU].some((v) => v == null)) {
    return { ok: false, error: "network_speed_matrix_incomplete" };
  }

  if (!(Number(minD) <= Number(normalD) && Number(normalD) <= Number(maxD))) {
    return { ok: false, error: "network_download_speed_order_invalid" };
  }
  if (!(Number(minU) <= Number(normalU) && Number(normalU) <= Number(maxU))) {
    return { ok: false, error: "network_upload_speed_order_invalid" };
  }

  const cap = PLAN_CAPS[b];
  if (Number(advD) > cap.download || Number(advU) > cap.upload) {
    return { ok: false, error: "advertised_speed_exceeds_occta_plan" };
  }

  return {
    ok: true,
    matrix: {
      source: "VERIFIED_NETWORK_EVIDENCE",
      source_retrieved_at: e.retrieved_at,
      technology: String(e.primary_technology ?? "").trim(),
      minimum_download_mbps: Number(minD),
      normally_available_download_mbps: Number(normalD),
      maximum_download_mbps: Number(maxD),
      advertised_download_mbps: Number(advD),
      minimum_upload_mbps: Number(minU),
      normally_available_upload_mbps: Number(normalU),
      maximum_upload_mbps: Number(maxU),
      advertised_upload_mbps: Number(advU),
      derivation: "Verified exact-address network evidence recorded by OCCTA and capped by the selected OCCTA retail plan.",
    },
  };
}

export async function evidenceSha256(evidence: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(evidence));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
