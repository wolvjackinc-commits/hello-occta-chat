import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, user_id, pdf_url, status")
      .eq("id", invoice_id)
      .single();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, business_profile_id, company_name")
      .eq("id", invoice.user_id)
      .maybeSingle();

    const recipients = new Set<string>();
    if ((profile as any)?.business_profile_id) {
      const { data: contacts } = await supabase
        .from("business_contacts")
        .select("email, receives_invoices")
        .eq("business_profile_id", (profile as any).business_profile_id)
        .eq("receives_invoices", true);
      for (const c of contacts ?? []) if ((c as any).email) recipients.add((c as any).email);
    }
    if (recipients.size === 0 && profile?.email) recipients.add(profile.email);

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ error: "no billing contact" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dashboardUrl = `https://occta.co.uk/business/billing?invoice=${invoice.id}`;
    const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
      Number(invoice.total ?? 0),
    );
    const due = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "on receipt";

    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="font-family:'Space Grotesk',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.02em;">
        Invoice ${invoice.invoice_number ?? invoice.id.slice(0, 8)}
      </h2>
      <p>Hi ${(profile as any)?.company_name ?? profile?.full_name ?? "there"},</p>
      <p>Your new invoice from OCCTA is ready.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;"><strong>Amount:</strong></td><td>${amount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><strong>Due:</strong></td><td>${due}</td></tr>
      </table>
      <p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 18px;text-decoration:none;margin-right:8px;">
          View in dashboard
        </a>
        ${invoice.pdf_url ? `<a href="${invoice.pdf_url}" style="display:inline-block;border:2px solid #000;padding:10px 18px;text-decoration:none;color:#000;">Download PDF</a>` : ""}
      </p>
      <p style="color:#666;font-size:12px;margin-top:24px;">Simple telecom. Clear terms. - OCCTA</p>
    </div>`;

    const sent: any[] = [];
    for (const to of recipients) {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: "invoice_sent",
          to,
          data: {
            subject: `Invoice ${invoice.invoice_number ?? ""} - ${amount}`,
            message_html: html,
            message_text: `Invoice ${amount} due ${due}. View: ${dashboardUrl}`,
            invoice_number: invoice.invoice_number,
            amount,
            due_date: due,
            pdf_url: invoice.pdf_url,
          },
          logToCommunications: true,
          invoiceId: invoice.id,
          userId: invoice.user_id,
        }),
      });
      sent.push({ to, ok: r.ok });
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});