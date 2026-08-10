import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BODY_HTML = `<p class="text">Thank you for coming back to us, and for taking the time to explain your situation — that genuinely helps.</p>

<p class="text">First, the reassurance: you are on our <strong>30-day rolling Flex plan</strong>. There is <strong>no minimum term, no cease charge and no early-termination fee</strong>. Whatever you decide, you will never be penalised for leaving us.</p>

<p class="text">Before you do decide, one honest thought. You have been with us since 25 June and the service has run without a fault. If the issue is the monthly cost, the speed, or simply timing, please tell us — we would far rather keep you as a customer and work something out with you than lose you over something we could have fixed in a five-minute conversation. Just reply to this email, or call us, and we will look at your account personally.</p>

<hr>

<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">What is outstanding</h3>

<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0 20px;">
  <tr style="background:#0d0d0d;color:#fff;">
    <th style="text-align:left;padding:10px 12px;">Invoice</th>
    <th style="text-align:left;padding:10px 12px;">Period</th>
    <th style="text-align:right;padding:10px 12px;">Amount</th>
  </tr>
  <tr>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">INV-2607-0005</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">25 Jul – 24 Aug 2026</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;"><strong>&pound;34.99</strong></td>
  </tr>
  <tr>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">INV-2608-0002 (final pro-rata)</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">25 Aug – 9 Sep 2026 (16 days)</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;"><strong>&pound;18.06</strong></td>
  </tr>
  <tr style="background:#facc15;">
    <td style="padding:12px;" colspan="2"><strong>TOTAL DUE</strong></td>
    <td style="padding:12px;text-align:right;"><strong>&pound;53.05</strong></td>
  </tr>
</table>

<p class="text">Both amounts include VAT at 20%. The pro-rata invoice covers only the 16 days to the end of your 30-day notice period — nothing beyond that, and no exit charges.</p>

<p class="text">If you decide to stay with us, simply let us know and we will cancel the final pro-rata invoice entirely.</p>

<hr>

<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">How to pay — bank transfer</h3>

<p class="text">To keep things simple, please pay by bank transfer to the account below. There is no card payment needed, and we will not take anything by Direct Debit for these invoices.</p>

<div style="background:#f5f4ef;border:3px solid #0d0d0d;padding:20px;margin:16px 0;font-size:15px;line-height:2;">
  <div><span style="color:#666;">Account name:</span> <strong>OCCTA LIMITED</strong></div>
  <div><span style="color:#666;">Bank:</span> <strong>Lloyds Bank</strong></div>
  <div><span style="color:#666;">Sort code:</span> <strong>30-98-97</strong></div>
  <div><span style="color:#666;">Account number:</span> <strong>61499362</strong></div>
  <div><span style="color:#666;">Payment reference:</span> <strong>OCC69244673</strong></div>
  <div><span style="color:#666;">Amount:</span> <strong>&pound;53.05</strong></div>
</div>

<p class="text">Please use <strong>OCC69244673</strong> as the reference so we can match your payment straight away. If paying the full amount at once is difficult, tell us what works for you and we will spread it over two payments — we would rather agree something realistic than see the account fall behind.</p>

<hr>

<p class="text"><strong>Your Direct Debit:</strong> thank you for completing the mandate. Nothing will be collected from it for these invoices while you settle by bank transfer, and if you do leave we will cancel the mandate for you — you do not need to do anything at your bank.</p>

<p class="text">Whatever you decide, we appreciate you having chosen OCCTA. If there is any chance of keeping you, just reply and tell us what would make the difference.</p>

<p class="text">Kind regards,<br><strong>OCCTA Support</strong><br>hello@occta.co.uk &middot; 020 3393 0829</p>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      type: "custom_admin",
      to: "sidhutt78@outlook.com",
      userId: "74809d45-1e85-4fc2-b4a1-14340c60d2f3",
      invoiceId: "0d55470d-7dc5-4ac4-894b-67edc6d398b6",
      logToCommunications: true,
      data: {
        subject: "Your OCCTA account OCC69244673 \u2014 \u00a353.05 payable by bank transfer (and one thing before you go)",
        preheader: "No exit fees on your 30-day rolling plan. Bank details inside \u2014 reference OCC69244673.",
        greeting: "Dear Chris",
        title: "Your Account & Payment Details",
        html_body: BODY_HTML,
      },
    },
  });
  return new Response(JSON.stringify({ ok: !error, data, error: error ? String(error.message ?? error) : null }), {
    status: error ? 502 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
