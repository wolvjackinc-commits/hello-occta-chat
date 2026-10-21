// SHA-256 of a rendered PDF's raw bytes, as stored in
// contract_information_packs.pdf_sha256 (and copied onto acceptances and
// acceptance certificates).
//
// Packs issued before this fix stored sha256Hex(String(bytes)): the hash of
// the comma-joined decimal byte list ("37,80,68,70,…"), not of the file.
// Those rows are immutable (issued/accepted documents) and keep their stored
// value. To verify a stored hash against a PDF downloaded from storage, use
// pdfSha256Scheme(), which recognises both forms.

function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex of the actual PDF bytes. Used for every new pack version. */
export async function pdfSha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

/** The pre-fix value: SHA-256 hex of the comma-joined byte list. Verification only. */
export async function legacyByteListSha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const list = String(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(list)));
}

/**
 * Which hashing scheme produced `stored` for these PDF bytes:
 * "pdf_bytes" (current), "legacy_byte_list" (packs issued before the fix),
 * or null when the bytes do not match the stored hash at all.
 */
export async function pdfSha256Scheme(
  bytes: ArrayBuffer | Uint8Array,
  stored: string,
): Promise<"pdf_bytes" | "legacy_byte_list" | null> {
  const want = stored.trim().toLowerCase();
  if (await pdfSha256(bytes) === want) return "pdf_bytes";
  if (await legacyByteListSha256(bytes) === want) return "legacy_byte_list";
  return null;
}
