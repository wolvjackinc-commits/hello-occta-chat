import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Extensions we never permit — executable / script formats.
const BLOCKED_EXTS = new Set([
  "exe","bat","cmd","com","scr","msi","msix","ps1","psm1","psd1","vbs","vbe","wsf","wsh","hta",
  "js","mjs","cjs","jse","jar","class","apk","ipa","dmg","pkg","deb","rpm","app","gadget",
  "sh","bash","zsh","fish","py","pyc","pyo","rb","php","phtml","pl","asp","aspx","jsp",
  "dll","so","dylib","reg","cpl","lnk",
]);
// Known-safe common types.
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/plain", "text/csv"];
const ALLOWED_MIME_EXACT = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/octet-stream", // allowed but always fully scanned
]);

// Magic-byte signatures we treat as executable / dangerous.
const EXEC_MAGIC: { name: string; bytes: number[] }[] = [
  { name: "PE/EXE (MZ)", bytes: [0x4d, 0x5a] },
  { name: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "Mach-O 32", bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "Mach-O 64", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "Mach-O universal", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "Java class", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "Shell shebang", bytes: [0x23, 0x21] }, // "#!"
];

// EICAR anti-virus test string — we detect it explicitly so this scanner can be verified.
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

function bytesStartsWith(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceRole);

  let body: { path?: string; conversation_id?: string | null; content_type?: string } = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const path = String(body.path || "").trim();
  if (!path || !path.startsWith("user/")) return json(400, { error: "Invalid path" });

  const reasons: string[] = [];
  let status: "clean" | "quarantined" | "error" = "clean";
  let sizeBytes: number | null = null;
  let contentType = body.content_type || null;

  try {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext && BLOCKED_EXTS.has(ext)) {
      status = "quarantined";
      reasons.push(`blocked_extension:${ext}`);
    }

    const dl = await svc.storage.from("chat-attachments").download(path);
    if (dl.error || !dl.data) {
      status = "error";
      reasons.push(`download_failed:${dl.error?.message || "unknown"}`);
    } else {
      const blob = dl.data;
      sizeBytes = blob.size;
      contentType = contentType || blob.type || null;
      if (sizeBytes > MAX_SIZE) {
        status = "quarantined";
        reasons.push(`over_size_limit:${sizeBytes}`);
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      // Magic-byte executable check.
      for (const m of EXEC_MAGIC) {
        if (bytesStartsWith(buf, m.bytes)) {
          status = "quarantined";
          reasons.push(`executable_signature:${m.name}`);
          break;
        }
      }
      // EICAR detection.
      try {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, Math.min(buf.length, 4096)));
        if (text.includes(EICAR)) {
          status = "quarantined";
          reasons.push("eicar_test_signature");
        }
      } catch { /* ignore decode errors */ }

      // Mime allow-list — anything not on the list is quarantined by default.
      if (status === "clean" && contentType) {
        const ok =
          ALLOWED_MIME_PREFIXES.some((p) => contentType!.startsWith(p)) ||
          ALLOWED_MIME_EXACT.has(contentType);
        if (!ok) {
          status = "quarantined";
          reasons.push(`disallowed_mime:${contentType}`);
        }
      }
    }
  } catch (e: any) {
    status = "error";
    reasons.push(`scan_exception:${e?.message || String(e)}`);
  }

  // Upsert scan row.
  await svc.from("chat_attachment_scans").upsert({
    path,
    conversation_id: body.conversation_id ?? null,
    status,
    reasons: reasons.length ? reasons : null,
    size_bytes: sizeBytes,
    content_type: contentType,
    scanned_at: new Date().toISOString(),
  }, { onConflict: "path" });

  return json(200, { status, reasons });
});