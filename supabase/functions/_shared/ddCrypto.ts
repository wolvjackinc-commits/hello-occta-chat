/**
 * Journey 2 — Direct Debit field encryption.
 *
 * Bank details are encrypted with AES-256-GCM under DD_FIELD_ENC_KEY the
 * moment they arrive and are only ever decrypted server-side when the
 * mandate request is handed to the existing Direct Debit service. The key
 * parsing mirrors `journey-payment-method` so the same secret works for both.
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

async function keyBytes(): Promise<Uint8Array> {
  let rawKey = (Deno.env.get("DD_FIELD_ENC_KEY") ?? "").trim();
  if (!rawKey) throw new Error("DD_FIELD_ENC_KEY_missing");
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
  }
  const noWs = rawKey.replace(/\s+/g, "");
  if (/^[0-9a-f]{64}$/i.test(noWs)) return hexToBytes(noWs);

  const hexOnly = noWs.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "");
  if (hexOnly.length === 64) return hexToBytes(hexOnly);

  let b64 = noWs.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "").replace(/=+$/, "");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  if (b64.length % 4 === 0) {
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.length === 32) return bytes;
    } catch { /* fall through */ }
  }
  if (noWs.length === 32) return new TextEncoder().encode(noWs);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey)));
}

export const DD_ENC_KEY_ID = "DD_FIELD_ENC_KEY_v1";

export async function encryptJson(plain: Record<string, unknown>) {
  const key = await crypto.subtle.importKey("raw", await keyBytes(), { name: "AES-GCM" }, false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(JSON.stringify(plain)),
  ));
  return {
    ciphertext_hex: "\\x" + toHex(ct),
    nonce_hex: "\\x" + toHex(nonce),
    key_id: DD_ENC_KEY_ID,
  };
}

/** Accepts the `\x…` hex form Postgres returns for bytea columns. */
export async function decryptJson<T = Record<string, unknown>>(ciphertext: string, nonce: string): Promise<T> {
  const key = await crypto.subtle.importKey("raw", await keyBytes(), { name: "AES-GCM" }, false, ["decrypt"]);
  const ct = hexToBytes(String(ciphertext).replace(/^\\x/, ""));
  const iv = hexToBytes(String(nonce).replace(/^\\x/, ""));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function sha256Json(value: unknown): Promise<string> {
  const stable = JSON.stringify(value, Object.keys(flatten(value)).sort());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
  return toHex(new Uint8Array(digest));
}

function flatten(v: unknown, prefix = "", out: Record<string, true> = {}): Record<string, true> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of Object.keys(v as Record<string, unknown>)) {
      out[k] = true;
      flatten((v as Record<string, unknown>)[k], `${prefix}${k}.`, out);
    }
  }
  return out;
}
