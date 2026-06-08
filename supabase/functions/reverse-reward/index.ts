import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { reward_id, reason } = (await req.json().catch(() => ({}))) as { reward_id?: string; reason?: string };
  if (!reward_id) return jsonResponse({ error: "missing_reward_id" }, 400);
  if (!reason || reason.trim().length < 10) return jsonResponse({ error: "reason_required_min_10" }, 400);

  const svc = getServiceClient();
  const { data: reward } = await svc.from("rewards").select("*").eq("id", reward_id).maybeSingle();
  if (!reward) return jsonResponse({ error: "not_found" }, 404);
  if (reward.status === "reversed") return jsonResponse({ error: "already_reversed" }, 409);

  const isBillCredit = reward.reward_type === "bill_credit";
  await svc.from("points_ledger").insert({
    customer_id: reward.customer_id,
    source_type: "reversal",
    source_id: reward.id,
    points_delta: isBillCredit ? 0 : -Math.round(Number(reward.reward_value ?? 0)),
    bill_credit_delta: isBillCredit ? -Number(reward.reward_value ?? 0) : 0,
    status: "reversed",
    reason: `Reversal: ${reason.trim().slice(0, 300)}`,
    created_by: auth.userId,
  });

  await svc.from("rewards").update({
    status: "reversed",
    reversal_reason: reason.trim().slice(0, 500),
  }).eq("id", reward.id);

  await svc.rpc("recompute_reward_balances", { _customer_id: reward.customer_id });

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "reward_reversed",
    _title: "Reward reversed",
    _customer_id: reward.customer_id,
    _source_module: "rewards", _severity: "warn",
    _details: { reward_id: reward.id, reason: reason.trim().slice(0, 200) },
  });

  return jsonResponse({ ok: true });
});