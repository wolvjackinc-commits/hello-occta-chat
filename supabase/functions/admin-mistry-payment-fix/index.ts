import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, confirm } = await req.json();

    const userId = "8962f90e-b142-4582-b1dc-14d372894691"; // Dullabhbhai Mistry
    const invoiceId = "b627a98b-98f2-484c-b5f9-e6e852077aa6"; // INV-2607-0004
    const amount = 40.00;

    if (action === "preview") {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();

      return new Response(
        JSON.stringify({
          target: "Dullabhbhai Mistry",
          invoice: invoice.invoice_number,
          current_status: invoice.status,
          expected_amount: amount,
          action: "Update invoice to paid and record payment attempt (Direct Debit)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute") {
      if (!confirm) throw new Error("Confirmation required");

      // 1. Record the payment attempt
      const { error: payErr } = await supabase.from("payment_attempts").insert({
        user_id: userId,
        invoice_id: invoiceId,
        amount: amount,
        provider: "direct_debit",
        provider_ref: "DD-MANUAL-RECONCILE-INV-2607-0004",
        status: "success",
        attempted_at: "2026-08-15T09:00:00Z", // As reported by customer
        reason: "Direct Debit collection reported successful by customer on 15 Aug"
      });
      if (payErr) throw payErr;

      // 2. Update invoice status
      const { error: invErr } = await supabase.from("invoices").update({
        status: "paid",
        notes: `Direct Debit collection of £${amount} successful on 15 Aug 2026. ` + 
               `Mandate verified by customer.`
      }).eq("id", invoiceId);
      if (invErr) throw invErr;

      // 3. Log communication
      await supabase.from("communications_log").insert({
        user_id: userId,
        invoice_id: invoiceId,
        recipient_email: "previnamistry67@gmail.com",
        template_name: "manual_payment_confirmation",
        subject: "Payment Received - INV-2607-0004",
        status: "sent",
        body_html: "<p>We have confirmed receipt of your payment for £40.00 via Direct Debit. Your account is now up to date.</p>",
        metadata: { manual_fix: true, method: 'direct_debit' }
      });

      return new Response(
        JSON.stringify({ success: true, message: "Dullabhbhai Mistry records updated successfully" }),
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
