import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("set_active"), active: z.boolean(), reason: z.string().min(10).max(500) }),
  z.object({ action: z.literal("evaluate") }),
  z.object({ action: z.literal("queue_payout"), reward_id: z.string().uuid() }),
  z.object({ action: z.literal("mark_issued"), reward_id: z.string().uuid(), payout_reference: z.string().min(4).max(200), payout_method: z.string().min(2).max(50).default("bank_transfer") }),
  z.object({ action: z.literal("block"), reward_id: z.string().uuid(), reason: z.string().min(10).max(500) }),
  z.object({ action: z.literal("reverse"), reward_id: z.string().uuid(), reason: z.string().min(10).max(500) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const svc = getServiceClient();
  const { data: roleRows } = await svc.from("user_roles").select("role").eq("user_id", auth.userId);
  const roles = new Set((roleRows ?? []).map((r: any) => String(r.role)));
  const isAdmin = roles.has("admin") || roles.has("super_admin");
  const isFinance = roles.has("finance_admin") || isAdmin;
  const now = new Date().toISOString();

  if (parsed.data.action === "status") {
    const [{ data: campaign }, { data: funnel }, { data: rewards }] = await Promise.all([
      svc.from("offer_campaigns").select("*").eq("code", "SWITCH50").maybeSingle(),
      svc.from("switch50_campaign_funnel").select("*").maybeSingle(),
      svc.from("promotion_rewards").select("id,campaign_code,order_id,customer_id,reward_amount,reward_currency,status,activation_at,eligibility_due_at,eligible_at,payout_queued_at,issued_at,payout_reference,payout_method,blocked_reason,created_at").eq("campaign_code", "SWITCH50").order("created_at", { ascending: false }).limit(250),
    ]);
    return jsonResponse({ ok: true, campaign, funnel, rewards: rewards ?? [] });
  }

  if (parsed.data.action === "set_active") {
    if (!isAdmin) return jsonResponse({ error: "admin_required" }, 403);
    const { error } = await svc.from("offer_campaigns").update({ active: parsed.data.active, updated_at: now }).eq("code", "SWITCH50");
    if (error) return jsonResponse({ error: "update_failed", details: error.message }, 500);
    await svc.rpc("log_event", {
      _actor_type: "admin", _event_type: parsed.data.active ? "switch50_enabled" : "switch50_paused",
      _title: `SWITCH50 ${parsed.data.active ? "enabled" : "paused"}`,
      _source_module: "campaigns", _severity: parsed.data.active ? "info" : "warn",
      _details: { reason: parsed.data.reason, actor_user_id: auth.userId },
    }).then(() => {}).catch(() => {});
    return jsonResponse({ ok: true, active: parsed.data.active });
  }

  if (parsed.data.action === "evaluate") {
    if (!isFinance) return jsonResponse({ error: "finance_or_admin_required" }, 403);
    const { data, error } = await svc.rpc("evaluate_promotion_rewards");
    if (error) return jsonResponse({ error: "evaluation_failed", details: error.message }, 500);
    return jsonResponse({ ok: true, changed: data ?? 0 });
  }

  const rewardId = parsed.data.reward_id;
  const { data: reward } = await svc.from("promotion_rewards").select("*").eq("id", rewardId).maybeSingle();
  if (!reward) return jsonResponse({ error: "reward_not_found" }, 404);

  if (parsed.data.action === "queue_payout") {
    if (!isFinance) return jsonResponse({ error: "finance_or_admin_required" }, 403);
    if (reward.status !== "eligible") return jsonResponse({ error: "reward_not_eligible", status: reward.status }, 409);
    const { error } = await svc.from("promotion_rewards").update({ status: "payout_queued", payout_queued_at: now, updated_at: now }).eq("id", rewardId).eq("status", "eligible");
    if (error) return jsonResponse({ error: "queue_failed", details: error.message }, 500);
    await logReward(svc, auth.userId, reward, "switch50_payout_queued", "SWITCH50 payout queued");
    return jsonResponse({ ok: true });
  }

  if (parsed.data.action === "mark_issued") {
    if (!isFinance) return jsonResponse({ error: "finance_or_admin_required" }, 403);
    if (!["eligible", "payout_queued"].includes(String(reward.status))) return jsonResponse({ error: "reward_not_payable", status: reward.status }, 409);
    const { error } = await svc.from("promotion_rewards").update({
      status: "issued",
      issued_at: now,
      payout_queued_at: reward.payout_queued_at ?? now,
      payout_reference: parsed.data.payout_reference.trim(),
      payout_method: parsed.data.payout_method.trim(),
      updated_at: now,
    }).eq("id", rewardId).in("status", ["eligible", "payout_queued"]);
    if (error) return jsonResponse({ error: "issue_failed", details: error.message }, 500);
    await logReward(svc, auth.userId, reward, "switch50_reward_issued", "SWITCH50 cash reward issued", {
      payout_reference: parsed.data.payout_reference.trim(), payout_method: parsed.data.payout_method.trim(),
    });
    return jsonResponse({ ok: true });
  }

  if (parsed.data.action === "block") {
    if (!isAdmin) return jsonResponse({ error: "admin_required" }, 403);
    if (reward.status === "issued") return jsonResponse({ error: "issued_reward_requires_reversal" }, 409);
    const { error } = await svc.from("promotion_rewards").update({ status: "blocked", blocked_reason: parsed.data.reason.trim(), updated_at: now }).eq("id", rewardId);
    if (error) return jsonResponse({ error: "block_failed", details: error.message }, 500);
    await logReward(svc, auth.userId, reward, "switch50_reward_blocked", "SWITCH50 reward blocked", { reason: parsed.data.reason.trim() });
    return jsonResponse({ ok: true });
  }

  if (!isAdmin) return jsonResponse({ error: "admin_required" }, 403);
  if (reward.status !== "issued") return jsonResponse({ error: "only_issued_rewards_can_be_reversed", status: reward.status }, 409);
  const { error } = await svc.from("promotion_rewards").update({ status: "reversed", reversal_reason: parsed.data.reason.trim(), updated_at: now }).eq("id", rewardId).eq("status", "issued");
  if (error) return jsonResponse({ error: "reverse_failed", details: error.message }, 500);
  await logReward(svc, auth.userId, reward, "switch50_reward_reversed", "SWITCH50 reward reversed", { reason: parsed.data.reason.trim() });
  return jsonResponse({ ok: true });
});

async function logReward(svc: any, actor: string, reward: any, eventType: string, title: string, details: Record<string, unknown> = {}) {
  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: eventType, _title: title,
    _customer_id: reward.customer_id, _order_id: reward.order_id,
    _source_module: "campaigns", _severity: "info",
    _details: { campaign_code: reward.campaign_code, promotion_reward_id: reward.id, actor_user_id: actor, ...details },
  }).then(() => {}).catch(() => {});
}
