// Map UK postcode outward-code AREA letters (letters before the digit) to
// the primary served city slug. Used by /coverage-areas to rank matches
// when a visitor enters a partial or full postcode.

export const POSTCODE_AREA_TO_SLUG: Record<string, string> = {
  // London (all central + outer areas)
  E: "london", EC: "london", N: "london", NW: "london", SE: "london",
  SW: "london", W: "london", WC: "london", EN: "london", IG: "london",
  RM: "london", DA: "london", BR: "london", CR: "london", KT: "london",
  SM: "london", TW: "london", UB: "london", HA: "london", TN: "london",
  // Rest of England / Scotland / Wales
  M: "manchester",  B: "birmingham",  LS: "leeds",     G: "glasgow",
  L: "liverpool",   S: "sheffield",   BS: "bristol",   LE: "leicester",
  NG: "nottingham", EH: "edinburgh",  CF: "cardiff",   NE: "newcastle",
  SO: "southampton",CV: "coventry",   BN: "brighton",  PL: "plymouth",
  ST: "stoke-on-trent", WV: "wolverhampton", DE: "derby", SA: "swansea",
  AB: "aberdeen",   RG: "reading",    SR: "sunderland",NR: "norwich",
  LU: "luton",      PR: "preston",    MK: "milton-keynes",
  NN: "northampton",DD: "dundee",     YO: "york",      PO: "portsmouth",
  EX: "exeter",     CB: "cambridge",  OX: "oxford",    BA: "bath",
  BH: "bournemouth",TS: "middlesbrough", BL: "bolton", FY: "blackpool",
  IP: "ipswich",    PE: "peterborough",HD: "huddersfield",
  WF: "wakefield",  HU: "hull",       WA: "warrington",DN: "doncaster",
  SK: "stockport",  WN: "wigan",      GL: "cheltenham",
};

const UK_POSTCODE_AREA = /^([A-Z]{1,2})/i;

/** Extract the leading letters (area) from a postcode-like string. */
export function extractPostcodeArea(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  const m = cleaned.match(UK_POSTCODE_AREA);
  if (!m) return null;
  // Trim trailing letter if next char is not a digit and 2-letter area doesn't match table
  const two = cleaned.slice(0, 2).replace(/[^A-Z]/g, "");
  const one = cleaned.slice(0, 1);
  if (two.length === 2 && POSTCODE_AREA_TO_SLUG[two]) return two;
  if (POSTCODE_AREA_TO_SLUG[one]) return one;
  return two || one || null;
}

/** Return matching city slug for a postcode area, or null. */
export function slugForPostcode(input: string): string | null {
  const area = extractPostcodeArea(input);
  if (!area) return null;
  return POSTCODE_AREA_TO_SLUG[area] ?? null;
}