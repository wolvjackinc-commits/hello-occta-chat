import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin", "marketing_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { reward_id } = (await req.json().catch(() => ({}))) as { reward_id?: string };
  if (!reward_id) return jsonResponse({ error: "missing_reward_id" }, 400);

  const svc = getServiceClient();
  const { data: reward } = await svc.from("rewards").select("*").eq("id", reward_id).maybeSingle();
  if (!reward) return jsonResponse({ error: "not_found" }, 404);

  // Determine unlock rule
  const { data: ps } = await svc.from("platform_settings").select("rewards_unlock_rule, rewards_enabled").eq("singleton", true).maybeSingle();
  const unlockRule = ps?.rewards_unlock_rule ?? "first_cleared_payment";

  // Count cleared invoice payments for this customer
  const { count: paidCount } = await svc
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", reward.customer_id)
    .eq("status", "paid");

  let unlocked = false;
  if (unlockRule === "first_cleared_payment") unlocked = (paidCount ?? 0) >= 1;
  else if (unlockRule === "second_cleared_payment") unlocked = (paidCount ?? 0) >= 2;
  else unlocked = (paidCount ?? 0) >= 1; // custom_rule fallback

  // Margin guard for related quote
  let marginStatus: string | null = reward.margin_check_status ?? null;
  if (reward.related_quote_id) {
    const { data: mc } = await svc
      .from("quote_margin_checks").select("status")
      .eq("quote_id", reward.related_quote_id)
      .order("checked_at", { ascending: false }).limit(1).maybeSingle();
    if (mc) marginStatus = mc.status;
  }

  const newStatus = !ps?.rewards_enabled
    ? "blocked"
    : marginStatus === "red"
    ? "blocked"
    : unlocked
    ? "eligible"
    : "pending";

  await svc.from("rewards").update({
    status: newStatus,
    unlock_rule: unlockRule,
    margin_check_status: marginStatus,
  }).eq("id", reward_id);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "reward_eligibility_checked",
    _title: "Reward eligibility evaluated",
    _customer_id: reward.customer_id,
    _source_module: "rewards",
    _details: { reward_id, new_status: newStatus, unlock_rule: unlockRule, margin_status: marginStatus, paid_count: paidCount ?? 0 },
  });

  return jsonResponse({ ok: true, status: newStatus, unlock_rule: unlockRule, margin_status: marginStatus });
});