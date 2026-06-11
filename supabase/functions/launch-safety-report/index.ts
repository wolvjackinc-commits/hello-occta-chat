import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_WEBHOOK_URL =
  "https://oexgjmuvgdndizsufipe.functions.supabase.co/worldpay-webhook";
const CONTRACT_PDF_BUCKET = "contract-pdfs";

function maskVat(vat: string | null | undefined) {
  if (!vat) return null;
  const trimmed = String(vat).trim();
  if (trimmed.length <= 4) return "****";
  const last4 = trimmed.slice(-4);
  return `${trimmed.slice(0, 2)}${"*".repeat(Math.max(3, trimmed.length - 6))}${last4}`;
}

function looksPlaceholder(vat: string | null | undefined) {
  if (!vat) return false;
  const v = String(vat).toLowerCase();
  return /test|placeholder|xxx|0000|1234/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Config presence (booleans only)
    const worldpay_live_mode =
      (Deno.env.get("WORLDPAY_LIVE_MODE") ?? "").toLowerCase() === "true";
    const worldpay_entity_id_present = !!Deno.env.get("WORLDPAY_ENTITY_ID");
    const worldpay_api_username_present = !!Deno.env.get("WORLDPAY_API_USERNAME");
    const worldpay_api_password_present = !!Deno.env.get("WORLDPAY_API_PASSWORD");
    const worldpay_webhook_secret_present = !!Deno.env.get(
      "WORLDPAY_WEBHOOK_SECRET",
    );

    // Storage bucket check
    let contract_pdfs_bucket_exists = false;
    try {
      const { data: bucket } = await admin.storage.getBucket(CONTRACT_PDF_BUCKET);
      contract_pdfs_bucket_exists = !!bucket;
    } catch (_) {
      contract_pdfs_bucket_exists = false;
    }

    // VAT (mask only)
    let vat_active = false;
    let vat_number_present = false;
    let vat_number_masked: string | null = null;
    let vat_looks_placeholder = false;
    try {
      const { data: settings } = await admin
        .from("platform_settings")
        .select("vat_number, vat_effective_date")
        .eq("singleton", true)
        .maybeSingle();
      const vn = settings?.vat_number ?? null;
      vat_number_present = !!vn && String(vn).trim().length > 0;
      vat_number_masked = vat_number_present ? maskVat(vn) : null;
      vat_looks_placeholder = vat_number_present && looksPlaceholder(vn);
      if (
        vat_number_present &&
        settings?.vat_effective_date &&
        new Date(settings.vat_effective_date).getTime() <= Date.now()
      ) {
        vat_active = true;
      }
    } catch (_) {
      /* ignore */
    }

    // Verified-paid evidence (any PR proving signed webhook works)
    let verified_paid_pr_count = 0;
    try {
      const { count } = await admin
        .from("payment_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid")
        .eq("webhook_verified", true)
        .not("paid_at", "is", null);
      verified_paid_pr_count = count ?? 0;
    } catch (_) {
      verified_paid_pr_count = 0;
    }

    return new Response(
      JSON.stringify({
        worldpay_live_mode,
        worldpay_entity_id_present,
        worldpay_api_username_present,
        worldpay_api_password_present,
        worldpay_webhook_secret_present,
        expected_webhook_url: EXPECTED_WEBHOOK_URL,
        contract_pdfs_bucket_exists,
        supplier_submission_enabled: false,
        vat_active,
        vat_number_present,
        vat_number_masked,
        vat_looks_placeholder,
        verified_paid_pr_count,
        generated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});