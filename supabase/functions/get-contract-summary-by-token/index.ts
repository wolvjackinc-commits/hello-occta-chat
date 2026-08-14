import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "get_cs_by_token", 60, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();
  // Explicit customer-safe column allow-list. Internal audit fields
  // (accepted_ip, accepted_user_agent, pdf_generated_by, pdf_storage_key,
  // pdf_sha256, archived_reason, archived_at, public_token_hash) are never
  // returned to token holders.
  const CS_PUBLIC_COLUMNS =
    "id,cs_number,quote_id,quote_request_id,customer_id,version,status," +
    "customer_email_snapshot,customer_name_snapshot,service_address," +
    "authorised_signatory_note," +
    "plan_name,service_type,plan_type,customer_type,monthly_price_incl_vat," +
    "business_monthly_ex_vat,business_monthly_incl_vat,one_off_charges_json," +
    "setup_charge,router_charge,delivery_charge,installation_charge," +
    "cease_cancellation_charges,contract_length,notice_period," +
    "estimated_download_speed,estimated_upload_speed,speed_notes," +
    "price_rise_policy,digital_voice_warning,vulnerable_customer_note," +
    "complaints_adr_info,payment_schedule,terms_version,privacy_version," +
    "token_expires_at,issued_at,accepted_at,pdf_url,emailed_at," +
    "created_at,updated_at,speed_bucket,plan_term,router_option,setup_option," +
    "selected_addons,pdf_generated_at,account_number";
  const { data: cs, error } = await supabase
    .from("contract_summaries")
    .select(CS_PUBLIC_COLUMNS)
    .eq("public_token_hash", hash)
    .maybeSingle();

  if (error || !cs) return jsonResponse({ error: "not_found" }, 404);

  if (cs.status === "issued") {
    await supabase.from("contract_summaries").update({ status: "viewed" }).eq("id", cs.id);
    await supabase.rpc("log_event", {
      _actor_type: "public", _event_type: "contract_summary_viewed",
      _title: `CS viewed ${cs.cs_number}`,
      _details: { contract_summary_id: cs.id, quote_id: cs.quote_id },
      _source_module: "contract_summary",
    });
    await supabase.from("quote_events").insert({
      quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
      event_type: "contract_summary_viewed", title: "Contract Summary viewed", actor_type: "public",
    });
  }

  return jsonResponse({ ok: true, contract_summary: cs });
});