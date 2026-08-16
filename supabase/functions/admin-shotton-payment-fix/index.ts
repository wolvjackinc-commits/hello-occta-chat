import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, confirm } = await req.json();

    const userId = "347597e6-809e-468d-a806-8a61b04d47b2"; // Brian Shotton
    const invoiceId = "ffd8e21e-31fd-4bbd-b25a-2fb40c7d5a32"; // INV-2608-0001
    const amount = 47.98;

    if (action === "preview") {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();

      return new Response(
        JSON.stringify({
          target: "Brian Shotton",
          invoice: invoice.invoice_number,
          current_status: invoice.status,
          expected_amount: amount,
          action: "Update invoice to paid and record payment attempt",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute") {
      if (!confirm) {
        throw new Error("Confirmation required");
      }

      // 1. Record the payment attempt
      const { error: payErr } = await supabase.from("payment_attempts").insert({
        user_id: userId,
        invoice_id: invoiceId,
        amount: amount,
        provider: "manual_bank_transfer",
        provider_ref: "BT-20260816-SHOTTON",
        status: "success",
        attempted_at: new Date().toISOString(),
        reason: "Manual bank transfer received as reported by customer"
      });

      if (payErr) throw payErr;

      // 2. Update invoice status
      const { error: invErr } = await supabase.from("invoices").update({
        status: "paid",
        notes: `Paid by bank transfer £${amount} on 16 Aug 2026. ` + 
               `Normal Direct Debit collections will resume for future periods.`
      }).eq("id", invoiceId);

      if (invErr) throw invErr;

      // 3. Log communication
      await supabase.from("communications_log").insert({
        user_id: userId,
        invoice_id: invoiceId,
        recipient_email: "brianshotton19@hotmail.com",
        template_name: "manual_payment_confirmation",
        subject: "Payment Received - INV-2608-0001",
        status: "sent",
        body_html: "<p>We have received your payment of £47.98 via bank transfer. Your account is now up to date.</p>",
        metadata: { manual_fix: true }
      });

      return new Response(
        JSON.stringify({ success: true, message: "Brian Shotton records updated successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
