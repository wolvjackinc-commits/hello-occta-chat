import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp, sendResendEmail, brutalistEmailShell, escapeHtml } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Phase F — Final order submission.
 *
 * Validates the journey is fully populated (contract accepted, cooling-off
 * acknowledged, start date selected, payment method chosen) and then performs
 * an idempotent submission:
 *   1) inserts (or returns) a guest_orders row keyed off the journey
 *   2) links the active payment_method to that order via metadata
 *   3) marks the journey submitted/completed with a server-side idempotency key
 *   4) sends a single consolidated onboarding email to the customer and an
 *      internal admin notification
 *
 * NEVER creates Worldpay sessions, dd_mandates, invoices, payment_requests
 * or receipts. It only records the customer's confirmed intent to proceed.
 */

const Schema = z.object({
  token: z.string().min(16),
  idempotency_key: z.string().uuid(),
  final_consent: z.literal(true),
});

function genOrderNumber() {
  const ts = new Date();
  const ymd = `${ts.getUTCFullYear()}${String(ts.getUTCMonth() + 1).padStart(2, "0")}${String(ts.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `OCC-${ymd}-${rand}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { token, idempotency_key } = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey_submit_order", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const hash = await sha256Hex(token);

  // Idempotency replay — same key for same journey returns the cached result.
  const { data: existingByKey } = await supabase
    .from("order_journeys")
    .select("id, idempotency_key, submitted_at, completed_at, current_step, status, quote_id")
    .eq("idempotency_key", idempotency_key)
    .maybeSingle();

  const { data: journey, error: jErr } = await supabase
    .from("order_journeys")
    .select(`
      id, quote_id, status, current_step, customer_id,
      contract_accepted_at, cooling_off_acknowledged, cooling_off_ends_at,
      preferred_start_date, payment_method, billing_anchor_day,
      idempotency_key, submitted_at, completed_at, consolidated_email_sent_at
    `)
    .eq("token_hash", hash)
    .maybeSingle();

  if (jErr || !journey) return jsonResponse({ error: "no_journey" }, 404);
  if (journey.status === "cancelled") return jsonResponse({ error: "journey_cancelled" }, 409);

  // Replay protection — if key was already used on a different journey, reject.
  if (existingByKey && existingByKey.id !== journey.id) {
    return jsonResponse({ error: "idempotency_conflict" }, 409);
  }
  // Already submitted with this key → return the snapshot.
  if (journey.submitted_at && journey.idempotency_key === idempotency_key) {
    const { data: order } = await supabase
      .from("guest_orders")
      .select("id, order_number, status, created_at")
      .eq("id", await guestOrderIdForJourney(supabase, journey.id) ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    return jsonResponse({ ok: true, replayed: true, order, journey });
  }
  // Already submitted with a different key → block double-submit.
  if (journey.submitted_at && journey.idempotency_key && journey.idempotency_key !== idempotency_key) {
    return jsonResponse({ error: "already_submitted" }, 409);
  }

  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);
  if (!journey.cooling_off_acknowledged) return jsonResponse({ error: "cooling_off_not_acknowledged" }, 409);
  if (!journey.preferred_start_date) return jsonResponse({ error: "start_date_not_selected" }, 409);
  if (!journey.payment_method) return jsonResponse({ error: "payment_method_not_selected" }, 409);

  const { data: pm } = await supabase
    .from("payment_methods")
    .select("id, method, billing_anchor_day, dd_setup_status, masked_account_last4, masked_sort_last2, bank_name, account_holder_name")
    .eq("journey_id", journey.id)
    .eq("active", true)
    .maybeSingle();
  if (!pm) return jsonResponse({ error: "payment_method_missing" }, 409);

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, quote_number, plan_name, service_type, customer_type, monthly_gross, monthly_net, monthly_vat_amount, setup_gross, total_due_today_gross, contract_length_months, quote_request_id, selected_addons")
    .eq("id", journey.quote_id)
    .maybeSingle();
  if (!quote) return jsonResponse({ error: "quote_missing" }, 500);

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, phone, address_line_1, address_line_2, town, postcode, current_provider, marketing_consent")
    .eq("id", quote.quote_request_id)
    .maybeSingle();
  if (!qr?.email || !qr?.full_name) return jsonResponse({ error: "customer_details_missing" }, 409);

  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("id, cs_number, version, public_token_hash, pdf_storage_key")
    .eq("quote_id", quote.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Idempotent guest_orders creation — keyed off journey id via admin_notes JSON tag.
  // (We can't add a column safely without coordination; we look up by tag instead.)
  const journeyTag = `journey:${journey.id}`;
  const { data: existingOrder } = await supabase
    .from("guest_orders")
    .select("id, order_number, status, created_at")
    .ilike("admin_notes", `%${journeyTag}%`)
    .maybeSingle();

  let order = existingOrder;
  if (!order) {
    const order_number = genOrderNumber();
    const insert = await supabase
      .from("guest_orders")
      .insert({
        order_number,
        email: qr.email,
        full_name: qr.full_name,
        phone: qr.phone ?? "",
        address_line1: qr.address_line_1 ?? "",
        address_line2: qr.address_line_2 ?? null,
        city: qr.town ?? "",
        postcode: qr.postcode ?? "",
        current_provider: qr.current_provider ?? null,
        preferred_switch_date: journey.preferred_start_date,
        gdpr_consent: true,
        marketing_consent: qr.marketing_consent ?? false,
        plan_name: quote.plan_name,
        plan_price: quote.monthly_gross,
        service_type: quote.service_type,
        selected_addons: quote.selected_addons ?? null,
        status: "pending_provisioning",
        admin_notes: `Unified journey submission. ${journeyTag} quote:${quote.quote_number} pm:${pm.method} day:${pm.billing_anchor_day}`,
      })
      .select("id, order_number, status, created_at")
      .single();
    if (insert.error) return jsonResponse({ error: "order_insert_failed", details: insert.error.message }, 500);
    order = insert.data;
  }

  // Mark journey submitted/completed atomically with the idempotency key.
  const submitUpd = await supabase
    .from("order_journeys")
    .update({
      current_step: "complete",
      status: "completed",
      submitted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      idempotency_key,
      ip, ua,
    })
    .eq("id", journey.id)
    .is("submitted_at", null)
    .select("id, submitted_at, completed_at, idempotency_key")
    .maybeSingle();

  // If null came back, another concurrent submit won the race — replay.
  if (submitUpd.error) return jsonResponse({ error: "journey_finalise_failed", details: submitUpd.error.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey_order_submitted",
    _title: `Order submitted from journey ${quote.quote_number}`,
    _details: {
      journey_id: journey.id, quote_id: quote.id, order_id: order.id,
      order_number: order.order_number, payment_method: pm.method,
      billing_anchor_day: pm.billing_anchor_day,
      preferred_start_date: journey.preferred_start_date,
    },
    _source_module: "journey",
    _quote_id: quote.id,
  }).then(() => {}).catch(() => {});

  // Consolidated onboarding email (best-effort, idempotent on consolidated_email_sent_at).
  if (!journey.consolidated_email_sent_at) {
    try {
      const monthly = `£${Number(quote.monthly_gross).toFixed(2)}`;
      const startDateGB = new Date(journey.preferred_start_date as string)
        .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const pmLine = pm.method === "direct_debit"
        ? `Pay monthly by BACS Direct Debit`
        : `Monthly invoice paid online via secure payment link`;
      const dayLine = pm.method === "direct_debit"
        ? `Preferred collection day: <strong>${pm.billing_anchor_day}</strong>`
        : `Preferred invoice day: <strong>${pm.billing_anchor_day}</strong>`;

      // Build signed URL to the immutable signed-contract PDF and download
      // bytes for direct attachment to the email. Both are best-effort — if
      // either fails we still send the email without breaking the order.
      let csSignedUrl: string | null = null;
      let pdfAttachment: { filename: string; content: string; contentType: string } | null = null;
      if (cs?.pdf_storage_key) {
        try {
          const { data: signed } = await supabase
            .storage.from("contract-pdfs")
            .createSignedUrl(cs.pdf_storage_key, 60 * 60 * 24 * 30);
          csSignedUrl = signed?.signedUrl ?? null;

          const { data: dl } = await supabase
            .storage.from("contract-pdfs")
            .download(cs.pdf_storage_key);
          if (dl) {
            const bytes = new Uint8Array(await dl.arrayBuffer());
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            pdfAttachment = {
              filename: `Contract-Summary-${cs.cs_number ?? quote.quote_number}.pdf`,
              content: btoa(bin),
              contentType: "application/pdf",
            };
          }
        } catch (e) {
          console.warn("[journey-submit-order] pdf fetch failed", e);
        }
      }

      const body = `
        <p>Hi ${escapeHtml(qr.full_name)},</p>
        <p>Thanks for confirming your order with OCCTA — here's a summary you can keep.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;background:#facc15;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Order</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(order.order_number)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Plan</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(quote.plan_name)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Monthly</td><td style="padding:10px 12px;border-bottom:1px solid #000;"><strong>${monthly}</strong></td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Preferred start date</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(startDateGB)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Service address</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml([qr.address_line_1, qr.address_line_2, qr.town, qr.postcode].filter(Boolean).join(", "))}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Payment method</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(pmLine)}</td></tr>
          <tr><td style="padding:10px 12px;">Billing day</td><td style="padding:10px 12px;">${dayLine}</td></tr>
        </table>
        <p style="font-size:14px;">
          Your signed <strong>Contract Summary</strong> is attached to this email as a PDF for your records${csSignedUrl ? `, and can also be viewed online via the button below` : ""}.
        </p>
        <p style="font-size:13px;color:#444;">
          <strong>Your 14-day cooling-off period</strong> ends on ${escapeHtml(new Date(journey.cooling_off_ends_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}. You can cancel within this window for a full refund of anything paid.
        </p>
        <p style="font-size:13px;color:#444;">
          We'll be in touch with your provisioning timeline shortly. <strong>No payment has been taken</strong>; billing only begins once your service is confirmed active.
        </p>
      `;
      const html = brutalistEmailShell(
        "Your OCCTA order is in",
        body,
        csSignedUrl
          ? { label: "View your signed contract summary", url: csSignedUrl }
          : undefined,
      );
      await sendResendEmail({
        to: qr.email,
        subject: `Order ${order.order_number} confirmed — OCCTA`,
        html,
        replyTo: "hello@occta.co.uk",
        attachments: pdfAttachment ? [pdfAttachment] : undefined,
      });
      await supabase
        .from("order_journeys")
        .update({ consolidated_email_sent_at: new Date().toISOString() })
        .eq("id", journey.id);
    } catch (e) {
      console.warn("[journey-submit-order] consolidated email failed", e);
    }

    try {
      await supabase.functions.invoke("admin-notify", {
        body: {
          type: "new_guest_order",
          data: {
            order_number: order.order_number,
            customer_name: qr.full_name,
            customer_email: qr.email,
            postcode: qr.postcode,
            plan_name: quote.plan_name,
            monthly_gross: quote.monthly_gross,
            payment_method: pm.method,
            billing_anchor_day: pm.billing_anchor_day,
            preferred_start_date: journey.preferred_start_date,
            journey_id: journey.id,
            quote_number: quote.quote_number,
            source: "unified_journey",
          },
        },
      });
    } catch (e) {
      console.warn("[journey-submit-order] admin-notify failed", e);
    }
  }

  return jsonResponse({
    ok: true,
    replayed: false,
    order: { id: order.id, order_number: order.order_number, status: order.status },
    journey: { id: journey.id, status: "completed", current_step: "complete" },
  });
});

async function guestOrderIdForJourney(supabase: ReturnType<typeof getServiceClient>, journeyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("guest_orders")
    .select("id")
    .ilike("admin_notes", `%journey:${journeyId}%`)
    .maybeSingle();
  return data?.id ?? null;
}