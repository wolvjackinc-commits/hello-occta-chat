import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  requireStaff,
  sendResendEmail,
  brutalistEmailShell,
  escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { ddGuaranteeHtml } from "../_shared/directDebitGuarantee.ts";

/**
 * Admin-only: promote a completed guest_orders row into a full Customer
 * record so it appears in Customer 360 and the customer dashboard.
 *
 * Idempotent. Safe to invoke multiple times for the same guest order.
 *
 * Steps:
 *   1. Find/create auth.users for the order email (invite by email).
 *   2. handle_new_user trigger creates the profiles row + 'user' role +
 *      account_number; we then backfill profile fields from the order.
 *   3. Insert an orders row linked to user_id (one per guest order, idempotent).
 *   4. Backfill foreign keys on:
 *        - guest_orders.user_id / linked_at
 *        - order_journeys.linked_customer_id / linked_at / customer_id
 *        - contract_summaries.customer_id (for the journey's CS)
 *        - payment_methods.customer_id (via journey_id)
 *        - dd_mandates.user_id (matching payment_methods.id)
 *   5. Send a welcome email with the magic-link to set password and the
 *      Direct Debit Guarantee block, with the signed CS PDF attached.
 */

const PUBLIC_APP_ORIGIN = "https://www.occta.co.uk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "sales_agent", "support_agent"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const body = await req.json().catch(() => ({}));
  const guest_order_id: string | undefined = body?.guest_order_id;
  if (!guest_order_id) return jsonResponse({ error: "guest_order_id_required" }, 400);

  const supabase = getServiceClient();

  // 1. Load the guest order
  const { data: g, error: gErr } = await supabase
    .from("guest_orders")
    .select("*")
    .eq("id", guest_order_id)
    .maybeSingle();
  if (gErr || !g) return jsonResponse({ error: "guest_order_not_found" }, 404);

  const email = String(g.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ error: "order_missing_email" }, 400);

  // 2. Find or invite the auth user
  let userId: string | null = g.user_id ?? null;

  if (!userId) {
    // Look up existing auth user by email
    try {
      // listUsers is paginated; use 1 page filtered by email via getUserByEmail-like path
      // Supabase JS v2 does not expose getUserByEmail server-side, so we fall back to a
      // direct admin SQL lookup via service role.
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (existing?.id) userId = existing.id;
    } catch (_e) { /* ignore */ }
  }

  let inviteSent = false;
  let actionLink: string | null = null;

  if (!userId) {
    const inviteRedirectTo = `${PUBLIC_APP_ORIGIN}/auth?welcome=1`;
    // Try invite first (sends Supabase invite email + creates user)
    const invite = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirectTo,
      data: { full_name: g.full_name ?? "" },
    });
    if (invite.error || !invite.data?.user) {
      // Fall back to createUser + recovery link
      const created = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: g.full_name ?? "" },
      });
      if (created.error || !created.data?.user) {
        return jsonResponse({
          error: "user_create_failed",
          details: created.error?.message ?? invite.error?.message ?? null,
        }, 500);
      }
      userId = created.data.user.id;
      // Generate a recovery link they can use to set their password
      const link = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: inviteRedirectTo },
      });
      actionLink = link.data?.properties?.action_link ?? null;
    } else {
      userId = invite.data.user.id;
      inviteSent = true;
      actionLink = (invite.data as any)?.properties?.action_link ?? null;
    }
  }

  if (!userId) return jsonResponse({ error: "user_id_unresolved" }, 500);

  // 3. Backfill profile fields from the order
  await supabase
    .from("profiles")
    .update({
      full_name: g.full_name ?? null,
      phone: g.phone ?? null,
      address_line1: g.address_line1 ?? null,
      address_line2: g.address_line2 ?? null,
      city: g.city ?? null,
      postcode: g.postcode ?? null,
      date_of_birth: g.date_of_birth ?? null,
    })
    .eq("id", userId);

  // Make sure profile has an account_number; trigger should have assigned one,
  // but if a pre-existing profile lacks one (legacy), copy from guest_orders.
  const { data: profileNow } = await supabase
    .from("profiles")
    .select("account_number, email")
    .eq("id", userId)
    .maybeSingle();
  let accountNumber = profileNow?.account_number ?? null;
  if (!accountNumber) {
    if (g.account_number) {
      accountNumber = g.account_number;
    } else {
      const { data: gen } = await supabase.rpc("generate_user_account_number");
      accountNumber = (gen as unknown as string) ?? null;
    }
    if (accountNumber) {
      await supabase.from("profiles").update({ account_number: accountNumber }).eq("id", userId);
    }
  }

  // 4. Locate the journey for this guest order (admin_notes tag set by submit fn)
  const journeyTagMatch = String(g.admin_notes ?? "").match(/journey:([0-9a-f-]{36})/i);
  const journeyId = journeyTagMatch ? journeyTagMatch[1] : null;

  let journey: any = null;
  let cs: any = null;
  let pm: any = null;
  if (journeyId) {
    const j = await supabase
      .from("order_journeys")
      .select("id, quote_id, contract_summary_id, preferred_start_date, payment_method, billing_anchor_day, cooling_off_ends_at")
      .eq("id", journeyId)
      .maybeSingle();
    journey = j.data;
    if (journey?.contract_summary_id) {
      const c = await supabase
        .from("contract_summaries")
        .select("id, cs_number, pdf_storage_key")
        .eq("id", journey.contract_summary_id)
        .maybeSingle();
      cs = c.data;
    }
    const p = await supabase
      .from("payment_methods")
      .select("id, method, billing_anchor_day, dd_setup_status")
      .eq("journey_id", journeyId)
      .eq("active", true)
      .maybeSingle();
    pm = p.data;
  }

  // 5. Insert an orders row (idempotent by journey_id when present)
  let orderRowId: string | null = null;
  if (journeyId) {
    const existingOrder = await supabase
      .from("orders")
      .select("id")
      .eq("journey_id", journeyId)
      .maybeSingle();
    orderRowId = existingOrder.data?.id ?? null;
  }
  if (!orderRowId) {
    const ins = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        service_type: g.service_type,
        plan_name: g.plan_name,
        plan_price: g.plan_price,
        status: g.status === "active" ? "active" : "confirmed",
        postcode: g.postcode,
        address_line1: g.address_line1,
        address_line2: g.address_line2,
        city: g.city,
        notes: `Promoted from guest order ${g.order_number}`,
        admin_notes: `guest_order:${g.id}${journeyId ? ` journey:${journeyId}` : ""}`,
        journey_id: journeyId,
        payment_method: pm?.method ?? journey?.payment_method ?? null,
        billing_anchor_day: pm?.billing_anchor_day ?? journey?.billing_anchor_day ?? null,
        preferred_start_date: journey?.preferred_start_date ?? g.preferred_switch_date ?? null,
        cooling_off_ends_at: journey?.cooling_off_ends_at ?? null,
      })
      .select("id")
      .single();
    if (ins.error) {
      return jsonResponse({ error: "order_insert_failed", details: ins.error.message }, 500);
    }
    orderRowId = ins.data.id;
  }

  // 6. Backfill foreign keys
  await supabase
    .from("guest_orders")
    .update({ user_id: userId, linked_at: new Date().toISOString() })
    .eq("id", g.id);

  if (journeyId) {
    await supabase
      .from("order_journeys")
      .update({
        linked_customer_id: userId,
        customer_id: userId,
        linked_at: new Date().toISOString(),
      })
      .eq("id", journeyId);
  }

  if (cs?.id) {
    await supabase
      .from("contract_summaries")
      .update({ customer_id: userId })
      .eq("id", cs.id)
      .is("customer_id", null);
  }

  if (pm?.id) {
    await supabase
      .from("payment_methods")
      .update({ customer_id: userId })
      .eq("id", pm.id);
    // Link any dd_mandate created for this payment method
    await supabase
      .from("dd_mandates")
      .update({ user_id: userId })
      .eq("payment_request_id", pm.id)
      .is("user_id", null);
  }

  // 7. Audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: staff.userId,
    action: "promote_guest_to_customer",
    entity: "guest_orders",
    entity_id: g.id,
    metadata: {
      promoted_user_id: userId,
      account_number: accountNumber,
      order_id: orderRowId,
      journey_id: journeyId,
      contract_summary_id: cs?.id ?? null,
      payment_method_id: pm?.id ?? null,
      invite_sent: inviteSent,
    },
  });

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "customer_promoted",
    _title: `Guest order ${g.order_number} promoted to customer`,
    _details: {
      guest_order_id: g.id,
      order_id: orderRowId,
      user_id: userId,
      account_number: accountNumber,
      invite_sent: inviteSent,
    },
    _customer_id: userId,
    _source_module: "customers",
    _severity: "info",
  }).then(() => {}).catch(() => {});

  // 8. Welcome email with set-password link + signed CS PDF + DD guarantee
  try {
    let pdfAttachment: { filename: string; content: string; contentType: string } | null = null;
    if (cs?.pdf_storage_key) {
      try {
        const { data: dl } = await supabase
          .storage.from("contract-pdfs")
          .download(cs.pdf_storage_key);
        if (dl) {
          const bytes = new Uint8Array(await dl.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          pdfAttachment = {
            filename: `Contract-Summary-${cs.cs_number ?? g.order_number}.pdf`,
            content: btoa(bin),
            contentType: "application/pdf",
          };
        }
      } catch (e) {
        console.warn("[promote-guest-to-customer] pdf fetch failed", e);
      }
    }

    const ctaUrl = actionLink ?? `${PUBLIC_APP_ORIGIN}/auth?welcome=1&email=${encodeURIComponent(email)}`;
    const body = `
      <p>Hi ${escapeHtml(g.full_name ?? "")},</p>
      <p>Welcome to OCCTA. Your order <strong>${escapeHtml(g.order_number)}</strong> is set up and your customer account is ready.</p>
      <p>Use the button below to set your password and sign in to your dashboard, where you can view your contract, manage your Direct Debit, see invoices, and contact support.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:10px 12px;border-bottom:1px solid #000;background:#facc15;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Account number</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(accountNumber ?? "—")}</td></tr>
        <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Order</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(g.order_number)}</td></tr>
        <tr><td style="padding:10px 12px;border-bottom:1px solid #000;">Plan</td><td style="padding:10px 12px;border-bottom:1px solid #000;">${escapeHtml(g.plan_name ?? "")}</td></tr>
        <tr><td style="padding:10px 12px;">Status</td><td style="padding:10px 12px;">${escapeHtml(String(g.status ?? ""))}</td></tr>
      </table>
      <p style="font-size:13px;color:#444;">Your signed Contract Summary is attached as a PDF for your records.</p>
      ${ddGuaranteeHtml()}
    `;
    const html = brutalistEmailShell("Your OCCTA account is ready", body, {
      label: "Set password & sign in",
      url: ctaUrl,
    });
    await sendResendEmail({
      to: email,
      subject: `Welcome to OCCTA — your account is ready (${g.order_number})`,
      html,
      replyTo: "hello@occta.co.uk",
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });
  } catch (e) {
    console.warn("[promote-guest-to-customer] welcome email failed", e);
  }

  return jsonResponse({
    ok: true,
    user_id: userId,
    account_number: accountNumber,
    order_id: orderRowId,
    invite_sent: inviteSent,
  });
});