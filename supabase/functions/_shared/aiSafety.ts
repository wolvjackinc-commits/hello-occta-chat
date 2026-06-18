// Shared AI safety helpers used by ai-chat and ai-execute-action.
// Strips fields that must never reach the model or the browser.

const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /worldpay/i,
  /supplier/i,
  /giacom/i,
  /margin/i,
  /cost_/i,
  /_cost$/i,
  /token/i,
  /encrypted/i,
  /secret/i,
  /api_?key/i,
  /private/i,
  /password/i,
  /sort_code/i,
  /account_number_raw/i,
  /bank_account/i,
  /iban/i,
  /webhook_signature/i,
  /pdf_sha256/i,
  /internal_note/i,
  /admin_note/i,
  /ip_address/i,
  /user_agent/i,
];

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((re) => re.test(key));
}

// Recursively strip forbidden fields from any value before returning to the model.
export function redact<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    // deno-lint-ignore no-explicit-any
    return value.map((v) => redact(v)) as any;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKey(k)) continue;
      out[k] = redact(v);
    }
    // deno-lint-ignore no-explicit-any
    return out as any;
  }
  return value;
}

// Convenience: redact -> stringify for tool responses.
export function safeJson(value: unknown): string {
  return JSON.stringify(redact(value));
}

// Validate that an outgoing tool result string carries no obvious forbidden tokens.
// Last-line defence in case a field name slips through.
export function containsForbiddenContent(serialised: string): boolean {
  const needles = [
    "worldpay_merchant",
    "service_role_key",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LOVABLE_API_KEY",
    "ENCRYPTION_KEY",
    "private_key",
  ];
  return needles.some((n) => serialised.includes(n));
}
