import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, requireStaff, escapeHtml } from "../_shared/quoteHelpers.ts";

// Phase 2 minimal: returns a self-contained printable HTML document for the CS.
// Customers and admin can use the browser "Save as PDF" or the dedicated print view.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { token?: string; contract_summary_id?: string }));
  const supabase = getServiceClient();

  let cs: any = null;
  if (body.contract_summary_id) {
    // Admin path
    const auth = await requireStaff(req);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    const { data } = await supabase.from("contract_summaries").select("*").eq("id", body.contract_summary_id).maybeSingle();
    cs = data;
  } else if (body.token) {
    const hash = await sha256Hex(body.token);
    const { data } = await supabase.from("contract_summaries").select("*").eq("public_token_hash", hash).maybeSingle();
    cs = data;
  } else {
    return jsonResponse({ error: "missing_identifier" }, 400);
  }
  if (!cs) return jsonResponse({ error: "not_found" }, 404);

  const oneOff = (cs.one_off_charges_json as Array<{label: string; amount: number}> | null) ?? [];
  const oneOffRows = oneOff.map((c) => `<tr><td>${escapeHtml(c.label)}</td><td style="text-align:right;">£${Number(c.amount).toFixed(2)}</td></tr>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Contract Summary ${escapeHtml(cs.cs_number)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;max-width:780px;margin:24px auto;padding:24px;border:4px solid #000;}
      h1{font-size:24px;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 8px 0;}
      h2{font-size:14px;text-transform:uppercase;letter-spacing:0.08em;margin:24px 0 8px 0;border-bottom:2px solid #000;padding-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;}
      td{padding:6px 0;border-bottom:1px solid #eee;font-size:13px;}
      .muted{color:#555;font-size:12px;}
      .warn{padding:10px;border:2px solid #b00;background:#fff5f5;font-size:12px;margin-top:12px;}
    </style></head>
  <body>
    <h1>Contract Summary</h1>
    <div class="muted">${escapeHtml(cs.cs_number)} · Version ${cs.version} · Status: ${escapeHtml(cs.status)}</div>
    <h2>Customer & service</h2>
    <table>
      <tr><td>Customer</td><td>${escapeHtml(cs.customer_name_snapshot)} (${escapeHtml(cs.customer_email_snapshot)})</td></tr>
      <tr><td>Service address</td><td>${escapeHtml(cs.service_address)}</td></tr>
      <tr><td>Plan</td><td>${escapeHtml(cs.plan_name)} (${escapeHtml(cs.plan_type)}, ${escapeHtml(cs.customer_type)})</td></tr>
      <tr><td>Contract length</td><td>${escapeHtml(cs.contract_length)}</td></tr>
      <tr><td>Notice period</td><td>${escapeHtml(cs.notice_period)}</td></tr>
    </table>
    <h2>Pricing</h2>
    <table>
      ${cs.customer_type === "business"
        ? `<tr><td>Monthly (ex VAT)</td><td style="text-align:right;">£${Number(cs.business_monthly_ex_vat ?? 0).toFixed(2)}</td></tr>
           <tr><td>Monthly (incl VAT)</td><td style="text-align:right;">£${Number(cs.business_monthly_incl_vat ?? 0).toFixed(2)}</td></tr>`
        : `<tr><td>Monthly (incl VAT)</td><td style="text-align:right;">£${Number(cs.monthly_price_incl_vat).toFixed(2)}</td></tr>`}
    </table>
    ${oneOffRows ? `<h2>One-off charges</h2><table>${oneOffRows}</table>` : ""}
    <h2>Cease / cancellation</h2>
    <p class="muted">${escapeHtml(cs.cease_cancellation_charges ?? "")}</p>
    <h2>Speed estimate</h2>
    <p class="muted">Download: ${cs.estimated_download_speed ?? "—"} Mbps · Upload: ${cs.estimated_upload_speed ?? "—"} Mbps. ${escapeHtml(cs.speed_notes ?? "")}</p>
    <h2>Price rises</h2>
    <p class="muted">${escapeHtml(cs.price_rise_policy)}</p>
    ${cs.digital_voice_warning ? `<div class="warn">${escapeHtml(cs.digital_voice_warning)}</div>` : ""}
    <h2>Vulnerable customers</h2>
    <p class="muted">${escapeHtml(cs.vulnerable_customer_note ?? "")}</p>
    <h2>Complaints & ADR</h2>
    <p class="muted">${escapeHtml(cs.complaints_adr_info)}</p>
    <h2>Payment</h2>
    <p class="muted">${escapeHtml(cs.payment_schedule)}</p>
    <h2>Versions</h2>
    <p class="muted">Terms version: ${escapeHtml(cs.terms_version)} · Privacy version: ${escapeHtml(cs.privacy_version)}</p>
    ${cs.accepted_at ? `<h2>Acceptance</h2><p class="muted">Accepted at ${escapeHtml(cs.accepted_at)} from IP ${escapeHtml(cs.accepted_ip ?? "")}.</p>` : ""}
  </body></html>`;

  return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
});