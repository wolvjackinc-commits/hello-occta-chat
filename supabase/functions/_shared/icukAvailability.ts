/**
 * Production ICUK exact-address availability helpers.
 *
 * IMPORTANT:
 * - ICUK LIVE must be reached through OCCTA's own fixed/static-IP backend.
 * - Never call postcode-only availability as the final orderability decision.
 * - Never fabricate supplier speeds or treat Swagger/example values as evidence.
 * - The exact ICUK address object returned by /broadband/address/{postcode}
 *   is the object sent to /broadband/availability.
 */

export type SpeedBucket = "essential" | "superfast" | "ultrafast" | "gigabit";

export type IcukAddress = Record<string, unknown> & {
  postcode?: string;
  nad_key?: string;
  uprn?: string | number;
  thoroughfare_number?: string;
  thoroughfare_name?: string;
  premises_name?: string;
  sub_premises?: string;
  post_town?: string;
};

export type NormalizedAvailabilityProduct = {
  name: string;
  technology: string;
  available: boolean;
  availability_flag: string | null;
  likely_down_mbps: number | null;
  likely_up_mbps: number | null;
  minimum_down_mbps: number | null;
  maximum_down_mbps: number | null;
  minimum_up_mbps: number | null;
  maximum_up_mbps: number | null;
  speed_range: string | null;
  speed_range_up: string | null;
};

export type VerifiedAvailabilityEvidence = {
  evidence_version: "icuk-exact-address-v1";
  source: "ICUK_LIVE_EXACT_ADDRESS";
  verified_exact_address: true;
  retrieved_at: string;
  postcode: string;
  address_reference: {
    nad_key: string | null;
    uprn: string | null;
  };
  primary_technology: string;
  eligible_occta_plans: SpeedBucket[];
  products: NormalizedAvailabilityProduct[];
  exchange: {
    code: string | null;
    name: string | null;
    cabinet_id: string | null;
    classification: string | null;
  };
  raw_response_sha256: string;
};

export type ContractSpeedMatrix = {
  source: "ICUK_LIVE_EXACT_ADDRESS_PLUS_OCCTA_PRODUCT_CAP";
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

const PLAN_CAPS: Record<SpeedBucket, { download: number; upload: number }> = {
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

const INVALID_NUMBERS = new Set([2147483647, -1, 0]);

function validPositive(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || INVALID_NUMBERS.has(n)) return null;
  return n;
}

function normaliseTech(input: unknown): string {
  const s = String(input ?? "").trim().toUpperCase().replace(/[ ._-]/g, "");
  if (s.includes("FTTP")) return "FTTP";
  if (s.includes("GFAST")) return "SOGFast";
  if (s.includes("SOGEA")) return "SOGEA";
  if (s.includes("ADSL")) return "SOADSL";
  return String(input ?? "").trim();
}

function parseRange(value: unknown): { min: number | null; max: number | null } {
  if (Array.isArray(value)) {
    const nums = value.map(validPositive).filter((n): n is number => n != null);
    return { min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null };
  }
  const s = String(value ?? "");
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .map(validPositive)
    .filter((n): n is number => n != null);
  return { min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null };
}

function isAvailableProduct(p: Record<string, unknown>): boolean {
  const flag = String(p.availability_flag ?? p.availabilityFlag ?? p.status ?? "").toUpperCase();
  if (["PROHIBITED", "NOT_AVAILABLE", "UNAVAILABLE", "FALSE"].includes(flag)) return false;
  if (p.availability === false || p.available === false) return false;
  return p.availability === true || p.available === true || flag === "AVAILABLE";
}

function productList(raw: any): Record<string, unknown>[] {
  const candidates = [
    raw?.products,
    raw?.broadband_products,
    raw?.data?.products,
    raw?.result?.products,
    raw?.availability?.products,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as Record<string, unknown>[];
  return [];
}

async function sha256Hex(value: unknown): Promise<string> {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function backendConfig(): { base: string; token: string | null } | null {
  const base = Deno.env.get("ICUK_BACKEND_URL")?.trim().replace(/\/+$/, "") ?? "";
  if (!base || !/^https:\/\//i.test(base)) return null;
  const token = Deno.env.get("ICUK_BACKEND_TOKEN")?.trim() || null;
  return { base, token };
}

function backendHeaders(token: string | null, json = false): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function compactPostcode(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/\s+/g, "");
}

function addressText(a: IcukAddress): string {
  return [
    a.sub_premises, a.premises_name, a.thoroughfare_number,
    a.thoroughfare_name, a.post_town, a.postcode,
  ].filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function requestedAddressText(a: Record<string, unknown>): string {
  return [
    a.address_line_1, a.address_line_2, a.town, a.postcode,
  ].filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hasExactSupplierKey(a: IcukAddress): boolean {
  return !!String(a.nad_key ?? "").trim() || !!String(a.uprn ?? "").trim();
}

export async function lookupIcukAddresses(postcode: string): Promise<IcukAddress[]> {
  const cfg = backendConfig();
  if (!cfg) throw new Error("icuk_backend_not_configured");
  const normalized = compactPostcode(postcode);
  if (!/^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/.test(normalized)) throw new Error("invalid_postcode");

  const res = await fetch(`${cfg.base}/check-address/${encodeURIComponent(normalized)}`, {
    method: "GET",
    headers: backendHeaders(cfg.token),
  });
  if (!res.ok) throw new Error(`icuk_address_backend_${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data?.addresses ?? data?.results ?? []);
  if (!Array.isArray(rows)) return [];
  return rows.filter((x: unknown) => x && typeof x === "object") as IcukAddress[];
}

async function resolveExactAddress(address: Record<string, unknown>): Promise<IcukAddress> {
  const direct = address as IcukAddress;
  if (hasExactSupplierKey(direct)) return direct;

  const postcode = String(address.postcode ?? "");
  const candidates = await lookupIcukAddresses(postcode);
  if (!candidates.length) throw new Error("supplier_address_not_found");

  const wanted = requestedAddressText(address);
  const samePostcode = candidates.filter((c) => compactPostcode(c.postcode) === compactPostcode(postcode));
  const scored = samePostcode.map((candidate) => {
    const text = addressText(candidate);
    let score = 0;
    const n = String(address.address_line_1 ?? "").toUpperCase().match(/^\s*([0-9]+[A-Z]?)/)?.[1];
    if (n && String(candidate.thoroughfare_number ?? "").toUpperCase() === n) score += 4;
    const street = String(address.address_line_1 ?? "").replace(/^\s*[0-9]+[A-Z]?\s*/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (street && text.includes(street)) score += 4;
    const town = String(address.town ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (town && text.includes(town)) score += 1;
    if (wanted && (text.includes(wanted) || wanted.includes(text))) score += 2;
    if (hasExactSupplierKey(candidate)) score += 1;
    return { candidate, score };
  }).sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 5) throw new Error("supplier_address_not_exact");
  if (scored[1] && scored[1].score === scored[0].score) throw new Error("supplier_address_ambiguous");
  return scored[0].candidate;
}

function normalizeProduct(p: Record<string, unknown>): NormalizedAvailabilityProduct | null {
  const tech = normaliseTech(p.technology ?? p.type ?? p.product_type ?? p.name ?? p.product_name);
  const likelyDown = validPositive(p.likely_down_speed ?? p.likelyDownSpeed ?? p.download_speed);
  const likelyUp = validPositive(p.likely_up_speed ?? p.likelyUpSpeed ?? p.upload_speed);
  const downRange = parseRange(p.speed_range ?? p.speedRange);
  const upRange = parseRange(p.speed_range_up ?? p.speedRangeUp);
  const available = isAvailableProduct(p);
  if (!tech) return null;

  return {
    name: String(p.name ?? p.product_name ?? tech),
    technology: tech,
    available,
    availability_flag: String(p.availability_flag ?? p.availabilityFlag ?? p.status ?? "") || null,
    likely_down_mbps: likelyDown,
    likely_up_mbps: likelyUp,
    minimum_down_mbps: downRange.min,
    maximum_down_mbps: downRange.max ?? likelyDown,
    minimum_up_mbps: upRange.min,
    maximum_up_mbps: upRange.max ?? likelyUp,
    speed_range: String(p.speed_range ?? p.speedRange ?? "") || null,
    speed_range_up: String(p.speed_range_up ?? p.speedRangeUp ?? "") || null,
  };
}

function choosePrimary(products: NormalizedAvailabilityProduct[]): string {
  const priority: Record<string, number> = { FTTP: 100, SOGFast: 70, SOGEA: 50, SOADSL: 10 };
  return [...new Set(products.filter((p) => p.available).map((p) => p.technology))]
    .sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0))[0] ?? "";
}

function eligiblePlans(products: NormalizedAvailabilityProduct[], primary: string): SpeedBucket[] {
  const available = products.filter((p) => p.available && p.technology === primary);
  const lineMax = Math.max(...available.map((p) => p.maximum_down_mbps ?? p.likely_down_mbps ?? 0), 0);
  const out: SpeedBucket[] = [];
  for (const b of ["essential", "superfast", "ultrafast", "gigabit"] as SpeedBucket[]) {
    if (b !== "essential" && primary !== "FTTP") continue;
    if (lineMax >= PLAN_MIN_LINE[b]) out.push(b);
  }
  return out;
}

export async function verifyIcukAvailabilityForAddress(address: Record<string, unknown>): Promise<{
  exact_address: IcukAddress;
  evidence: VerifiedAvailabilityEvidence;
}> {
  const cfg = backendConfig();
  if (!cfg) throw new Error("icuk_backend_not_configured");

  const exact = await resolveExactAddress(address);
  if (!hasExactSupplierKey(exact)) throw new Error("supplier_address_missing_reference");

  const res = await fetch(`${cfg.base}/check-availability`, {
    method: "POST",
    headers: backendHeaders(cfg.token, true),
    body: JSON.stringify(exact),
  });
  if (!res.ok) throw new Error(`icuk_availability_backend_${res.status}`);
  const raw = await res.json();
  const normalized = productList(raw).map(normalizeProduct).filter((p): p is NormalizedAvailabilityProduct => !!p);
  const primary = choosePrimary(normalized);
  const plans = primary ? eligiblePlans(normalized, primary) : [];

  const exchangeRaw = raw?.exchange ?? raw?.data?.exchange ?? {};
  const evidence: VerifiedAvailabilityEvidence = {
    evidence_version: "icuk-exact-address-v1",
    source: "ICUK_LIVE_EXACT_ADDRESS",
    verified_exact_address: true,
    retrieved_at: new Date().toISOString(),
    postcode: String(exact.postcode ?? address.postcode ?? "").toUpperCase(),
    address_reference: {
      nad_key: String(exact.nad_key ?? "") || null,
      uprn: String(exact.uprn ?? "") || null,
    },
    primary_technology: primary,
    eligible_occta_plans: plans,
    products: normalized,
    exchange: {
      code: String(exchangeRaw.exchange_code ?? exchangeRaw.code ?? raw?.exchange_code ?? "") || null,
      name: String(exchangeRaw.exchange_name ?? exchangeRaw.name ?? raw?.exchange_name ?? "") || null,
      cabinet_id: String(exchangeRaw.cabinet_id ?? raw?.cabinet_id ?? "") || null,
      classification: String(exchangeRaw.exchange_classification ?? exchangeRaw.classification ?? raw?.exchange_classification ?? "") || null,
    },
    raw_response_sha256: await sha256Hex(raw),
  };

  if (!evidence.primary_technology || !evidence.eligible_occta_plans.length) {
    throw new Error("no_orderable_supplier_product");
  }
  return { exact_address: exact, evidence };
}

export function buildContractSpeedMatrix(
  evidence: unknown,
  bucket: unknown,
): { ok: true; matrix: ContractSpeedMatrix } | { ok: false; error: string } {
  const e = evidence as VerifiedAvailabilityEvidence | null;
  const b = String(bucket ?? "") as SpeedBucket;
  if (!e || e.evidence_version !== "icuk-exact-address-v1" || e.source !== "ICUK_LIVE_EXACT_ADDRESS" || e.verified_exact_address !== true) {
    return { ok: false, error: "verified_supplier_availability_missing" };
  }
  if (!PLAN_CAPS[b] || !e.eligible_occta_plans?.includes(b)) {
    return { ok: false, error: "selected_plan_not_verified_available" };
  }
  const age = Date.now() - new Date(e.retrieved_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 30 * 86400_000) {
    return { ok: false, error: "supplier_availability_stale" };
  }

  const candidates = (e.products ?? []).filter((p) => p.available && p.technology === e.primary_technology);
  if (!candidates.length) return { ok: false, error: "supplier_speed_product_missing" };
  const selected = [...candidates].sort((a, b2) =>
    (b2.maximum_down_mbps ?? b2.likely_down_mbps ?? 0) - (a.maximum_down_mbps ?? a.likely_down_mbps ?? 0)
  )[0];
  const cap = PLAN_CAPS[b];

  const minD = selected.minimum_down_mbps;
  const normalD = selected.likely_down_mbps;
  const maxD = selected.maximum_down_mbps;
  const minU = selected.minimum_up_mbps;
  const normalU = selected.likely_up_mbps;
  const maxU = selected.maximum_up_mbps;
  if ([minD, normalD, maxD, minU, normalU, maxU].some((v) => v == null || !Number.isFinite(Number(v)) || Number(v) <= 0)) {
    return { ok: false, error: "supplier_speed_matrix_incomplete" };
  }

  if (Number(maxD) < PLAN_MIN_LINE[b]) return { ok: false, error: "supplier_speed_below_selected_plan" };

  const matrix: ContractSpeedMatrix = {
    source: "ICUK_LIVE_EXACT_ADDRESS_PLUS_OCCTA_PRODUCT_CAP",
    source_retrieved_at: e.retrieved_at,
    technology: e.primary_technology,
    minimum_download_mbps: Math.min(Number(minD), cap.download),
    normally_available_download_mbps: Math.min(Number(normalD), cap.download),
    maximum_download_mbps: Math.min(Number(maxD), cap.download),
    advertised_download_mbps: cap.download,
    minimum_upload_mbps: Math.min(Number(minU), cap.upload),
    normally_available_upload_mbps: Math.min(Number(normalU), cap.upload),
    maximum_upload_mbps: Math.min(Number(maxU), cap.upload),
    advertised_upload_mbps: cap.upload,
    derivation: "ICUK exact-address line range and likely speed, capped to the selected OCCTA retail product's advertised speed.",
  };
  return { ok: true, matrix };
}

export async function evidenceSha256(evidence: unknown): Promise<string> {
  return sha256Hex(evidence);
}
