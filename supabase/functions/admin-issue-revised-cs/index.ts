/**
 * Admin: issue a revised (superseding) Contract Summary.
 *
 * Creates a NEW contract_summaries row (version = previous + 1, supersedes_id =
 * previous) copied field-for-field from the accepted original, with only the
 * explicitly supplied overrides changed. Generates the immutable PDF, mints a
 * fresh single-use signing link and emails the customer.
 *
 * The original accepted Contract Summary is left untouched (it is legally
 * immutable). It is archived automatically the moment the customer signs the
 * revised version — see accept-contract-summary.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, requireStaff,
  generateTokenPair, sendResendEmail, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  source_contract_summary_id: z.string().uuid(),
  reason: z.string().trim().min(5).max(400),
  expires_in_days: z.number().int().min(1).max(60).optional(),
  overrides: z.object({
    plan_name: z.string().trim().min(2).max(160).optional(),
    speed_bucket: z.string().trim().max(40).optional(),
    estimated_download_speed: z.number().int().min(1).max(10000).optional(),
    estimated_upload_speed: z.number().int().min(1).max(10000).optional(),
    speed_notes: z.string().max(2000).optional(),
    cease_cancellation_charges: z.string().max(2000).optional(),
    monthly_price_incl_vat: z.number().min(0).max(100000).optional(),
  }).default({}),
});

// Columns that must never be carried over to a new version.
const DROP = new Set([
  "id", "version", "status", "document_status", "supersedes_id", "cs_number",
  "public_token_hash", "token_expires_at", "issued_at", "issued_at_utc",
  "accepted_at", "accepted_at_utc", "accepted_ip", "accepted_user_agent",
  "superseded_at_utc", "cancelled_at_utc", "archived_at", "archived_reason",
  "pdf_url", "pdf_storage_key", "pdf_storage_path", "pdf_sha256", "pdf_hash",
  "pdf_generated_at", "pdf_generated_by", "emailed_at",
  "created_at", "created_at_utc", "updated_at",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const internal = req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000");
  let actorId: string | null = null;
  if (!internal) {
    const auth = await requireStaff(req, ["admin", "super_admin"]);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    actorId = auth.userId;
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { source_contract_summary_id, reason, overrides } = parsed.data;
  const daysValid = parsed.data.expires_in_days ?? 14;

  const supabase = getServiceClient();

  const { data: src } = await supabase
    .from("contract_summaries").select("*").eq("id", source_contract_summary_id).maybeSingle();
  if (!src) return jsonResponse({ error: "source_not_found" }, 404);

  // Guard: never issue two open revisions for the same source.
  const { data: openRev } = await supabase
    .from("contract_summaries")
    .select("id, cs_number, status")
    .eq("supersedes_id", src.id)
    .in("status", ["draft", "issued", "viewed"])
    .maybeSingle();
  if (openRev) {
    return jsonResponse({
      error: "revision_already_open",
      contract_summary_id: openRev.id,
      cs_number: openRev.cs_number,
    }, 409);
  }

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) if (!DROP.has(k)) row[k] = v;
  Object.assign(row, overrides);

  const nowIso = new Date().toISOString();
  const { raw, hash } = await generateTokenPair();
  row.version = Number(src.version ?? 1) + 1;
  row.status = "issued";
  row.supersedes_id = src.id;
  row.public_token_hash = hash;
  row.token_expires_at = new Date(Date.now() + daysValid * 86_400_000).toISOString();
  row.issued_at = nowIso;
  row.emailed_at = nowIso;

  const { data: created, error: insErr } = await supabase
    .from("contract_summaries").insert(row).select("*").single();
  if (insErr) return jsonResponse({ error: "create_failed", details: insErr.message }, 500);

  // Immutable PDF for the new version.
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const pdfRes = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
    body: JSON.stringify({ contract_summary_id: created.id, internal: true, actor_id: actorId }),
  });
  if (!pdfRes.ok) {
    const body = await pdfRes.text().catch(() => "");
    return jsonResponse({ error: "pdf_generation_failed", contract_summary_id: created.id, details: body.slice(0, 300) }, 502);
  }

  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";
  const csUrl = `${appBase}/quote/contract-summary/${raw}`;
  const recipient = created.customer_email_snapshot as string;
  const firstName = String(created.customer_name_snapshot || "there").split(" ")[0];
  const price = Number(created.monthly_price_incl_vat ?? 0).toFixed(2);

  const html = brutalistEmailShell(
    "Your revised OCCTA Contract Summary",
    `<p>Hi ${escapeHtml(firstName)},</p>
     <p>Thanks for speaking with us. As agreed, here is your <strong>revised Contract Summary</strong> — it replaces the one you signed earlier today once you accept it.</p>
     <p><strong>What has changed:</strong> ${escapeHtml(reason)}</p>
     <p><strong>What has not changed:</strong> your monthly price, your address, your plan type and everything else stay exactly as they were.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(String(created.cs_number))}</strong> (v${created.version})</td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(String(created.plan_name))}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Estimated speeds</td><td style="padding:6px 0;font-size:13px;"><strong>Up to ${escapeHtml(String(created.estimated_download_speed))}Mbps down / up to ${escapeHtml(String(created.estimated_upload_speed))}Mbps up</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Monthly price</td><td style="padding:6px 0;font-size:13px;"><strong>£${price}/mo incl. VAT</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Service address</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(String(created.service_address ?? ""))}</td></tr>
     </table>
     <p>Please open it, read it in full — including the cancellation and early-cease charges section — then tick the box and accept. Your earlier contract stays in place until you sign this one, and is cancelled automatically the moment you do.</p>
     <p style="font-size:12px;color:#555;">This link is private to you and expires in ${daysValid} days.</p>
     <p style="font-size:12px;color:#555;">Anything you're unsure about? Reply to this email or call us on 0800 260 6626.</p>`,
    { label: "Read and sign your revised Contract Summary", url: csUrl },
  );

  const send = await sendResendEmail({
    to: recipient,
    subject: `Your revised OCCTA Contract Summary — please sign`,
    html,
    replyTo: "hello@occta.co.uk",
  });

  await supabase.from("communications_log").insert({
    user_id: created.customer_id,
    template_name: "contract_summary_revised",
    recipient_email: recipient,
    status: send.ok ? "sent" : "failed",
    sent_at: send.ok ? nowIso : null,
    error_message: send.ok ? null : ((send as { error?: string }).error ?? "send_failed"),
    metadata: {
      contract_summary_id: created.id,
      cs_number: created.cs_number,
      cs_version: created.version,
      supersedes_id: src.id,
      supersedes_cs_number: src.cs_number,
      reason,
      sent_by_admin: actorId,
    },
  });

  await supabase.from("quote_events").insert({
    quote_id: created.quote_id,
    quote_request_id: created.quote_request_id,
    contract_summary_id: created.id,
    event_type: send.ok ? "contract_summary_revision_sent" : "contract_summary_revision_send_failed",
    title: `Revised Contract Summary v${created.version} issued`,
    actor_type: "admin",
    actor_id: actorId,
    details: { reason, supersedes_id: src.id, overrides },
  }).then(() => {}).catch(() => {});

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "contract_summary_revision_issued",
    _title: `Revised CS ${created.cs_number} v${created.version} issued (supersedes ${src.cs_number})`,
    _details: { reason, overrides, supersedes_id: src.id, emailed: send.ok },
    _source_module: "contract_summary",
    _quote_id: created.quote_id,
    _contract_summary_id: created.id,
    _customer_id: created.customer_id,
  }).then(() => {}).catch(() => {});

  if (!send.ok) {
    return jsonResponse({ error: "email_failed", contract_summary_id: created.id, details: (send as { error?: string }).error }, 502);
  }

  return jsonResponse({
    ok: true,
    contract_summary_id: created.id,
    cs_number: created.cs_number,
    version: created.version,
    supersedes_id: src.id,
    recipient_masked: recipient.replace(/(.).+?(@.+)/, "$1***$2"),
    token_expires_at: row.token_expires_at,
  });
});
