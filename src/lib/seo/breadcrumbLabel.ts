/** Visible breadcrumb labels should be decoded text, not percent-encoded path pieces. */
export function breadcrumbLabel(value: string): string {
  const trimmed = value.replace(/\+/g, " ").trim();
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  return decoded.replace(/%20/gi, " ").replace(/\s+/g, " ").trim();
}
