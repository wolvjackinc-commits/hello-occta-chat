// Non-secret deploy marker. A live function that answers OPTIONS or GET
// without this header is an older build. Probes must not write database rows.

export const OCCTA_FN_VERSION_HEADER = "x-occta-fn-version";

/** Bump when the marked functions' request handling changes. */
export const OCCTA_FN_BUILD = "20261010-cc-1";

export const OCCTA_FN_IDS = [
  "journey2-session",
  "submit-business-lead",
  "submit-business-quote",
] as const;

export type OcctaFnId = (typeof OCCTA_FN_IDS)[number];

export function fnVersionValue(fn: OcctaFnId): string {
  return `${fn}@${OCCTA_FN_BUILD}`;
}

export function fnVersionHeaders(fn: OcctaFnId): Record<string, string> {
  return {
    [OCCTA_FN_VERSION_HEADER]: fnVersionValue(fn),
    "Access-Control-Expose-Headers": OCCTA_FN_VERSION_HEADER,
  };
}

export function fnVersionProbe(fn: OcctaFnId): { ok: true; fn: OcctaFnId; version: string } {
  return { ok: true, fn, version: fnVersionValue(fn) };
}
