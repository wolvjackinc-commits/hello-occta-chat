import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { handleReferralDelivery } from "../_shared/referralDelivery.ts";

Deno.serve((req) => handleReferralDelivery(req, {
  secret: Deno.env.get("REFERRAL_WORKER_SECRET"),
  enabled: Deno.env.get("REFERRAL_EMAILS_ENABLED"),
  apiKey: Deno.env.get("RESEND_API_KEY"),
  send: fetch,
  getStore: () => {
    const service = getServiceClient();
    return {
      async claim(limit) {
        const { data, error } = await service.rpc("referral_claim_messages", { p_limit: limit });
        return { messages: data ?? [], error };
      },
      async stillRelevant(id) {
        const { data, error } = await service.rpc("referral_message_still_relevant", { p_message: id });
        if (error) throw new Error("relevance_read_failed");
        return data === true;
      },
      async finish(id, lease, providerId, errorCode) {
        const { data, error } = await service.rpc("referral_finish_message", {
          p_id: id, p_lease: lease, p_provider_id: providerId, p_error: errorCode,
        });
        return !error && data === true;
      },
    };
  },
}));
