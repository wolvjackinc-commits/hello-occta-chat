const BRAND = "OCCTA";
const SUFFIX = ` | ${BRAND}`;

/** One brand suffix, then keep the document title inside 30–65 characters when we can. */
export function buildDocumentTitle(title?: string): string {
  const fallback = "OCCTA — UK Broadband, 5G SIM & Digital Home Phone";
  const raw = (title ?? "").replace(/\s+/g, " ").trim();
  let full = !raw ? fallback : /occta/i.test(raw) ? raw : `${raw}${SUFFIX}`;
  full = full.replace(/(?:\s*\|\s*OCCTA){2,}$/i, SUFFIX);

  if (full.length > 65) {
    if (full.endsWith(SUFFIX)) {
      const room = 65 - SUFFIX.length;
      let base = full.slice(0, -SUFFIX.length).trim();
      if (base.length > room) {
        base = base.slice(0, room);
        const space = base.lastIndexOf(" ");
        if (space > 18) base = base.slice(0, space);
        base = base.replace(/[\s|—–\-:]+$/g, "");
      }
      full = `${base}${SUFFIX}`;
    } else {
      let cut = full.slice(0, 65);
      const space = cut.lastIndexOf(" ");
      if (space > 30) cut = cut.slice(0, space);
      full = cut.replace(/[\s|—–\-:]+$/g, "");
    }
  }

  return full;
}

/** Meta descriptions should stay within the usual snippet length. */
export function fitMetaDescription(description: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  let cut = clean.slice(0, 160);
  const space = cut.lastIndexOf(" ");
  if (space >= 90) cut = cut.slice(0, space);
  return cut.replace(/[\s,;:.—–-]+$/g, "");
}
