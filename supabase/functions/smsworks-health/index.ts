// TEMPORARY diagnostic: verifies the SMS Works credential without sending an SMS.
import { corsHeaders, jsonResponse } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-diag-secret") !== Deno.env.get("CRON_JOB_SECRET")) {
    return jsonResponse({ error: "forbidden" }, 403);
  }
  const raw = (Deno.env.get("SMS_WORKS_JWT") ?? "").trim();
  const out: Record<string, unknown> = {
    present: raw.length > 0,
    length: raw.length,
    starts_with_jwt_prefix: /^jwt\s/i.test(raw),
    starts_with_ey: raw.startsWith("ey"),
  };
  const bare = raw.replace(/^jwt\s+/i, "");
  for (const [label, value] of [["bare", bare], ["prefixed", `JWT ${bare}`]] as const) {
    try {
      const res = await fetch("https://api.thesmsworks.co.uk/v1/credits/balance", {
        headers: { Authorization: value },
      });
      const text = (await res.text()).slice(0, 200);
      out[label] = { status: res.status, body: text };
    } catch (e) {
      out[label] = { error: (e as Error).message };
    }
  }
  return jsonResponse(out);
});
