import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = (await req.json().catch(() => ({}))) as {
    reward_id?: string;
    override_reason?: string;
  };
  if (!body.reward_id) return jsonResponse({ error: "missing_reward_id" }, 400);

  const svc = getServiceClient();
  const { data: reward } = await svc.from("rewards").select("*").eq("id", body.reward_id).maybeSingle();
  if (!reward) return jsonResponse({ error: "not_found" }, 404);

  // Role/type restriction: finance_admin only for bill_credit
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", auth.userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const isAdmin = roleSet.has("admin") || roleSet.has("super_admin");
  const isFinance = roleSet.has("finance_admin");
  if (!isAdmin && isFinance && reward.reward_type !== "bill_credit") {
    return jsonResponse({ error: "finance_admin_limited_to_bill_credit" }, 403);
  }

  // Re-check margin
  let marginStatus = reward.margin_check_status as string | null;
  if (reward.related_quote_id) {
    const { data: mc } = await svc.from("quote_margin_checks")
      .select("status").eq("quote_id", reward.related_quote_id)
      .order("checked_at", { ascending: false }).limit(1).maybeSingle();
    if (mc) marginStatus = (mc as any).status;
  }

  if (marginStatus === "red") {
    if (!isAdmin) return jsonResponse({ error: "red_margin_requires_admin_override" }, 403);
    if (!body.override_reason || body.override_reason.trim().length < 10) {
      return jsonResponse({ error: "override_reason_required_min_10" }, 400);
    }
  }

  // Insert approved ledger row
  const isBillCredit = reward.reward_type === "bill_credit";
  await svc.from("points_ledger").insert({
    customer_id: reward.customer_id,
    source_type: "campaign",
    source_id: reward.id,
    points_delta: isBillCredit ? 0 : Math.round(Number(reward.reward_value ?? 0)),
    bill_credit_delta: isBillCredit ? Number(reward.reward_value ?? 0) : 0,
    status: "approved",
    reason: `Reward approved: ${reward.reward_type}${body.override_reason ? ` (OVERRIDE: ${body.override_reason.trim().slice(0, 200)})` : ""}`,
    created_by: auth.userId,
    available_at: new Date().toISOString(),
  });

  // Update reward
  await svc.from("rewards").update({
    status: "issued",
    margin_check_status: marginStatus,
    admin_approved_by: auth.userId,
    admin_approved_at: new Date().toISOString(),
  }).eq("id", reward.id);

  // Recompute balances
  await svc.rpc("recompute_reward_balances", { _customer_id: reward.customer_id });

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "reward_approved",
    _title: "Reward approved",
    _customer_id: reward.customer_id,
    _source_module: "rewards", _severity: marginStatus === "red" ? "warn" : "info",
    _details: { reward_id: reward.id, reward_type: reward.reward_type, margin_status: marginStatus, overridden: marginStatus === "red" },
  });

  return jsonResponse({ ok: true });
});