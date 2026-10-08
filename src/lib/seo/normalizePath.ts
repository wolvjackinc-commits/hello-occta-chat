/**
 * Client-side canonical path: strip a trailing slash and lowercase static
 * segments. Quote, order and receipt tokens keep their original case.
 */
const PUBLIC_QUOTE_LEAVES = new Set(["start", "thank-you"]);

export function normalizePublicPath(pathname: string): string {
  let path = pathname || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  const parts = path.split("/");
  const preserve = new Set<number>();
  const head = (parts[1] ?? "").toLowerCase();
  const second = (parts[2] ?? "").toLowerCase();

  if (head === "quote" && parts[2] && !PUBLIC_QUOTE_LEAVES.has(second) && parts.length === 3) {
    preserve.add(2);
  }
  if (head === "quote" && ["two-doc", "contract-summary", "payment"].includes(second) && parts[3]) {
    preserve.add(3);
  }
  if (head === "order" && parts[2]) preserve.add(2);
  if (head === "receipt" && parts[2]) preserve.add(2);
  if (head === "dashboard" && ["contract", "receipt"].includes(second) && parts[3]) {
    preserve.add(3);
  }
  if (head === "sim" && second === "order-success" && parts[3]) preserve.add(3);
  if (head === "admin" && second === "customers" && parts[3]) preserve.add(3);

  return parts
    .map((segment, index) => (index === 0 || preserve.has(index) ? segment : segment.toLowerCase()))
    .join("/") || "/";
}
