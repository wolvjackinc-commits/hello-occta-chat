// Helpers for the /business/line-check landing page (landline switch-off emails and flyers).

export type CallTime = "morning" | "afternoon" | "any";

export const CALL_TIMES: { value: CallTime; label: string; confirm: string }[] = [
  { value: "morning", label: "Morning", confirm: "in the morning" },
  { value: "afternoon", label: "Afternoon", confirm: "in the afternoon" },
  { value: "any", label: "Any time", confirm: "soon" },
];

export const LINE_ITEMS = [
  "Phones",
  "Card machine",
  "Alarm",
  "Door entry",
  "Lift line",
  "Fax / franking",
  "Not sure",
] as const;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The outreach email's recipient token. Links carry it as `utm_term=ob-<token>`,
 * which stays in the address bar (the click beacon only strips `ot`/`ol`).
 */
export function outreachTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const term = params.get("utm_term") ?? "";
  if (term.startsWith("ob-")) {
    const token = term.slice(3);
    if (TOKEN_RE.test(token)) return token;
  }
  const ot = params.get("ot") ?? "";
  return TOKEN_RE.test(ot) ? ot : null;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "cc"] as const;

/**
 * Campaign parameters from the landing URL, so the enquiry is credited to the
 * email (or flyer) that brought the visitor even if no first-touch was stored.
 */
export function lineCheckUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim();
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

/** The sales team's note: when to call and what the customer said is on the line. */
export function buildLineCheckMessage(opts: { callTime: CallTime; items: readonly string[] }): string {
  const when = CALL_TIMES.find((t) => t.value === opts.callTime)?.label ?? "Any time";
  const known = opts.items.filter((i) => (LINE_ITEMS as readonly string[]).includes(i));
  return [
    "FREE LINE CHECK REQUEST (landline switch-off). Please call back.",
    `Best time to call: ${when}`,
    `On the line: ${known.length ? known.join(", ") : "not given"}`,
  ].join("\n");
}
