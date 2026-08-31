/**
 * Turns a PostgREST/Supabase error into readable staff-facing text without
 * exposing tokens, keys or connection strings. Useful database detail (message,
 * hint, code) is preserved so failures are diagnosable in the admin UI.
 */
const SECRET_PATTERN = /(eyJ[A-Za-z0-9_-]{10,}|(?:postgres(?:ql)?:\/\/)\S+|(?:api[_-]?key|secret|password|token|bearer)\s*[:=]\s*\S+)/gi;

export function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, "[redacted]");
}

export function dbErrorText(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  const e = error as { message?: string; hint?: string; details?: string; code?: string };
  const parts = [e.message, e.details, e.hint].filter((v): v is string => !!v && v.trim().length > 0);
  const base = parts.length > 0 ? parts.join(" — ") : typeof error === "string" ? error : fallback;
  const withCode = e.code ? `${base} (${e.code})` : base;
  return redactSecrets(withCode);
}
