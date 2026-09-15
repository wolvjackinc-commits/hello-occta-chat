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
import { normaliseRouterOption, describeRouterSelection } from "../_shared/routerSummary.ts";

const RouterOptionSchema = z.object({
  option: z.enum(["own", "standard", "premium", "business", "business_hub"]),
  label: z.string().trim().min(2).max(160),
  payment_type: z.enum(["none", "one_off", "monthly"]),
  monthly: z.number().min(0).max(1000).default(0),
  one_off: z.number().min(0).max(10000).default(0),
}).strict().refine(
  (r) => (r.payment_type === "monthly" ? r.monthly > 0 : true) &&
         (r.payment_type === "one_off" ? r.one_off > 0 : true) &&
         (r.payment_type === "none" ? r.monthly === 0 && r.one_off === 0 : true),
  { message: "router_option payment_type must match the monthly/one_off amounts" },
);

const AddonSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  monthly: z.number().min(0).max(1000).default(0),
  one_off: z.number().min(0).max(10000).optional(),
}).strict();

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
    router_option: RouterOptionSchema.optional(),
    router_charge: z.number().min(0).max(10000).optional(),
    selected_addons: z.array(AddonSchema).max(20).optional(),
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

  // Internal server-to-server callers: either the service-role key, or the
  // project's standard shared internal secret (same mechanism send-email and
  // the outbox workers already use). Both are server-only values.
  const cronSecret = Deno.env.get("CRON_JOB_SECRET") ?? "";
  const internal = (req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000")) ||
    (cronSecret.length >= 16 && req.headers.get("x-internal-secret") === cronSecret);
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

  // Fail closed: if any part of the document set cannot be produced, the new
  // Contract Summary must never be signable. It is never deleted (documents are
  // append-only) — it is voided for manual review and its signing token is
  // destroyed, so the customer's existing accepted contract stays in force.
  const voidRevision = async (why: string) => {
    await supabase.from("contract_summaries").update({
      status: "expired",
      document_status: "void_manual_review",
      public_token_hash: null,
      token_expires_at: nowIso,
      archived_at: nowIso,
      archived_reason: `revision_void:${why}`.slice(0, 200),
    }).eq("id", created.id).neq("status", "accepted");
    await supabase.rpc("log_event", {
      _actor_type: "system",
      _event_type: "contract_summary_revision_voided",
      _title: `Revised CS ${created.cs_number} voided before sending (${why})`,
      _details: { reason, why, supersedes_id: src.id },
      _source_module: "contract_summary",
      _quote_id: created.quote_id,
      _contract_summary_id: created.id,
      _customer_id: created.customer_id,
    }).then(() => {}, () => {});
  };

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
    await voidRevision("pdf_generation_failed");
    return jsonResponse({ error: "pdf_generation_failed", contract_summary_id: created.id, voided: true, details: body.slice(0, 300) }, 502);
  }

  // Contract Information Pack must be reissued and paired to THIS revision,
  // otherwise acceptance fails the snapshot-integrity check
  // (contract_information_mismatch). The accepted pack on the previous version
  // stays immutable — a new pack version is issued and bound to the new CS.
  let reissuedCip: { cip_number: string; version: number } | null = null;
  {
    const { data: existingPack } = await supabase
      .from("contract_information_packs")
      .select("id")
      .eq("quote_id", created.quote_id)
      .neq("document_status", "superseded")
      .limit(1)
      .maybeSingle();
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("two_document_contract_flow_enabled")
      .eq("singleton", true)
      .maybeSingle();

    if (existingPack || settings?.two_document_contract_flow_enabled) {
      const cipRes = await fetch(`${projectUrl}/functions/v1/generate-contract-information-pack`, {
        method: "POST",
        headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
        body: JSON.stringify({ quote_id: created.quote_id, for_contract_summary_id: created.id }),
      });
      const cipBody = await cipRes.json().catch(() => null) as { pack_id?: string; error?: string } | null;
      if (!cipRes.ok || !cipBody?.pack_id) {
        await voidRevision("contract_information_reissue_failed");
        return jsonResponse({
          error: "contract_information_reissue_failed",
          message: "The Contract Information Pack could not be reissued for this revision, so the revised Contract Summary has been voided and nothing was sent.",
          contract_summary_id: created.id,
          voided: true,
          details: cipBody?.error ?? null,
        }, 502);
      }
      const { data: pack } = await supabase
        .from("contract_information_packs")
        .select("id, cip_number, version, contract_summary_id, document_status, pdf_storage_path")
        .eq("id", cipBody.pack_id)
        .maybeSingle();
      if (!pack) {
        await voidRevision("contract_information_missing_after_generation");
        return jsonResponse({ error: "contract_information_missing_after_generation", contract_summary_id: created.id, voided: true }, 502);
      }
      if (pack.contract_summary_id !== created.id) {
        if (pack.document_status === "accepted") {
          await voidRevision("contract_information_bound_to_other_summary");
          return jsonResponse({
            error: "contract_information_bound_to_other_summary",
            contract_summary_id: created.id,
            voided: true,
            details: "The reissued pack is already accepted against another Contract Summary version.",
          }, 409);
        }
        const { error: linkErr } = await supabase
          .from("contract_information_packs")
          .update({ contract_summary_id: created.id })
          .eq("id", pack.id)
          .neq("document_status", "accepted");
        if (linkErr) {
          await voidRevision("contract_information_link_failed");
          return jsonResponse({ error: "contract_information_link_failed", contract_summary_id: created.id, voided: true, details: linkErr.message }, 502);
        }
      }
      if (!pack.pdf_storage_path) {
        await voidRevision("contract_information_pdf_missing");
        return jsonResponse({ error: "contract_information_pdf_missing", contract_summary_id: created.id, voided: true }, 502);
      }

      // Mirror the acceptance-time snapshot-integrity check exactly: the LATEST
      // pack for this quote must be the one bound to this revision, otherwise
      // acceptance would fail with contract_information_mismatch.
      const { data: latestPack } = await supabase
        .from("contract_information_packs")
        .select("id, contract_summary_id, document_status")
        .eq("quote_id", created.quote_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const latestOk = latestPack &&
        latestPack.contract_summary_id === created.id &&
        !["superseded", "cancelled", "void_manual_review"].includes(String(latestPack.document_status));
      if (!latestOk) {
        await voidRevision("contract_information_not_current_for_revision");
        return jsonResponse({
          error: "contract_information_not_current_for_revision",
          message: "The reissued Contract Information Pack is not the current version for this order, so the revision has been voided.",
          contract_summary_id: created.id,
          voided: true,
        }, 409);
      }

      reissuedCip = { cip_number: String(pack.cip_number), version: Number(pack.version) };
    }
  }



  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";
  const csUrl = `${appBase}/quote/contract-summary/${raw}`;
  const recipient = created.customer_email_snapshot as string;
  const firstName = String(created.customer_name_snapshot || "there").split(" ")[0];
  const price = Number(created.monthly_price_incl_vat ?? 0).toFixed(2);

  // Truthful "what has not changed" — only list what genuinely matches the source.
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const unchanged: string[] = [];
  if (same(src.service_address, created.service_address)) unchanged.push("your service address");
  if (same(src.plan_name, created.plan_name)) unchanged.push("your plan");
  if (same(src.contract_length, created.contract_length) && same(src.notice_period, created.notice_period)) unchanged.push("your contract term and notice period");
  if (same(src.estimated_download_speed, created.estimated_download_speed) && same(src.estimated_upload_speed, created.estimated_upload_speed)) unchanged.push("your estimated speeds");
  if (Number(src.monthly_price_incl_vat ?? 0) === Number(created.monthly_price_incl_vat ?? 0)) unchanged.push("your monthly price");
  const unchangedHtml = unchanged.length
    ? `<p><strong>What has not changed:</strong> ${escapeHtml(unchanged.join(", "))}.</p>`
    : "";

  const routerLine = describeRouterSelection(created.router_option, created.router_charge);
  const routerSel = normaliseRouterOption(created.router_option);
  const routerOneOff = routerSel && routerSel.monthly === 0
    ? (routerSel.one_off > 0 ? routerSel.one_off : Number(created.router_charge ?? 0))
    : 0;
  const routerRow = routerLine
    ? `<tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Router</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(routerLine)}</strong></td></tr>`
    : "";
  const routerChargeRow = routerOneOff > 0
    ? `<tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Router charge</td><td style="padding:6px 0;font-size:13px;"><strong>£${routerOneOff.toFixed(2)} one-off incl. VAT</strong></td></tr>`
    : "";

  // Two-document flow: the signing page shows the Contract Summary together
  // with its matching Contract Information Pack, so both are referenced here.
  const cipRow = reissuedCip
    ? `<tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Information</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(reissuedCip.cip_number)}</strong> (v${reissuedCip.version})</td></tr>`
    : "";
  const cipNote = reissuedCip
    ? `<p>Both documents have been reissued together: your revised Contract Summary and the matching Contract Information &amp; Customer Agreement Pack. You can read both on the signing page before you accept.</p>`
    : "";

  const html = brutalistEmailShell(
    "Your revised OCCTA Contract Summary",
    `<p>Hi ${escapeHtml(firstName)},</p>
     <p>Thanks for speaking with us. As agreed, here is your <strong>revised Contract Summary</strong> — it replaces the one you accepted previously once you accept this version.</p>
     <p><strong>What has changed:</strong> ${escapeHtml(reason)}</p>
     ${unchangedHtml}
     ${cipNote}
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(String(created.cs_number))}</strong> (v${created.version})</td></tr>
       ${cipRow}
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(String(created.plan_name))}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Estimated speeds</td><td style="padding:6px 0;font-size:13px;"><strong>Up to ${escapeHtml(String(created.estimated_download_speed))}Mbps down / up to ${escapeHtml(String(created.estimated_upload_speed))}Mbps up</strong></td></tr>
       ${routerRow}
       ${routerChargeRow}
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
    contract_information_pack: reissuedCip,
  });
});
