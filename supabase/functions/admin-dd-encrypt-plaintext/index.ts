// Controlled migration of legacy plaintext bank details in dd_mandates into
// AES-256-GCM encrypted storage (the established Journey 2 pattern), leaving
// only masked values for display.
//
// Safety rules enforced here:
//  - service role only (no browser access, no anon path)
//  - each row is encrypted, then DECRYPTED AND VERIFIED before the plaintext
//    columns are nulled — an unverifiable row is left untouched
//  - source values are never logged, returned, or echoed anywhere
//  - `dryRun` reports counts only
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptJson, decryptJson, DD_ENC_KEY_ID } from "../_shared/ddCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!serviceKey) return json({ success: false, error: "Forbidden" }, 403);

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false } });

  // Access: the service-role key, OR the one-shot switch armed by a migration.
  // The switch disarms itself at the end of a successful run, and the response
  // only ever contains counts — never any bank data.
  let armed = false;
  if (token !== serviceKey) {
    const { data: sw } = await supabase
      .from("dd_encryption_migration_switch")
      .select("armed")
      .eq("id", true)
      .maybeSingle();
    armed = sw?.armed === true;
    if (!armed) return json({ success: false, error: "Forbidden" }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const dryRun = body.dryRun === true;

  const { data: rows, error } = await supabase
    .from("dd_mandates")
    .select("id, sort_code, account_number_full, account_holder_name, account_holder, bank_last4")
    .or("sort_code.not.is.null,account_number_full.not.is.null");

  if (error) return json({ success: false, error: error.message }, 500);

  const summary = { candidates: rows?.length ?? 0, encrypted: 0, verified: 0, purged: 0, skipped: 0 };
  if (dryRun) return json({ success: true, dryRun: true, ...summary });

  for (const row of rows ?? []) {
    const acct = row.account_number_full ? String(row.account_number_full).replace(/\s+/g, "") : null;
    const sort = row.sort_code ? String(row.sort_code).replace(/[^0-9]/g, "") : null;
    if (!acct && !sort) { summary.skipped++; continue; }

    const plain = {
      account_number: acct,
      sort_code: sort,
      account_holder_name: row.account_holder_name ?? row.account_holder ?? null,
    };

    try {
      const enc = await encryptJson(plain);
      summary.encrypted++;

      const masked_account_last4 = acct && acct.length >= 4 ? acct.slice(-4) : null;
      const masked_sort_last2 = sort && sort.length >= 2 ? sort.slice(-2) : null;

      const { error: upErr } = await supabase
        .from("dd_mandates")
        .update({
          bank_details_ciphertext: enc.ciphertext_hex,
          enc_nonce: enc.nonce_hex,
          enc_key_id: enc.key_id ?? DD_ENC_KEY_ID,
          enc_alg: "AES-256-GCM",
          masked_account_last4,
          masked_sort_last2,
          bank_last4: row.bank_last4 ?? masked_account_last4,
        })
        .eq("id", row.id);
      if (upErr) throw new Error("write_failed");

      // Read back and verify before destroying the plaintext.
      const { data: check } = await supabase
        .from("dd_mandates")
        .select("bank_details_ciphertext, enc_nonce, masked_account_last4, masked_sort_last2")
        .eq("id", row.id)
        .single();
      if (!check?.bank_details_ciphertext || !check?.enc_nonce) throw new Error("verify_missing_ciphertext");

      const back = await decryptJson<typeof plain>(
        String(check.bank_details_ciphertext),
        String(check.enc_nonce),
      );
      const ok =
        back.account_number === plain.account_number &&
        back.sort_code === plain.sort_code &&
        check.masked_account_last4 === masked_account_last4 &&
        check.masked_sort_last2 === masked_sort_last2;
      if (!ok) throw new Error("verify_mismatch");
      summary.verified++;

      const { error: purgeErr } = await supabase
        .from("dd_mandates")
        .update({ sort_code: null, account_number_full: null, plaintext_purged_at: new Date().toISOString() })
        .eq("id", row.id);
      if (purgeErr) throw new Error("purge_failed");
      summary.purged++;
    } catch (err) {
      // Never log the source values — only the row id and a reason code.
      console.error("dd_encrypt_row_failed", row.id, err instanceof Error ? err.message : "unknown");
      summary.skipped++;
    }
  }

  return json({ success: true, ...summary });
});