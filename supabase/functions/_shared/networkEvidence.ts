/**
 * Supplier-neutral network evidence.
 *
 * OCCTA no longer runs a live supplier availability feed. A postal address is
 * captured first and the session sits in `pending` network validation. Staff
 * (or whichever current supplier process OCCTA uses) then record a VERIFIED
 * evidence object in this generic shape. Binding broadband documents can only
 * be produced from a valid object — speeds are never guessed.
 */

export type SpeedBucket = "essential" | "superfast" | "ultrafast" | "gigabit";

export const NETWORK_EVIDENCE_VERSION = "occta-network-evidence-v1" as const;
export const NETWORK_EVIDENCE_SOURCE = "OCCTA_VERIFIED_NETWORK_EVIDENCE" as const;

export type NetworkEvidence = {
  evidence_version: typeof NETWORK_EVIDENCE_VERSION;
  source: typeof NETWORK_EVIDENCE_SOURCE;
  verified: true;
  retrieved_at: string;
  postcode: string;
  technology: string;
  eligible_occta_plans: SpeedBucket[];
  provider_reference: string | null;
  speeds: {
    minimum_download_mbps: number;
    normally_available_download_mbps: number;
    maximum_download_mbps: number;
    minimum_upload_mbps: number;
    normally_available_upload_mbps: number;
    maximum_upload_mbps: number;
  };
};

export type ContractSpeedMatrix = {
  source: "OCCTA_VERIFIED_NETWORK_EVIDENCE_PLUS_OCCTA_PRODUCT_CAP";
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

export const PLAN_CAPS: Record<SpeedBucket, { download: number; upload: number }> = {
  essential: { download: 80, upload: 20 },
  superfast: { download: 330, upload: 50 },
  ultrafast: { download: 550, upload: 75 },
  gigabit: { download: 1000, upload: 115 },
};

const PLAN_MIN_LINE: Record<SpeedBucket, number> = {
  essential: 1,
  superfast: 160,
  ultrafast: 500,
  gigabit: 900,
};

const MAX_AGE_MS = 30 * 86400_000;

function pos(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

/** True only for a complete, verified, supplier-neutral evidence object. */
export function isVerifiedNetworkEvidence(e: unknown): e is NetworkEvidence {
  const x = e as NetworkEvidence | null;
  if (!x || typeof x !== "object") return false;
  if (x.evidence_version !== NETWORK_EVIDENCE_VERSION || x.source !== NETWORK_EVIDENCE_SOURCE || x.verified !== true) return false;
  if (!x.technology || !Array.isArray(x.eligible_occta_plans) || !x.speeds) return false;
  const s = x.speeds;
  return [s.minimum_download_mbps, s.normally_available_download_mbps, s.maximum_download_mbps,
    s.minimum_upload_mbps, s.normally_available_upload_mbps, s.maximum_upload_mbps].every((v) => pos(v) != null);
}

export function buildContractSpeedMatrix(
  evidence: unknown,
  bucket: unknown,
  now: number = Date.now(),
): { ok: true; matrix: ContractSpeedMatrix } | { ok: false; error: string } {
  if (!isVerifiedNetworkEvidence(evidence)) return { ok: false, error: "network_validation_required" };
  const e = evidence;
  const b = String(bucket ?? "") as SpeedBucket;
  if (!PLAN_CAPS[b] || !e.eligible_occta_plans.includes(b)) {
    return { ok: false, error: "selected_plan_not_verified_available" };
  }
  const age = now - new Date(e.retrieved_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return { ok: false, error: "network_evidence_stale" };
  const s = e.speeds;
  if (s.maximum_download_mbps < PLAN_MIN_LINE[b]) return { ok: false, error: "network_speed_below_selected_plan" };
  if (s.minimum_download_mbps > s.maximum_download_mbps || s.minimum_upload_mbps > s.maximum_upload_mbps) {
    return { ok: false, error: "network_speed_matrix_inconsistent" };
  }
  const cap = PLAN_CAPS[b];
  return {
    ok: true,
    matrix: {
      source: "OCCTA_VERIFIED_NETWORK_EVIDENCE_PLUS_OCCTA_PRODUCT_CAP",
      source_retrieved_at: e.retrieved_at,
      technology: e.technology,
      minimum_download_mbps: Math.min(s.minimum_download_mbps, cap.download),
      normally_available_download_mbps: Math.min(s.normally_available_download_mbps, cap.download),
      maximum_download_mbps: Math.min(s.maximum_download_mbps, cap.download),
      advertised_download_mbps: cap.download,
      minimum_upload_mbps: Math.min(s.minimum_upload_mbps, cap.upload),
      normally_available_upload_mbps: Math.min(s.normally_available_upload_mbps, cap.upload),
      maximum_upload_mbps: Math.min(s.maximum_upload_mbps, cap.upload),
      advertised_upload_mbps: cap.upload,
      derivation: "Verified address-specific network evidence, capped to the selected OCCTA retail product's advertised speed.",
    },
  };
}

export async function evidenceSha256(evidence: unknown): Promise<string> {
  const input = typeof evidence === "string" ? evidence : JSON.stringify(evidence);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
