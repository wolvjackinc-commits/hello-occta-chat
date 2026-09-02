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

export type EmailSendResult =
  | { ok: true; messageId: string | null; trackingLogId?: string | null }
  | { ok: false; error: string; trackingLogId?: string | null };

/**
 * Send through Resend and make single-recipient sends trackable by default.
 *
 * If the caller has already created a communications_log row it can pass
 * trackingLogId. Otherwise this helper creates a generic queued row before
 * sending, injects that row's open-tracking pixel, and updates the row with
 * the provider result. Callers that later add richer audit metadata are
 * merged onto the same row by recordEmailCommunication / the DB merge trigger.
 */
export async function sendResendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  trackingLogId?: string | null;
}): Promise<EmailSendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[quote-email] RESEND_API_KEY missing");
    return { ok: false, error: "RESEND_API_KEY missing", trackingLogId: opts.trackingLogId ?? null };
  }

  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);
  let effectiveTrackingLogId = opts.trackingLogId ?? null;

  // A shared pixel cannot identify which recipient opened a multi-recipient
  // message, so automatic tracking is created only for exactly one recipient.
  if (!effectiveTrackingLogId && recipients.length === 1) {
    try {
      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from("communications_log")
        .insert({
          template_name: "auto_tracked_email",
          recipient_email: recipients[0],
          subject: opts.subject,
          body_html: opts.html,
          status: "queued",
          metadata: { auto_tracked: true },
        })
        .select("id")
        .maybeSingle();
      if (error) console.error("[quote-email] automatic tracking pre-log failed", error.message);
      else effectiveTrackingLogId = data?.id ?? null;
    } catch (e) {
      console.error("[quote-email] automatic tracking pre-log exception", (e as Error)?.message ?? String(e));
    }
  }

  const rawFrom = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk").trim();
  const addrMatch = rawFrom.match(/<([^>]+)>/);
  const address = (addrMatch ? addrMatch[1] : rawFrom).trim();
  const from = `OCCTA <${address}>`;
  let html = opts.html;
  if (effectiveTrackingLogId) {
    const trackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-open-track?id=${effectiveTrackingLogId}`;
    const pixel = `<img src="${trackUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`;
    html = html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : `${html}${pixel}`;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: opts.subject,
      html,
      reply_to: opts.replyTo,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const error = `resend_${res.status}: ${text.slice(0, 200)}`;
    console.error(`[quote-email] send failed ${res.status}: ${text.slice(0, 500)}`);
    if (effectiveTrackingLogId) {
      try {
        await getServiceClient()
          .from("communications_log")
          .update({ status: "failed", error_message: error })
          .eq("id", effectiveTrackingLogId);
      } catch (_e) { /* logging must never mask the send result */ }
    }
    return { ok: false, error, trackingLogId: effectiveTrackingLogId };
  }

  const json = await res.json().catch(() => null) as { id?: string } | null;
  const messageId = json?.id ?? null;
  if (effectiveTrackingLogId) {
    try {
      await getServiceClient()
        .from("communications_log")
        .update({
          status: "sent",
          provider_message_id: messageId,
          error_message: null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", effectiveTrackingLogId);
    } catch (_e) { /* logging must never mask successful delivery to provider */ }
  }
  return { ok: true, messageId, trackingLogId: effectiveTrackingLogId };
}

export function getAdminNotificationEmail(): string {
  return (Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("ADMIN_EMAIL") || "hello@occta.co.uk").trim();
}

export async function recordEmailCommunication(supabase: any, entry: {
  template_name: string;
  recipient_email: string;
  sendResult: EmailSendResult;
  metadata?: Record<string, unknown>;
  user_id?: string | null;
  subject?: string | null;
  body_html?: string | null;
}) {
  // sendResendEmail now creates a trackable row before a single-recipient
  // send. Enrich that same row rather than inserting a duplicate afterward.
  if (entry.sendResult.trackingLogId) {
    const { error } = await supabase
      .from("communications_log")
      .update({
        user_id: entry.user_id ?? null,
        template_name: entry.template_name,
        recipient_email: entry.recipient_email,
        subject: entry.subject ?? undefined,
        body_html: entry.body_html ?? undefined,
        status: entry.sendResult.ok ? "sent" : "failed",
        provider_message_id: entry.sendResult.ok ? entry.sendResult.messageId : null,
        error_message: entry.sendResult.ok ? null : entry.sendResult.error,
        sent_at: entry.sendResult.ok ? new Date().toISOString() : null,
        metadata: entry.metadata ?? {},
      })
      .eq("id", entry.sendResult.trackingLogId);
    if (!error) return;
    console.error("[quote-email] tracked communications_log enrich failed", error.message);
  }

  const { error } = await supabase.from("communications_log").insert({
    user_id: entry.user_id ?? null,
    template_name: entry.template_name,
    recipient_email: entry.recipient_email,
    subject: entry.subject ?? null,
    body_html: entry.body_html ?? null,
    status: entry.sendResult.ok ? "sent" : "failed",
    provider_message_id: entry.sendResult.ok ? entry.sendResult.messageId : null,
    error_message: entry.sendResult.ok ? null : entry.sendResult.error,
    sent_at: entry.sendResult.ok ? new Date().toISOString() : null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("[quote-email] communications_log insert failed", error.message);
}

/**
 * Sends an email with a pre-created communications_log row so the message can
 * carry its own open-tracking pixel. The row is updated after the provider
 * responds, which also makes sent/failed/opened changes visible over Supabase
 * Realtime. If the pre-log insert fails, delivery is still attempted and a
 * normal post-send log is written as a fallback.
 */
export async function sendTrackedCommunication(supabase: any, entry: {
  template_name: string;
  recipient_email: string;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
  user_id?: string | null;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}) {
  let logId: string | null = null;
  const { data: logRow, error: logError } = await supabase
    .from("communications_log")
    .insert({
      user_id: entry.user_id ?? null,
      template_name: entry.template_name,
      recipient_email: entry.recipient_email,
      subject: entry.subject,
      body_html: entry.html,
      status: "queued",
      metadata: entry.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (logError) console.error("[quote-email] tracked pre-log insert failed", logError.message);
  else logId = logRow?.id ?? null;

  const sendResult = await sendResendEmail({
    to: entry.recipient_email,
    subject: entry.subject,
    html: entry.html,
    replyTo: entry.replyTo,
    attachments: entry.attachments,
    trackingLogId: logId,
  });

  if (logId) {
    const { error: updateError } = await supabase
      .from("communications_log")
      .update({
        status: sendResult.ok ? "sent" : "failed",
        provider_message_id: sendResult.ok ? sendResult.messageId : null,
        error_message: sendResult.ok ? null : sendResult.error,
        sent_at: sendResult.ok ? new Date().toISOString() : null,
      })
      .eq("id", logId);
    if (updateError) console.error("[quote-email] tracked log update failed", updateError.message);
  } else {
    await recordEmailCommunication(supabase, {
      template_name: entry.template_name,
      recipient_email: entry.recipient_email,
      sendResult,
      metadata: entry.metadata,
      user_id: entry.user_id,
      subject: entry.subject,
      body_html: entry.html,
    });
  }

  return sendResult;
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
      <tr><td style="padding:20px 28px;border-bottom:2px solid #000;background:#000;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:12px;">
            <img src="https://oexgjmuvgdndizsufipe.supabase.co/storage/v1/object/public/email-assets/logo.png" width="36" height="36" alt="OCCTA Limited" style="display:block;border:0;outline:none;text-decoration:none;" />
          </td>
          <td style="vertical-align:middle;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;font-size:18px;color:#facc15;font-family:Arial,sans-serif;">OCCTA LIMITED</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;text-transform:uppercase;letter-spacing:0.02em;">${escapeHtml(title)}</h1>
        ${body}
        <div style="margin-top:24px;">${ctaHtml}</div>
      </td></tr>
      <tr><td style="padding:0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:2px solid #000;">
          <tr>
            <td style="padding:18px 0 10px 0;font-family:Arial,sans-serif;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#111;">OCCTA Limited</p>
              <p style="margin:0 0 12px 0;font-size:11px;color:#555;font-style:italic;">Flexible monthly options available. No price-rise nonsense. Just proper British telecom.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:11px;color:#444;line-height:1.55;">
                <tr>
                  <td style="padding-right:18px;vertical-align:top;">
                    <strong style="color:#111;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;">Talk to us</strong><br/>
                    <a href="mailto:hello@occta.co.uk" style="color:#444;text-decoration:none;">hello@occta.co.uk</a><br/>
                    <a href="tel:08002606626" style="color:#444;text-decoration:none;">0800 260 6626</a><br/>
                    Mon–Fri · 9am–6pm UK
                  </td>
                  <td style="padding-right:18px;vertical-align:top;">
                    <strong style="color:#111;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;">Self-serve</strong><br/>
                    <a href="https://www.occta.co.uk/dashboard" style="color:#444;text-decoration:none;">Your dashboard</a><br/>
                    <a href="https://www.occta.co.uk/support" style="color:#444;text-decoration:none;">Help &amp; support</a><br/>
                    <a href="https://www.occta.co.uk/order-lookup" style="color:#444;text-decoration:none;">Track an order</a>
                  </td>
                  <td style="vertical-align:top;">
                    <strong style="color:#111;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;">Registered office</strong><br/>
                    22 Pavilion View<br/>
                    Huddersfield, HD3 3WU<br/>
                    Company No. 13828933<br/>
                    VAT No. 520 6072 30
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-top:1px solid #e5e5e5;font-size:10px;color:#888;font-family:Arial,sans-serif;line-height:1.55;">
              You're getting this email because it relates to your account, quote or order with OCCTA Limited — it's a service message, not marketing.
              Manage preferences in <a href="https://www.occta.co.uk/dashboard" style="color:#666;">your dashboard</a>.
              © ${new Date().getFullYear()} OCCTA Limited. Regulated under UK Ofcom General Conditions. Calls may be recorded for training.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}