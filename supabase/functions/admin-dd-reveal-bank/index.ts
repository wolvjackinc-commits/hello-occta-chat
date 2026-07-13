import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^\\x/i, "").replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Parse bytea coming back from PostgREST — normally "\\xDEADBEEF" hex. */
function parseBytea(v: unknown): Uint8Array {
  if (v == null) return new Uint8Array();
  if (v instanceof Uint8Array) return v;
  const s = String(v);
  if (s.startsWith("\\x") || /^[0-9a-f]+$/i.test(s)) return hexToBytes(s);
  // fallback base64
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}

async function loadKey(): Promise<CryptoKey> {
  let rawKey = (Deno.env.get("DD_FIELD_ENC_KEY") ?? "").trim();
  if (!rawKey) throw new Error("DD_FIELD_ENC_KEY_missing");
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
  }
  const noWs = rawKey.replace(/\s+/g, "");
  let keyBytes: Uint8Array | null = null;

  if (/^[0-9a-f]{64}$/i.test(noWs)) keyBytes = hexToBytes(noWs);
  if (!keyBytes) {
    const hexOnly = noWs.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "");
    if (hexOnly.length === 64) keyBytes = hexToBytes(hexOnly);
  }
  if (!keyBytes) {
    let b64 = noWs.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
    b64 = b64.replace(/=+$/, "");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";
    if (b64.length % 4 === 0) {
      try {
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        if (bytes.length === 32) keyBytes = bytes;
      } catch { /* fall through */ }
    }
  }
  if (!keyBytes && noWs.length === 32) keyBytes = new TextEncoder().encode(noWs);
  if (!keyBytes) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
    keyBytes = new Uint8Array(hash);
  }
  if (keyBytes.length !== 32) throw new Error(`DD_FIELD_ENC_KEY_bad_length:${keyBytes.length}`);
  return await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return j(401, { error: "unauthorized" });
    const { data: userData, error: uerr } = await supabase.auth.getUser(jwt);
    if (uerr || !userData?.user) return j(401, { error: "unauthorized" });
    const adminId = userData.user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: adminId, _role: "admin" });
    if (!isAdmin) return j(403, { error: "forbidden" });

    const body = await req.json().catch(() => ({}));
    const { user_id, mandate_id, reason } = (body ?? {}) as {
      user_id?: string; mandate_id?: string; reason?: string;
    };
    if (!user_id && !mandate_id) return j(400, { error: "missing user_id or mandate_id" });

    // Resolve target intake row: latest for this customer, optionally
    // constrained to the intake whose masked last4 matches the mandate.
    let bankLast4Filter: string | null = null;
    let resolvedUserId = user_id ?? null;
    if (mandate_id) {
      const { data: m } = await supabase
        .from("dd_mandates")
        .select("id, user_id, bank_last4")
        .eq("id", mandate_id)
        .maybeSingle();
      if (!m) return j(404, { error: "mandate_not_found" });
      resolvedUserId = m.user_id;
      bankLast4Filter = (m.bank_last4 as string | null) ?? null;
    }
    if (!resolvedUserId) return j(400, { error: "could_not_resolve_user" });

    // Find intake via payment_methods → customer_id.
    let q = supabase
      .from("dd_intake_requests")
      .select("id, payment_method_id, journey_id, bank_details_ciphertext, nonce, enc_alg, enc_key_id, masked_account_last4, masked_sort_last2, bank_name, created_at, payment_methods!inner(customer_id)")
      .eq("payment_methods.customer_id", resolvedUserId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (bankLast4Filter) q = q.eq("masked_account_last4", bankLast4Filter);
    const { data: rows, error: intakeErr } = await q;
    if (intakeErr) return j(500, { error: "intake_query_failed", details: intakeErr.message });
    const intake = rows?.[0];
    if (!intake) return j(404, { error: "intake_not_found" });

    // Decrypt
    const key = await loadKey();
    const ct = parseBytea(intake.bank_details_ciphertext);
    const iv = parseBytea(intake.nonce);
    if (ct.length === 0 || iv.length !== 12) return j(500, { error: "bad_ciphertext" });
    let plain: Record<string, unknown>;
    try {
      const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      plain = JSON.parse(new TextDecoder().decode(dec));
    } catch (e) {
      return j(500, { error: "decrypt_failed", details: String((e as Error).message) });
    }

    // Audit — record who revealed which intake row and why.
    try {
      await supabase.from("audit_logs").insert({
        actor_id: adminId,
        actor_type: "admin",
        action: "dd_bank_details_revealed",
        resource_type: "dd_intake_request",
        resource_id: intake.id,
        details: {
          reason: reason ?? null,
          user_id: resolvedUserId,
          mandate_id: mandate_id ?? null,
          masked_account_last4: intake.masked_account_last4,
          masked_sort_last2: intake.masked_sort_last2,
        },
      });
    } catch { /* non-fatal */ }

    return j(200, {
      ok: true,
      intake_id: intake.id,
      journey_id: intake.journey_id,
      created_at: intake.created_at,
      bank_name: intake.bank_name,
      account_holder_name: plain.account_holder_name ?? null,
      sort_code: plain.sort_code ?? null,
      account_number: plain.account_number ?? null,
      billing_address: plain.billing_address ?? null,
      postcode: plain.postcode ?? null,
    });
  } catch (e) {
    return j(500, { error: "server_error", details: String((e as Error).message) });
  }
});