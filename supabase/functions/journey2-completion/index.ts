/**
 * Journey 2 — completion view (read only).
 *
 * Loads the committed order and its immutable contractual snapshot for
 * /order/:token/complete. It never creates or modifies an order, a customer,
 * a Direct Debit request or an email.
 */
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { getTestCompletion } from "../_shared/journey2TestPath.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_completion", 60, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);

  // An isolated TEST token resolves only against the journey2_test_* tables.
  const testResult = await getTestCompletion(supabase, parsed.data.token);
  if (testResult) {
    if (!testResult.completion) return jsonResponse({ error: "not_completed" }, 409);
    return jsonResponse({ ok: true, completion: testResult.completion });
  }

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("id, test_session, order_id, quote_id, order_journey_id, preferred_start_date, billing_anchor_day, dd_masked, dd_status, selected_addons, contract_summary_id")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);

  const { data: snapshot } = await supabase
    .from("journey2_contract_snapshots")
    .select("snapshot, snapshot_sha256")
    .eq("session_id", session.id)
    .maybeSingle();
  if (!snapshot) return jsonResponse({ error: "not_completed" }, 409);

  const snap = snapshot.snapshot as Record<string, any>;
  const pricing = snap?.pricing ?? {};

  let orderNumber: string | null = null;
  let coolingOffEndsAt: string | null = null;
  if (session.order_id) {
    const { data: order } = await supabase
      .from("orders").select("occta_order_number, cooling_off_ends_at").eq("id", session.order_id).maybeSingle();
    orderNumber = order?.occta_order_number ?? null;
    coolingOffEndsAt = order?.cooling_off_ends_at ?? null;
  }
  if (!orderNumber) return jsonResponse({ error: "not_completed" }, 409);

  const documents: { label: string; url: string | null }[] = [];
  if (session.contract_summary_id) {
    const { data: cs } = await supabase
      .from("contract_summaries").select("pdf_storage_key").eq("id", session.contract_summary_id).maybeSingle();
    let url: string | null = null;
    if (cs?.pdf_storage_key) {
      const signed = await supabase.storage.from("contract-pdfs").createSignedUrl(cs.pdf_storage_key, 3600);
      url = signed.data?.signedUrl ?? null;
    }
    documents.push({ label: "Signed Contract Summary", url });
    const { data: cip } = await supabase
      .from("contract_information_packs").select("pdf_storage_key").eq("contract_summary_id", session.contract_summary_id).maybeSingle();
    let cipUrl: string | null = null;
    if (cip?.pdf_storage_key) {
      const signed = await supabase.storage.from("contract-pdfs").createSignedUrl(cip.pdf_storage_key, 3600);
      cipUrl = signed.data?.signedUrl ?? null;
    }
    documents.push({ label: "Contract Information", url: cipUrl });
    const { data: cert } = await supabase
      .from("acceptance_certificates").select("pdf_storage_key").eq("contract_summary_id", session.contract_summary_id).maybeSingle();
    let certUrl: string | null = null;
    if (cert?.pdf_storage_key) {
      const signed = await supabase.storage.from("contract-pdfs").createSignedUrl(cert.pdf_storage_key, 3600);
      certUrl = signed.data?.signedUrl ?? null;
    }
    documents.push({ label: "Acceptance certificate", url: certUrl });
  }
  documents.push({ label: "Direct Debit Guarantee", url: "/legal/direct-debit-guarantee" });
  documents.push({ label: "Cooling-off information", url: "/legal/switching-policy" });
  if (((session.selected_addons ?? []) as string[]).includes("digital_voice")) {
    documents.push({ label: "Digital Voice information", url: "/landline" });
  }

  const masked = session.dd_masked as Record<string, any> | null;
  const product = snap?.product ?? {};
  const addr = (snap?.service_address ?? {}) as Record<string, string | null>;
  const addressLine = [addr.line1, addr.line2, addr.city, addr.postcode]
    .filter((x) => !!x && String(x).trim().length > 0).join(", ") || null;

  return jsonResponse({
    ok: true,
    completion: {
      test_session: !!session.test_session,
      order_number: orderNumber,
      plan_name: snap?.product?.plan_name ?? null,
      contract_term: product.contract_term ?? null,
      minimum_term_months: product.minimum_term_months ?? null,
      estimated_download_mbps: product.estimated_download_mbps ?? null,
      estimated_upload_mbps: product.estimated_upload_mbps ?? null,
      speed_statement: product.speed_statement ?? null,
      customer_name: snap?.customer?.full_name ?? null,
      customer_email: snap?.customer?.email ?? null,
      service_address: addressLine,
      addons: Array.isArray(snap?.addons)
        ? (snap.addons as { id: string; label: string; monthly: number }[]).map((a) => ({
            id: a.id, label: a.label, monthly: Number(a.monthly ?? 0),
          }))
        : [],
      router_label: (snap?.router as Record<string, unknown> | null)?.label as string ?? null,
      current_provider: snap?.switching?.current_provider ?? null,
      number_action: snap?.switching?.number_action ?? null,
      monthly_ex_vat: Number(pricing.monthly_ex_vat ?? 0),
      monthly_vat: Number(pricing.monthly_vat ?? 0),
      monthly_incl_vat: Number(pricing.monthly_incl_vat ?? 0),
      one_off_charges_incl_vat: Number(pricing.one_off_charges_incl_vat ?? 0),
      amount_due_today: 0,
      estimated_first_bill_incl_vat: Number(pricing.estimated_first_bill_incl_vat ?? 0),
      vat_rate_percent: Number(pricing.vat_rate_percent ?? 0),
      preferred_start_date: session.preferred_start_date,
      billing_anchor_day: session.billing_anchor_day,
      dd_masked: masked
        ? {
            last4: masked.last4, sort_last2: masked.sort_last2,
            bank_name: masked.bank_name, account_holder_name: masked.account_holder_name,
          }
        : null,
      dd_status: session.dd_status ?? null,
      cooling_off_ends_at: coolingOffEndsAt,
      documents,
      digital_voice_selected: ((session.selected_addons ?? []) as string[]).includes("digital_voice"),
      snapshot_sha256: snapshot.snapshot_sha256,
    },
  });
});
