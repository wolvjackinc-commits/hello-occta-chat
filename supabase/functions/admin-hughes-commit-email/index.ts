// One-off admin notification: order committed + revised Contract Summary signature request
// for account OCC06467058 (Corrina Marie Hughes). Sends via the existing send-email pipeline.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_LINK = "https://www.occta.co.uk/quote/contract-summary/9yrTYrkFg2wYcyyy3cNsZARsEycPD761-O-EwMAEd9A";

const BODY_HTML = `
<p class="text">Good news — <strong>your order is now committed</strong>. Your OCCTA service is scheduled to go live on <strong>Wednesday 19 August 2026</strong>.</p>

<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0 20px;">
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Account</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>OCC06467058</strong></td></tr>
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Plan</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>Fibre Broadband 80/20 &mdash; Flex 30</strong></td></tr>
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Go-live date</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>19 August 2026</strong></td></tr>
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Service address</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">Flat 12, Ashdown Court, 2E Fulbourne Road, London E17 4GF</td></tr>
</table>

<p class="text"><strong>Your router is already on its way.</strong> It has been pre-configured for your line and dispatched, so there is no setup work for you — plug it in on or after your go-live date and you are online.</p>

<p class="text"><strong>Engineer visit:</strong> if a visit is needed for your line, we will send you the engineer and appointment details in a separate email. You do not need to arrange anything yourself.</p>

<p class="text">In the meantime, there is genuinely nothing for you to do. Sit back, relax, and we will handle the rest.</p>

<hr>

<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">One quick action</h3>

<p class="text">We have issued a corrected <strong>Contract Summary (version 2)</strong> for your records. Please open it, read it through, and confirm you are happy so your paperwork is fully up to date. Your prices and plan are unchanged.</p>

<p style="margin:18px 0;"><a href="${CS_LINK}" style="background:#facc15;color:#0d0d0d;font-weight:700;text-decoration:none;padding:14px 22px;border:3px solid #0d0d0d;display:inline-block;">Review &amp; sign your Contract Summary</a></p>

<p class="text" style="font-size:12px;color:#555;">This link is private to you and expires in 14 days. If it has expired, just reply and we will send a fresh one.</p>

<hr>

<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Helpful guides while you wait</h3>

<ul style="font-size:14px;line-height:1.9;">
  <li><a href="https://www.occta.co.uk/learn/what-is-fttp">What is FTTP fibre broadband?</a></li>
  <li><a href="https://www.occta.co.uk/help/own-router-setup">Getting your router set up</a></li>
  <li><a href="https://www.occta.co.uk/learn/broadband-speed-guide">Understanding your broadband speeds</a></li>
  <li><a href="https://www.occta.co.uk/learn/slow-broadband-fixes">Fixing slow Wi-Fi at home</a></li>
  <li><a href="https://www.occta.co.uk/learn/direct-debit-explained">How your Direct Debit and billing work</a></li>
  <li><a href="https://www.occta.co.uk/learn/how-to-switch-broadband">Switching to OCCTA: what happens next</a></li>
</ul>

<p class="text">Any questions at all, just reply to this email or call us on <strong>0800 260 6626</strong> — we are a UK team and always happy to help.</p>

<p class="text">Kind regards,<br><strong>OCCTA Support</strong><br>hello@occta.co.uk &middot; 0800 260 6626</p>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify({
      type: "custom_admin",
      to: "phoenixs83@yahoo.com",
      logToCommunications: true,
      data: {
        subject: "Your OCCTA order is committed \u2014 going live 19 August 2026",
        preheader: "Live 19 Aug 2026. Router already dispatched. One quick signature needed.",
        greeting: "Dear Corrina",
        title: "Order Committed \u2014 Live 19 Aug 2026",
        customer_name: "Corrina Marie Hughes",
        customer_email: "phoenixs83@yahoo.com",
        account_number: "OCC06467058",
        html_body: BODY_HTML,
      },
    }),
  });
  const text = await res.text();
  const ok = res.ok;
  return new Response(JSON.stringify({ ok, status: res.status, response: text.slice(0, 500) }), {
    status: ok ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
