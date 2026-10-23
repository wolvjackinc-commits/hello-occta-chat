/**
 * Attachments for admin-composed customer emails (Communications tab).
 *
 * The browser never sends file bytes: it names an invoice or an uploaded
 * customer file by id, and this module loads the bytes from private storage
 * with the service role — only when that record belongs to the customer the
 * email is for. That keeps one customer's documents from being attached to
 * another customer's email by mistake or by a crafted request.
 */

export type AttachmentRef =
  | { kind: "invoice"; invoice_id: string }
  | { kind: "user_file"; user_file_id: string };

export type ResolvedAttachment = {
  filename: string;
  content: string; // base64
  contentType: string;
  kind: AttachmentRef["kind"];
  ref_id: string;
  bytes: number;
};

export const MAX_ATTACHMENTS = 10;
// Resend accepts up to 40MB per email after base64; stay well under it.
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate the request shape. Returns a clean list or an error message. */
export function parseAttachmentRefs(raw: unknown): { refs: AttachmentRef[] } | { error: string } {
  if (raw === undefined || raw === null) return { refs: [] };
  if (!Array.isArray(raw)) return { error: "attachments must be a list" };
  if (raw.length > MAX_ATTACHMENTS) return { error: `At most ${MAX_ATTACHMENTS} attachments per email` };
  const refs: AttachmentRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    if (r?.kind === "invoice" && typeof r.invoice_id === "string" && UUID.test(r.invoice_id)) {
      const key = `invoice:${r.invoice_id}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ kind: "invoice", invoice_id: r.invoice_id }); }
    } else if (r?.kind === "user_file" && typeof r.user_file_id === "string" && UUID.test(r.user_file_id)) {
      const key = `user_file:${r.user_file_id}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ kind: "user_file", user_file_id: r.user_file_id }); }
    } else {
      return { error: "Invalid attachment reference" };
    }
  }
  return { refs };
}

/** Strip path parts and characters mail clients choke on. */
export function safeFilename(name: string, fallback: string): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(base)
    .filter((ch) => ch.charCodeAt(0) >= 32 && !'"<>|:*?'.includes(ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Load each referenced document for `customerId`. Throws with a message an
 * admin can act on if any attachment is missing, foreign or too large, so an
 * email is never sent with a silently dropped attachment.
 */
// deno-lint-ignore no-explicit-any
export async function resolveAttachments(supabase: any, customerId: string, refs: AttachmentRef[]): Promise<ResolvedAttachment[]> {
  const out: ResolvedAttachment[] = [];
  let total = 0;
  for (const ref of refs) {
    let bucket: string, path: string, filename: string, contentType: string, refId: string;

    if (ref.kind === "invoice") {
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, user_id, invoice_number, pdf_storage_key")
        .eq("id", ref.invoice_id)
        .maybeSingle();
      if (!inv || inv.user_id !== customerId) throw new Error("An attached invoice doesn't belong to this customer");
      if (!inv.pdf_storage_key) throw new Error(`Invoice ${inv.invoice_number ?? ""} has no PDF yet — regenerate it first`);
      bucket = "invoice-pdfs";
      path = inv.pdf_storage_key;
      filename = safeFilename(`OCCTA invoice ${inv.invoice_number ?? inv.id}.pdf`, "OCCTA invoice.pdf");
      contentType = "application/pdf";
      refId = inv.id;
    } else {
      const { data: f } = await supabase
        .from("user_files")
        .select("id, user_id, file_name, file_path, file_type")
        .eq("id", ref.user_file_id)
        .maybeSingle();
      if (!f || f.user_id !== customerId) throw new Error("An attached file doesn't belong to this customer");
      bucket = "user-files";
      path = f.file_path;
      filename = safeFilename(f.file_name, "attachment");
      contentType = f.file_type || "application/octet-stream";
      refId = f.id;
    }

    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error || !blob) throw new Error(`Couldn't load attachment ${filename}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new Error("Attachments are larger than 20MB in total");
    out.push({ filename, content: toBase64(bytes), contentType, kind: ref.kind, ref_id: refId, bytes: bytes.length });
  }
  return out;
}
