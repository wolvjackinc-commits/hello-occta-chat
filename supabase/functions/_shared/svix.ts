// Svix webhook signature verification (used by Resend). No runtime imports so
// the Vitest suite can exercise it directly.

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function svixSignature(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToBase64(new Uint8Array(mac));
}

export async function verifySvix(opts: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const ts = Number(opts.timestamp);
  const now = opts.nowSeconds ?? Date.now() / 1000;
  if (!opts.id || !Number.isFinite(ts) || Math.abs(now - ts) > (opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) return false;
  let expected: string;
  try {
    expected = await svixSignature(opts.secret, opts.id, opts.timestamp, opts.body);
  } catch {
    return false;
  }
  return opts.signatureHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && typeof sig === "string" && timingSafeEqual(sig, expected);
  });
}
