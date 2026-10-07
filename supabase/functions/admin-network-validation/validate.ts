import { PLAN_CAPS, type SpeedBucket } from "../_shared/networkEvidence.ts";

export type StaffEvidenceInput = {
  technology: string; eligible_plan: string;
  minimum_download_mbps: number; normally_available_download_mbps: number; maximum_download_mbps: number; advertised_download_mbps: number;
  minimum_upload_mbps: number; normally_available_upload_mbps: number; maximum_upload_mbps: number; advertised_upload_mbps: number;
  retrieved_at: string;
};

const MAX_AGE_MS = 30 * 86400_000;
const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 100000;

export function validateStaffEvidence(e: StaffEvidenceInput, selectedPlan: unknown, now: number): { ok: true } | { ok: false; error: string } {
  const nums = [e.minimum_download_mbps, e.normally_available_download_mbps, e.maximum_download_mbps, e.advertised_download_mbps,
    e.minimum_upload_mbps, e.normally_available_upload_mbps, e.maximum_upload_mbps, e.advertised_upload_mbps];
  if (!nums.every(ok)) return { ok: false, error: "speeds_must_be_positive" };
  if (!(e.minimum_download_mbps <= e.normally_available_download_mbps && e.normally_available_download_mbps <= e.maximum_download_mbps)) {
    return { ok: false, error: "download_speeds_incoherent" };
  }
  if (!(e.minimum_upload_mbps <= e.normally_available_upload_mbps && e.normally_available_upload_mbps <= e.maximum_upload_mbps)) {
    return { ok: false, error: "upload_speeds_incoherent" };
  }
  const plan = String(selectedPlan ?? "") as SpeedBucket;
  if (!PLAN_CAPS[plan]) return { ok: false, error: "session_plan_missing" };
  if (e.eligible_plan !== plan) return { ok: false, error: "selected_plan_not_in_evidence" };
  const t = Date.parse(e.retrieved_at);
  if (!Number.isFinite(t)) return { ok: false, error: "retrieved_at_invalid" };
  if (t > now + 5 * 60_000) return { ok: false, error: "retrieved_at_in_future" };
  if (now - t > MAX_AGE_MS) return { ok: false, error: "evidence_stale" };
  return { ok: true };
}
