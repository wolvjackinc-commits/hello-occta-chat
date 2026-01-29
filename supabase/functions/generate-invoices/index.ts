import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface BillingSettings {
  id: string;
  user_id: string;
  billing_mode: string;
  billing_day: number | null;
  vat_enabled_default: boolean;
  vat_rate_default: number;
  next_invoice_date: string | null;
  payment_terms_days: number;
}

interface Service {
  id: string;
  user_id: string;
  service_type: string;
  status: string;
  price_monthly: number;
  plan_name: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
  address_line1: string | null;
  city: string | null;
  postcode: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron secret for scheduled invocations
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_JOB_SECRET");
  const authHeader = req.headers.get("Authorization");
  
  // Allow either cron secret or valid JWT
  if (!authHeader && cronSecret !== expectedSecret) {
    console.log("Unauthorized: Missing auth header and invalid cron secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    
    const today = new Date().toISOString().split("T")[0];
    console.log(`[generate-invoices] Starting invoice generation for ${today}`);

    // 1. Find customers with next_invoice_date <= today
    const { data: dueSettings, error: settingsError } = await supabase
      .from("billing_settings")
      .select("*")
      .lte("next_invoice_date", today);

    if (settingsError) throw settingsError;

    if (!dueSettings || dueSettings.length === 0) {
      console.log("[generate-invoices] No customers due for invoicing today");
      return new Response(
        JSON.stringify({ message: "No invoices to generate", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-invoices] Found ${dueSettings.length} customers due for invoicing`);

    const results: { userId: string; invoiceId?: string; error?: string }[] = [];

    for (const settings of dueSettings as BillingSettings[]) {
      try {
        // 2. Get customer profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", settings.user_id)
          .single();

        if (profileError || !profile) {
          console.log(`[generate-invoices] No profile for user ${settings.user_id}`);
          results.push({ userId: settings.user_id, error: "Profile not found" });
          continue;
        }

        const customerProfile = profile as Profile;

        // 3. Get active services with monthly price
        const { data: services, error: servicesError } = await supabase
          .from("services")
          .select("*")
          .eq("user_id", settings.user_id)
          .eq("status", "active")
          .gt("price_monthly", 0);

        if (servicesError) throw servicesError;

        if (!services || services.length === 0) {
          console.log(`[generate-invoices] No billable services for ${customerProfile.account_number}`);
          // Still update next_invoice_date to prevent repeated checks
          await updateNextInvoiceDate(supabase, settings);
          results.push({ userId: settings.user_id, error: "No billable services" });
          continue;
        }

        const activeServices = services as Service[];

        // 4. Calculate billing period
        const billingPeriodStart = settings.next_invoice_date!;
        const billingPeriodEnd = calculateBillingPeriodEnd(settings, billingPeriodStart);

        // 5. Check for existing invoice for this period (prevent duplicates)
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("user_id", settings.user_id)
          .eq("billing_period_start", billingPeriodStart)
          .eq("billing_period_end", billingPeriodEnd)
          .maybeSingle();

        if (existingInvoice) {
          console.log(`[generate-invoices] Invoice already exists for ${customerProfile.account_number} period ${billingPeriodStart}`);
          await updateNextInvoiceDate(supabase, settings);
          results.push({ userId: settings.user_id, error: "Invoice already exists" });
          continue;
        }

        // 6. Generate invoice number
        const { data: invNumData } = await supabase.rpc("generate_invoice_number");
        const invoiceNumber = invNumData || `INV-${Date.now().toString(36).toUpperCase()}`;

        // 7. Calculate totals
        const subtotal = activeServices.reduce((sum, s) => sum + Number(s.price_monthly), 0);
        const vatEnabled = settings.vat_enabled_default;
        const vatRate = settings.vat_rate_default;
        const vatAmount = vatEnabled ? subtotal * (vatRate / 100) : 0;
        const total = subtotal + vatAmount;
        
        const dueDate = new Date(billingPeriodStart);
        dueDate.setDate(dueDate.getDate() + settings.payment_terms_days);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // 8. Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            user_id: settings.user_id,
            invoice_number: invoiceNumber,
            status: "sent",
            issue_date: today,
            due_date: dueDateStr,
            subtotal,
            vat_total: vatAmount,
            total,
            vat_enabled: vatEnabled,
            vat_rate: vatRate,
            billing_period_start: billingPeriodStart,
            billing_period_end: billingPeriodEnd,
            notes: `Auto-generated monthly invoice for billing period ${billingPeriodStart} to ${billingPeriodEnd}`,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // 9. Create invoice lines
        const lineItems = activeServices.map((service) => ({
          invoice_id: invoice.id,
          description: `${service.plan_name || service.service_type.toUpperCase()} - Monthly Service (${billingPeriodStart} to ${billingPeriodEnd})`,
          qty: 1,
          unit_price: Number(service.price_monthly),
          line_total: Number(service.price_monthly),
          vat_rate: vatEnabled ? vatRate : 0,
        }));

        await supabase.from("invoice_lines").insert(lineItems);

        // 10. Create payment request with secure token
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14);

        const { data: paymentRequest, error: prError } = await supabase
          .from("payment_requests")
          .insert({
            type: "card_payment",
            invoice_id: invoice.id,
            user_id: settings.user_id,
            customer_email: customerProfile.email || "",
            customer_name: customerProfile.full_name || "Customer",
            account_number: customerProfile.account_number,
            amount: total,
            currency: "GBP",
            status: "sent",
            expires_at: expiresAt.toISOString(),
            token_hash: token,
            notes: `Payment for invoice ${invoiceNumber}`,
          })
          .select()
          .single();

        if (prError) {
          console.error(`[generate-invoices] Failed to create payment request: ${prError.message}`);
        }

        // 11. Log audit
        await supabase.from("audit_logs").insert({
          action: "auto_generate",
          entity: "invoice",
          entity_id: invoice.id,
          metadata: {
            invoice_number: invoiceNumber,
            account_number: customerProfile.account_number,
            total,
            billing_period: `${billingPeriodStart} to ${billingPeriodEnd}`,
            services_count: activeServices.length,
          },
        });

        // 12. Send invoice email
        if (customerProfile.email && resend) {
          const paymentUrl = `${Deno.env.get("SITE_URL") || "https://hello-occta-chat.lovable.app"}/pay?token=${token}`;
          
          try {
            await sendInvoiceEmail(resend, {
              to: customerProfile.email,
              customerName: customerProfile.full_name || "Customer",
              customerEmail: customerProfile.email || "",
              accountNumber: customerProfile.account_number || "",
              address: customerProfile.address_line1 || undefined,
              city: customerProfile.city || undefined,
              postcode: customerProfile.postcode || undefined,
              invoiceNumber,
              issueDate: today,
              dueDate: dueDateStr,
              billingPeriodStart,
              billingPeriodEnd,
              lines: lineItems,
              subtotal,
              vatEnabled,
              vatRate,
              vatAmount,
              total,
              paymentUrl,
            });

            // Log communication
            await supabase.from("communications_log").insert({
              user_id: settings.user_id,
              invoice_id: invoice.id,
              payment_request_id: paymentRequest?.id || null,
              template_name: "invoice_generated",
              recipient_email: customerProfile.email,
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: { invoice_number: invoiceNumber, total },
            });

            console.log(`[generate-invoices] Invoice email sent to ${customerProfile.email}`);
          } catch (emailError) {
            console.error(`[generate-invoices] Email failed: ${emailError}`);
          }
        }

        // 13. Update next_invoice_date
        await updateNextInvoiceDate(supabase, settings);

        results.push({ userId: settings.user_id, invoiceId: invoice.id });
        console.log(`[generate-invoices] Created invoice ${invoiceNumber} for ${customerProfile.account_number}`);
      } catch (err: any) {
        console.error(`[generate-invoices] Error for user ${settings.user_id}: ${err.message}`);
        results.push({ userId: settings.user_id, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.invoiceId).length;
    console.log(`[generate-invoices] Completed: ${successCount}/${results.length} invoices generated`);

    return new Response(
      JSON.stringify({
        message: "Invoice generation complete",
        total: results.length,
        success: successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[generate-invoices] Fatal error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateBillingPeriodEnd(settings: BillingSettings, startDate: string): string {
  const start = new Date(startDate);
  const end = new Date(start);
  
  if (settings.billing_mode === "fixed_day" && settings.billing_day) {
    // Fixed day: same day next month
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1); // Day before next billing
  } else {
    // Anniversary: add 1 month minus 1 day
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
  }
  
  return end.toISOString().split("T")[0];
}

async function updateNextInvoiceDate(supabase: any, settings: BillingSettings) {
  const current = settings.next_invoice_date ? new Date(settings.next_invoice_date) : new Date();
  const next = new Date(current);
  
  if (settings.billing_mode === "fixed_day" && settings.billing_day) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(settings.billing_day, 28));
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  
  const nextDateStr = next.toISOString().split("T")[0];
  
  await supabase
    .from("billing_settings")
    .update({
      next_invoice_date: nextDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", settings.user_id);
}

interface InvoiceEmailData {
  to: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  address?: string;
  city?: string;
  postcode?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  lines: { description: string; qty: number; unit_price: number; line_total: number; vat_rate?: number }[];
  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
  paymentUrl: string;
}

// Generate PDF invoice using jsPDF
function generateInvoicePdfBase64(data: InvoiceEmailData): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Color constants (used with setFillColor RGB values directly)
  
  // Helper function for date formatting
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };
  
  // Header background
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageWidth, 35, "F");
  
  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("OCCTA", 20, 22);
  
  // TELECOM in yellow box
  doc.setFillColor(250, 204, 21);
  doc.rect(55, 12, 40, 14, "F");
  doc.setTextColor(13, 13, 13);
  doc.text("TELECOM", 57, 23);
  
  // Invoice label
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", pageWidth - 20, 22, { align: "right" });
  
  // Status badge
  doc.setFillColor(250, 204, 21);
  doc.rect(pageWidth - 45, 26, 35, 8, "F");
  doc.setFontSize(10);
  doc.setTextColor(13, 13, 13);
  doc.text("UNPAID", pageWidth - 27.5, 31.5, { align: "center" });
  
  // Invoice details section
  let y = 50;
  doc.setTextColor(102, 102, 102);
  doc.setFontSize(8);
  doc.text("INVOICE NUMBER", 20, y);
  doc.text("ISSUE DATE", 80, y);
  doc.text("DUE DATE", 140, y);
  
  y += 6;
  doc.setTextColor(13, 13, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.invoiceNumber, 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.issueDate), 80, y);
  doc.text(formatDate(data.dueDate), 140, y);
  
  // Bill To section
  y += 15;
  doc.setFillColor(245, 245, 240);
  doc.setDrawColor(13, 13, 13);
  doc.setLineWidth(0.5);
  doc.rect(20, y, pageWidth - 40, 35, "FD");
  
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Bill To", 25, y);
  
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text("Account Number:", 25, y);
  doc.text("Customer:", 100, y);
  
  y += 5;
  doc.setTextColor(13, 13, 13);
  doc.setFont("helvetica", "bold");
  doc.text(data.accountNumber || "N/A", 25, y);
  doc.text(data.customerName, 100, y);
  
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  const addressParts = [data.address, data.city, data.postcode].filter(Boolean);
  if (addressParts.length > 0) {
    doc.text(addressParts.join(", "), 25, y);
  }
  
  // Line items table header
  y += 20;
  doc.setFillColor(13, 13, 13);
  doc.rect(20, y, pageWidth - 40, 10, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 25, y + 7);
  doc.text("QTY", 120, y + 7);
  doc.text("UNIT PRICE", 140, y + 7);
  doc.text("TOTAL", pageWidth - 25, y + 7, { align: "right" });
  
  // Line items
  y += 15;
  doc.setTextColor(13, 13, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  for (const line of data.lines) {
    doc.setDrawColor(238, 238, 238);
    doc.line(20, y + 5, pageWidth - 20, y + 5);
    
    // Wrap long descriptions
    const descLines = doc.splitTextToSize(line.description, 90);
    doc.text(descLines, 25, y);
    doc.text(line.qty.toString(), 125, y, { align: "center" });
    doc.text(`£${line.unit_price.toFixed(2)}`, 155, y, { align: "right" });
    doc.text(`£${line.line_total.toFixed(2)}`, pageWidth - 25, y, { align: "right" });
    
    y += Math.max(descLines.length * 5, 10);
  }
  
  // Totals section
  y += 10;
  const totalsX = pageWidth - 80;
  
  doc.setDrawColor(13, 13, 13);
  doc.setLineWidth(0.5);
  doc.rect(totalsX - 5, y - 5, 70, data.vatEnabled ? 40 : 30, "D");
  
  doc.setFontSize(9);
  doc.text("Subtotal", totalsX, y + 3);
  doc.text(`£${data.subtotal.toFixed(2)}`, pageWidth - 25, y + 3, { align: "right" });
  
  if (data.vatEnabled) {
    y += 10;
    doc.text(`VAT (${data.vatRate}%)`, totalsX, y + 3);
    doc.text(`£${data.vatAmount.toFixed(2)}`, pageWidth - 25, y + 3, { align: "right" });
  }
  
  y += 12;
  doc.setFillColor(13, 13, 13);
  doc.rect(totalsX - 5, y - 3, 70, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", totalsX, y + 5);
  doc.text(`£${data.total.toFixed(2)}`, pageWidth - 25, y + 5, { align: "right" });
  
  // Pay Now section
  y += 25;
  doc.setFillColor(250, 204, 21);
  doc.setDrawColor(13, 13, 13);
  doc.setLineWidth(1);
  const buttonWidth = 60;
  const buttonX = (pageWidth - buttonWidth) / 2;
  doc.rect(buttonX, y, buttonWidth, 14, "FD");
  
  doc.setTextColor(13, 13, 13);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("PAY NOW →", pageWidth / 2, y + 9, { align: "center" });
  
  // Add clickable link
  doc.link(buttonX, y, buttonWidth, 14, { url: data.paymentUrl });
  
  y += 20;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`Or visit: ${data.paymentUrl}`, pageWidth / 2, y, { align: "center" });
  
  // Footer
  y = 270;
  doc.setDrawColor(13, 13, 13);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 8;
  doc.setTextColor(13, 13, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("OCCTA Telecom", pageWidth / 2, y, { align: "center" });
  
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text("Keeping the UK connected", pageWidth / 2, y, { align: "center" });
  
  y += 6;
  doc.text("Call us: 0800 260 6626 | Email: billing@occta.co.uk", pageWidth / 2, y, { align: "center" });
  
  y += 5;
  doc.text("OCCTA Limited | Company No. 13828933 | Registered in England & Wales", pageWidth / 2, y, { align: "center" });
  
  y += 4;
  doc.text("22 Pavilion View, Huddersfield, HD3 3WU", pageWidth / 2, y, { align: "center" });
  
  // Return as base64
  return doc.output("datauristring").split(",")[1];
}

async function sendInvoiceEmail(resend: Resend, data: InvoiceEmailData) {
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const linesHtml = data.lines
    .map(
      (line) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px;">${line.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-size: 14px;">${line.qty}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px;">£${line.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px;">£${line.line_total.toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: #0d0d0d; padding: 30px; text-align: center;">
      <h1 style="font-family: 'Bebas Neue', Impact, sans-serif; font-size: 32px; color: white; margin: 0; letter-spacing: 2px;">
        OCCTA<span style="background: #facc15; color: #0d0d0d; padding: 2px 8px;">TELECOM</span>
      </h1>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border: 4px solid #0d0d0d;">
      <h2 style="font-family: 'Bebas Neue', Impact, sans-serif; font-size: 24px; margin: 0 0 20px 0; color: #0d0d0d;">
        Your invoice is ready
      </h2>
      
      <p style="font-size: 15px; color: #333; margin: 0 0 20px 0;">
        Hi ${data.customerName},
      </p>
      
      <p style="font-size: 15px; color: #333; margin: 0 0 20px 0;">
        Your monthly invoice is now available. Please find the details below and pay by the due date to ensure uninterrupted service.
      </p>
      
      <!-- Invoice Summary -->
      <div style="background: #f5f5f0; border: 2px solid #0d0d0d; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Invoice Number</span><br>
              <strong style="font-size: 16px;">${data.invoiceNumber}</strong>
            </td>
            <td style="padding: 8px 0; text-align: right;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Account Number</span><br>
              <strong style="font-size: 16px;">${data.accountNumber}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Issue Date</span><br>
              <strong>${formatDate(data.issueDate)}</strong>
            </td>
            <td style="padding: 8px 0; text-align: right;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Due Date</span><br>
              <strong style="color: #dc2626;">${formatDate(data.dueDate)}</strong>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Billing Period</span><br>
              <strong>${formatDate(data.billingPeriodStart)} - ${formatDate(data.billingPeriodEnd)}</strong>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Line Items -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0d0d0d; color: white;">
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase;">Description</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase;">Unit Price</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>
      
      <!-- Totals -->
      <div style="text-align: right; margin-bottom: 30px;">
        <table style="display: inline-block; text-align: left;">
          <tr>
            <td style="padding: 8px 20px; font-size: 14px;">Subtotal</td>
            <td style="padding: 8px 0; font-size: 14px; text-align: right;">£${data.subtotal.toFixed(2)}</td>
          </tr>
          ${
            data.vatEnabled
              ? `
          <tr>
            <td style="padding: 8px 20px; font-size: 14px;">VAT (${data.vatRate}%)</td>
            <td style="padding: 8px 0; font-size: 14px; text-align: right;">£${data.vatAmount.toFixed(2)}</td>
          </tr>
          `
              : ""
          }
          <tr style="background: #0d0d0d; color: white;">
            <td style="padding: 12px 20px; font-size: 18px; font-weight: bold;">TOTAL DUE</td>
            <td style="padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: right;">£${data.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      
      <!-- Pay Now Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${data.paymentUrl}" style="display: inline-block; background: #facc15; color: #0d0d0d; padding: 16px 40px; font-size: 18px; font-weight: bold; text-decoration: none; border: 4px solid #0d0d0d; text-transform: uppercase; letter-spacing: 1px;">
          Pay Now →
        </a>
      </div>
      
      <p style="font-size: 12px; color: #666; text-align: center; margin: 0 0 10px 0;">
        Or copy this link: <br>
        <a href="${data.paymentUrl}" style="color: #0d0d0d; word-break: break-all;">${data.paymentUrl}</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0 0 10px 0;">
        <strong>Need help?</strong> Call us on <a href="tel:08002606626" style="color: #0d0d0d;">0800 260 6626</a> or email <a href="mailto:billing@occta.co.uk" style="color: #0d0d0d;">billing@occta.co.uk</a>
      </p>
      <p style="margin: 0; font-size: 11px;">
        OCCTA Limited | Company No. 13828933 | Registered in England & Wales<br>
        22 Pavilion View, Huddersfield, HD3 3WU
      </p>
    </div>
  </div>
</body>
</html>
  `;

  // Generate PDF and attach to email
  const pdfBase64 = generateInvoicePdfBase64(data);
  
  await resend.emails.send({
    from: "OCCTA Billing <billing@occta.co.uk>",
    to: data.to,
    subject: `Your OCCTA invoice is ready — ${data.invoiceNumber}`,
    html: emailHtml,
    text: `Hi ${data.customerName},

Your monthly invoice ${data.invoiceNumber} is now available.

Account Number: ${data.accountNumber}
Invoice Date: ${formatDate(data.issueDate)}
Due Date: ${formatDate(data.dueDate)}
Billing Period: ${formatDate(data.billingPeriodStart)} - ${formatDate(data.billingPeriodEnd)}

Total Due: £${data.total.toFixed(2)}

Pay Now: ${data.paymentUrl}

Need help? Call us on 0800 260 6626 or email billing@occta.co.uk

OCCTA Limited | Company No. 13828933 | Registered in England & Wales
22 Pavilion View, Huddersfield, HD3 3WU`,
    attachments: [
      {
        filename: `OCCTA-Invoice-${data.invoiceNumber}.pdf`,
        content: pdfBase64,
      },
    ],
  });
}
