import { renderSwitch50Message, messageStillRelevant, isSwitch50WorkerAuthorized } from "./switch50Messages.ts";

type Message = { id: string; reward_id: string; lease_token: string; template: string;
  payload: Parameters<typeof renderSwitch50Message>[1] & { recipient_email?: string } };
export type Switch50DeliveryStore = {
  claim: (limit: number) => Promise<{ messages: Message[]; error?: unknown }>;
  rewardStatus: (id: string) => Promise<string>;
  finish: (id: string, lease: string, providerId: string | null, error: string | null) => Promise<boolean>;
};
type Options = {
  secret?: string; enabled?: string; apiKey?: string;
  getStore: () => Switch50DeliveryStore;
  send: typeof fetch;
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

/** Dependency boundaries make the actual HTTP handler testable without sending email. */
export async function handleSwitch50Delivery(req: Request, options: Options) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isSwitch50WorkerAuthorized(req.headers.get("x-cron-secret"), options.secret))
    return json({ error: "unauthorized" }, 401);
  if (options.enabled !== "true") return json({ ok: true, disabled: true });
  if (!options.apiKey) return json({ error: "email_provider_not_configured" }, 503);

  let store: Switch50DeliveryStore;
  let messages: Message[];
  try {
    store = options.getStore();
    // Five bounded provider calls fit inside the runtime and five-minute lease.
    const claim = await store.claim(5);
    if (claim.error) return json({ error: "claim_failed" }, 503);
    messages = claim.messages;
  } catch { return json({ error: "claim_failed" }, 503); }

  let sent = 0, failed = 0, suppressed = 0;
  for (const message of messages) {
    let providerId: string | null = null, errorCode: string | null = null;
    try {
      const status = await store.rewardStatus(message.reward_id);
      if (!messageStillRelevant(message.template, status)) {
        errorCode = "superseded"; suppressed++;
      } else {
        const email = String(message.payload.recipient_email ?? "");
        if (!email.includes("@")) throw new Error("recipient_unavailable");
        const content = renderSwitch50Message(message.template, message.payload);
        const response = await options.send("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + options.apiKey,
            "Content-Type": "application/json",
            "Idempotency-Key": "switch50/" + message.id,
          },
          body: JSON.stringify({ from: "OCCTA <hello@occta.co.uk>", to: [email], reply_to: "hello@occta.co.uk", ...content }),
          signal: AbortSignal.timeout(15000),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.id) throw new Error("provider_http_" + response.status);
        providerId = String(payload.id); sent++;
      }
    } catch (error) { errorCode = error instanceof Error ? error.message : "delivery_failed"; failed++; }
    try {
      if (!await store.finish(message.id, message.lease_token, providerId, errorCode))
        return json({ error: "delivery_record_unconfirmed", sent, failed, suppressed }, 503);
    } catch { return json({ error: "delivery_record_unconfirmed", sent, failed, suppressed }, 503); }
  }
  return json({ ok: true, sent, failed, suppressed });
}
