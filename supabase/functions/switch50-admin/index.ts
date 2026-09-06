import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const reward = { reward_id: z.string().uuid(), expected_version: z.number().int().nonnegative(), request_id: z.string().uuid() };
const reason = z.string().trim().min(10).max(500);
const reference = z.string().trim().min(4).max(200);
const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["all","pending","eligible","payout_queued","issued","blocked","reversed","expired"]).default("all"), page: z.number().int().min(0).max(10000).default(0) }),
  z.object({ action: z.literal("history"), reward_id: z.string().uuid() }),
  z.object({ action: z.literal("set_active"), active: z.boolean(), reason, request_id: z.string().uuid() }),
  z.object({ action: z.literal("evaluate") }),
  z.object({ action: z.literal("queue_payout"), ...reward }),
  z.object({ action: z.literal("mark_issued"), ...reward, payout_reference: reference }),
  z.object({ action: z.literal("block"), ...reward, reason }),
  z.object({ action: z.literal("release"), ...reward, reason }),
  z.object({ action: z.literal("reverse"), ...reward, reason, payout_reference: reference }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const body = parsed.data;
  const svc = getServiceClient();
  try {
    if (body.action === "status") {
      let query = svc.from("promotion_rewards").select("*", { count: "exact" }).eq("campaign_code", "SWITCH50");
      if (body.status !== "all") query = query.eq("status", body.status);
      const results = await Promise.all([
        svc.from("offer_campaigns").select("*").eq("code", "SWITCH50").single(),
        svc.from("switch50_campaign_funnel").select("*").single(),
        query.order("created_at", { ascending: false }).order("id").range(body.page * 50, body.page * 50 + 49),
        svc.from("user_roles").select("role").eq("user_id", auth.userId),
        svc.from("promotion_message_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
        svc.from("switch50_campaign_sources").select("*").order("sessions", { ascending: false }).limit(30),
      ]);
      if (results.some((r) => r.error)) throw new Error("status_unavailable");
      return jsonResponse({ ok: true, campaign: results[0].data, funnel: results[1].data,
        rewards: results[2].data, total: results[2].count, page: body.page,
        can_admin: results[3].data?.some((r: { role: string }) => ["admin","super_admin"].includes(r.role)),
        failed_messages: results[4].count, sources: results[5].data });
    }
    if (body.action === "history") {
      const [events, messages] = await Promise.all([
        svc.from("promotion_reward_events").select("*").eq("reward_id", body.reward_id).order("id", { ascending: false }).limit(100),
        svc.from("promotion_message_outbox").select("id,template,status,attempts,sent_at,last_error").eq("reward_id", body.reward_id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (events.error || messages.error) throw new Error("history_unavailable");
      return jsonResponse({ ok: true, events: events.data, messages: messages.data });
    }
    if (body.action === "evaluate") {
      const { data, error } = await svc.rpc("evaluate_promotion_rewards");
      if (error) throw error;
      return jsonResponse({ ok: true, changed: data });
    }
    const { data, error } = await svc.rpc("switch50_admin_action", {
      p_actor: auth.userId, p_action: body.action, p_request_id: body.request_id,
      p_reward_id: "reward_id" in body ? body.reward_id : null,
      p_expected_version: "expected_version" in body ? body.expected_version : null,
      p_reason: "reason" in body ? body.reason : null,
      p_reference: "payout_reference" in body ? body.payout_reference : null,
      p_active: "active" in body ? body.active : null,
    });
    if (error) throw error;
    return jsonResponse(data, data?.ok ? 200 : data?.error === "forbidden" ? 403 : 409);
  } catch {
    return jsonResponse({ ok: false, error: "campaign_operation_failed", message: "The operation could not be confirmed. Refresh the record before retrying." }, 503);
  }
});
