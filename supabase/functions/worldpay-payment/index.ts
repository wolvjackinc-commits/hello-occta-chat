// Retired. OCCTA takes payment by Direct Debit or bank transfer only
// (supabase/functions/_shared/paymentOptions.ts); card payments ended in
// October 2026 and this endpoint was last used on 16 August 2026.
// It now refuses every request so no card session can ever be created.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      success: false,
      error: "card_payments_retired",
      message: "OCCTA does not take card payments. Please pay by Direct Debit or bank transfer.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
