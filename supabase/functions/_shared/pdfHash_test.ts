import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { legacyByteListSha256, pdfSha256, pdfSha256Scheme } from "./pdfHash.ts";

// "%PDF-1" — enough to tell a byte hash from a byte-list hash.
const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

// Reference values: printf '%%PDF-1' | sha256sum
//                   printf '37,80,68,70,45,49' | sha256sum
const BYTES_SHA = "21af8e71c8703196df7fe1ff901869a88fe64c07bbaa83d838efb45a52b4f303";
const LEGACY_SHA = "a6e5e9c79babd1a4aa1dc8a7aca4d02c8e390d09e79ae26cd33e85b4ff301d98";

Deno.test("pdfSha256 hashes the raw bytes, not their decimal list", async () => {
  assertEquals(await pdfSha256(bytes), BYTES_SHA);
  assertEquals(await pdfSha256(bytes.buffer), BYTES_SHA);
  assertNotEquals(await pdfSha256(bytes), await legacyByteListSha256(bytes));
});

Deno.test("legacyByteListSha256 reproduces the pre-fix stored value", async () => {
  assertEquals(await legacyByteListSha256(bytes), LEGACY_SHA);
  assertEquals(await legacyByteListSha256(bytes.buffer), LEGACY_SHA);
});

Deno.test("pdfSha256Scheme recognises both stored forms and rejects others", async () => {
  assertEquals(await pdfSha256Scheme(bytes, BYTES_SHA), "pdf_bytes");
  assertEquals(await pdfSha256Scheme(bytes, BYTES_SHA.toUpperCase()), "pdf_bytes");
  assertEquals(await pdfSha256Scheme(bytes, LEGACY_SHA), "legacy_byte_list");
  assertEquals(await pdfSha256Scheme(new Uint8Array([0x25, 0x50]), BYTES_SHA), null);
});
