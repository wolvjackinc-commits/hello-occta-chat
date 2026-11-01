import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { isCronSecret } from "../_shared/cronSecret.ts";
import { handleReferralDelivery } from "../_shared/referralDelivery.ts";

// Called every 5 minutes by referral_dispatch_messages() through
// invoke_edge_function_from_cron(), which sends a single-use token minted by
// the database. Sends nothing while the scheme is switched off.
Deno.serve((req) => handleReferralDelivery(req, {
  authorize: (header) => isCronSecret(header),
  enabled: async () => {
    const { data, error } = await getServiceClient().rpc("referral_enabled");
    return !error && data === true;
  },
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
