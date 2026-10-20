import { getCronSecret, isCronSecret } from "../_shared/cronSecret.ts";
// Scheduled sender for outreach campaigns (pg_cron every 5 minutes).
// Only the project cron secret may trigger it; the function is deployed
// without gateway JWT verification, so no bearer token is trusted here.
import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { runOutreachTick } from "../_shared/outreachSender.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  const provided = req.headers.get("x-cron-secret");
  if (!(await isCronSecret(provided))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  try {
    const result = await runOutreachTick(getServiceClient());
    console.log(JSON.stringify({ fn: "outreach-worker", ...result }));
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    console.error("outreach-worker failed", message);
    return new Response(JSON.stringify({ ok: false, error: message.slice(0, 300) }), { status: 500, headers });
  }
});
