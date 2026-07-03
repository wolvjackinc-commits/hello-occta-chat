// Legacy cron target. All recurring monthly billing is now driven by
// `process-recurring-billing`, which reads `services.next_billing_date`
// (not `billing_settings.next_invoice_date`) so billing days 29/30/31
// are handled correctly and the service-driven invoice cursor cannot
// drift. This delegate is kept so the existing daily cron URL keeps
// working without a cron migration; it forwards the request unchanged.

import { perfServe } from "../_shared/perfLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(perfServe("generate-invoices", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("Authorization") ?? "";

  const target = `${supabaseUrl}/functions/v1/process-recurring-billing`;
  const resp = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": cronSecret,
      ...(auth ? { Authorization: auth } : {}),
    },
  });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));