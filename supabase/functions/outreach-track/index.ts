// Public open/click tracker for outreach emails.
//   GET ?t=<token>&o=1   -> 1x1 GIF, records an open
//   GET ?t=<token>&l=<n> -> 302 to the campaign's n-th stored link, records a click
// Redirects only ever go to links stored on the campaign at launch, so this
// cannot be used as an open redirect.
import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { isSuspectedBot, withRecipientTerm } from "../_shared/outreach.ts";
import { SITE_URL, type CampaignLink } from "../_shared/outreachSender.ts";

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const noStore = { "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0", Pragma: "no-cache" };

function pixel() {
  return new Response(GIF, { status: 200, headers: { "Content-Type": "image/gif", ...noStore } });
}

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to, ...noStore } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const isOpen = url.searchParams.has("o");
  const linkIndex = Number(url.searchParams.get("l"));
  const validToken = /^[A-Za-z0-9_-]{16,64}$/.test(token);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("method not allowed", { status: 405 });
  }
  if (!validToken) return isOpen ? pixel() : redirect(SITE_URL);

  const db = getServiceClient();
  const userAgent = req.headers.get("user-agent");

  try {
    const { data: message } = await db
      .from("outreach_messages")
      .select("id, campaign_id, sent_at, token")
      .eq("token", token)
      .maybeSingle();
    if (!message) return isOpen ? pixel() : redirect(SITE_URL);

    if (isOpen) {
      const bot = isSuspectedBot({ userAgent, sentAt: message.sent_at, now: new Date(), type: "open" });
      await db.rpc("outreach_record_engagement", {
        p_token: token, p_type: "open", p_url: null, p_user_agent: userAgent, p_suspected_bot: bot,
      });
      return pixel();
    }

    const { data: campaign } = await db
      .from("outreach_campaigns")
      .select("links")
      .eq("id", message.campaign_id)
      .maybeSingle();
    const links = (campaign?.links ?? []) as CampaignLink[];
    const target = Number.isInteger(linkIndex) && linkIndex >= 0 && linkIndex < links.length
      ? links[linkIndex].target
      : SITE_URL;
    const destination = withRecipientTerm(target, token);

    // HEAD requests come from link scanners; don't count them.
    if (req.method === "GET") {
      const bot = isSuspectedBot({ userAgent, sentAt: message.sent_at, now: new Date(), type: "click" });
      await db.rpc("outreach_record_engagement", {
        p_token: token, p_type: "click", p_url: target, p_user_agent: userAgent, p_suspected_bot: bot,
      });
    }
    return redirect(destination);
  } catch (e) {
    console.error("outreach-track failed", (e as Error)?.message ?? String(e));
    // Tracking must never break the recipient's experience.
    return isOpen ? pixel() : redirect(SITE_URL);
  }
});
