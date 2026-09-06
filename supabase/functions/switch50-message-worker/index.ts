import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { handleSwitch50Delivery } from "../_shared/switch50Delivery.ts";

Deno.serve((req) => handleSwitch50Delivery(req, {
  secret: Deno.env.get("SWITCH50_WORKER_SECRET"),
  enabled: Deno.env.get("SWITCH50_EMAILS_ENABLED"),
  apiKey: Deno.env.get("RESEND_API_KEY"),
  send: fetch,
  getStore: () => {
    const service = getServiceClient();
    return {
      async claim(limit) {
        const { data, error } = await service.rpc("switch50_claim_messages", { p_limit: limit });
        return { messages: data ?? [], error };
      },
      async rewardStatus(id) {
        const { data, error } = await service.from("promotion_rewards").select("status").eq("id", id).single();
        if (error || !data) throw new Error("reward_read_failed");
        return data.status;
      },
      async finish(id, lease, providerId, errorCode) {
        const { data, error } = await service.rpc("switch50_finish_message", {
          p_id: id, p_lease: lease, p_provider_id: providerId, p_error: errorCode,
        });
        return !error && data === true;
      },
    };
  },
}));
