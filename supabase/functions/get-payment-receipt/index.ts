import { corsHeaders, jsonResponse, getServiceClient, sha256Hex } from "../_shared/quoteHelpers.ts";
import { perfServe } from "../_shared/perfLog.ts";

// Customer-safe payment receipt endpoint.
// - ?id=<pr_id>      → requires JWT; caller must be owner or staff
// - ?token=<raw>     → SHA-256 hashed lookup; only works for paid + webhook_verified PR
// Returns ONLY whitelisted fields. Never exposes token_hash, raw metadata,
// supplier/margin data, or webhook payloads.

const STAFF_ROLES = ["admin", "super_admin", "finance_admin", "support_agent", "sales_agent"];

function sanitize(pr: any, cs: any | null, profile: any | null) {
  return {
    receipt_ref: `RCPT-${pr.payment_request_number}`,
    payment_request_number: pr.payment_request_number,
    amount: Number(pr.amount ?? 0),
    currency: pr.currency || "GBP",
    paid_at: pr.paid_at,
    status: pr.status,
    webhook_verified: !!pr.webhook_verified,
    provider: pr.provider === "worldpay" ? "Worldpay" : (pr.provider || "Card"),
    provider_payment_id: pr.provider_payment_id,
    customer_name: pr.customer_name,
    customer_email: pr.customer_email,
    account_number: profile?.account_number ?? pr.account_number ?? null,
    contract_summary: cs ? {
      id: cs.id,
      cs_number: cs.cs_number,
      plan_name: cs.plan_name,
      monthly_price_incl_vat: Number(cs.monthly_price_incl_vat ?? 0),
    } : null,
  };
}

Deno.serve(perfServe("get-payment-receipt", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  let id = url.searchParams.get("id");
  let token = url.searchParams.get("token");
  if (req.method === "POST") {
    try {
      const body = await req.json();
      id = id ?? body?.id ?? null;
      token = token ?? body?.token ?? null;
    } catch { /* ignore */ }
  }

  const supabase = getServiceClient();

  // ----- Token path -----
  if (token) {
    const hash = await sha256Hex(token);
    const { data: pr } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("status", "paid")
      .eq("webhook_verified", true)
      .filter("metadata->>receipt_token_hash", "eq", hash)
      .maybeSingle();
    if (!pr) return jsonResponse({ error: "not_found" }, 404);
    // Token expires 60 days after paid_at
    const paidMs = pr.paid_at ? new Date(pr.paid_at).getTime() : 0;
    if (!paidMs || Date.now() - paidMs > 60 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: "expired" }, 410);
    }
    const [{ data: cs }, { data: profile }] = await Promise.all([
      pr.contract_summary_id
        ? supabase.from("contract_summaries").select("id,cs_number,plan_name,monthly_price_incl_vat").eq("id", pr.contract_summary_id).maybeSingle()
        : Promise.resolve({ data: null }),
      pr.user_id
        ? supabase.from("profiles").select("account_number").eq("id", pr.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return jsonResponse({ ok: true, receipt: sanitize(pr, cs, profile) });
  }

  // ----- Auth path -----
  if (!id) return jsonResponse({ error: "id_or_token_required" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);
  const { data: userResp, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userResp?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
  const userId = userResp.user.id;

  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (prErr || !pr) return jsonResponse({ error: "not_found" }, 404);

  // Ownership or staff
  const isOwner = pr.user_id && pr.user_id === userId;
  if (!isOwner) {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role));
    if (!isStaff) return jsonResponse({ error: "forbidden" }, 403);
  }

  if (!(pr.status === "paid" || pr.status === "completed") || !pr.webhook_verified || !pr.paid_at) {
    return jsonResponse({ error: "not_paid" }, 409);
  }

  const [{ data: cs }, { data: profile }] = await Promise.all([
    pr.contract_summary_id
      ? supabase.from("contract_summaries").select("id,cs_number,plan_name,monthly_price_incl_vat").eq("id", pr.contract_summary_id).maybeSingle()
      : Promise.resolve({ data: null }),
    pr.user_id
      ? supabase.from("profiles").select("account_number").eq("id", pr.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return jsonResponse({ ok: true, receipt: sanitize(pr, cs, profile) });
}));