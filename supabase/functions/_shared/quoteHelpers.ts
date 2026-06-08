import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Generate 32 bytes of random data, return base64url string (raw token) plus its SHA-256 hex hash. */
export async function generateTokenPair(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const hash = await sha256Hex(raw);
  return { raw, hash };
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify caller has a valid JWT and (optionally) belongs to allowed roles. */
export async function requireStaff(req: Request, allowed: string[] = ["admin", "super_admin", "sales_agent"]) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "missing_jwt", status: 401 } as const;
  const supabase = getServiceClient();
  const { data: userResp, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !userResp?.user) return { error: "invalid_jwt", status: 401 } as const;
  const userId = userResp.user.id;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const has = (roles ?? []).some((r: { role: string }) => allowed.includes(r.role));
  if (!has) return { error: "forbidden", status: 403 } as const;
  return { userId } as const;
}

export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

export function getRequestIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Persistent DB rate-limit wrapper. */
export async function checkRateLimit(identifier: string, action: string, maxReq = 5, windowMin = 60) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    _identifier: identifier,
    _action: action,
    _max_requests: maxReq,
    _window_minutes: windowMin,
  });
  if (error) return true; // fail open on infra errors; rate limit is best-effort
  return data === true;
}

export async function sendResendEmail(opts: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "OCCTA <noreply@occta.co.uk>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `resend_${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function brutalistEmailShell(title: string, body: string, cta?: { label: string; url: string }) {
  const ctaHtml = cta
    ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 22px;background:#000;color:#facc15;font-family:Arial,sans-serif;font-weight:700;text-decoration:none;border:3px solid #000;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(cta.label)}</a>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:24px;background:#fafafa;font-family:Arial,sans-serif;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#fff;border:4px solid #000;">
      <tr><td style="padding:24px 28px 8px 28px;border-bottom:2px solid #000;">
        <div style="font-weight:900;letter-spacing:0.15em;text-transform:uppercase;font-size:13px;">OCCTA</div>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;text-transform:uppercase;letter-spacing:0.02em;">${escapeHtml(title)}</h1>
        ${body}
        <div style="margin-top:24px;">${ctaHtml}</div>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:2px solid #000;font-size:11px;color:#555;">
        OCCTA Ltd · UK Telecom · <a href="https://www.occta.co.uk" style="color:#555;">www.occta.co.uk</a><br/>
        This is a service email about your quote with OCCTA.
      </td></tr>
    </table>
  </body></html>`;
}