import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const CRON_SECRET = Deno.env.get("CRON_JOB_SECRET");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Template types for invoice reminders
type ReminderTemplate = 'due_soon' | 'due_today' | 'overdue_7';

const escapeHtml = (unsafe: unknown): string => {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const sanitizeNumber = (value: unknown): string => {
  const num = parseFloat(String(value));
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const getStandardFooter = (accentColor: string = '#facc15') => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  const currentYear = new Date().getFullYear();
  
  return `
    <div style="background: #0d0d0d; padding: 32px;">
      <div style="text-align: center;">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: ${accentColor};">OCCTA</div>
        
        <div style="margin: 20px 0;">
          <a href="${siteUrl}/support" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Support</a>
          <a href="${siteUrl}/dashboard" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Dashboard</a>
          <a href="${siteUrl}/privacy-policy" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Privacy</a>
        </div>
        
        <div style="margin: 24px 0; padding-top: 20px; border-top: 1px solid #333;">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6;">
            Need help? Call <strong style="color: #fff;">0800 260 6626</strong> or email <a href="mailto:hello@occta.co.uk" style="color: ${accentColor}; text-decoration: none;">hello@occta.co.uk</a>
          </p>
          <p style="color: #666; font-size: 11px; margin: 0; line-height: 1.6;">
            Lines open Monday–Friday 9am–6pm, Saturday 9am–1pm
          </p>
        </div>
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #333;">
          <p style="color: #666; font-size: 10px; margin: 0 0 6px 0; line-height: 1.6;">
            © ${currentYear} OCCTA Limited. All rights reserved.
          </p>
          <p style="color: #555; font-size: 9px; margin: 0; line-height: 1.5;">
            OCCTA Limited is a company registered in England and Wales (Company No. 13828933).<br>
            Registered office: 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom
          </p>
        </div>
      </div>
    </div>`;
};

const getTemplateConfig = (template: ReminderTemplate): { subject: string; urgencyColor: string; icon: string; title: string; bodyText: string } => {
  switch (template) {
    case 'due_soon':
      return {
        subject: '📅 Payment Due in 3 Days',
        urgencyColor: '#3b82f6',
        icon: '📅',
        title: 'Payment Due Soon',
        bodyText: 'Your invoice is due in 3 days. Please ensure payment is made on time to avoid any late fees or service interruptions.',
      };
    case 'due_today':
      return {
        subject: '⏰ Payment Due Today',
        urgencyColor: '#f59e0b',
        icon: '⏰',
        title: 'Payment Due Today',
        bodyText: 'Your payment is due today. Please complete your payment now to avoid any late fees.',
      };
    case 'overdue_7':
      return {
        subject: '⚠️ Payment 7 Days Overdue',
        urgencyColor: '#ef4444',
        icon: '⚠️',
        title: 'Payment Overdue',
        bodyText: 'Your payment is now 7 days overdue. Please settle this invoice immediately to avoid additional late fees and potential service suspension.',
      };
  }
};

const getReminderHtml = (data: {
  customer_name: string;
  invoice_number: string;
  total: number;
  due_date: string;
  pay_url: string;
  template: ReminderTemplate;
}) => {
  const config = getTemplateConfig(data.template);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${config.title} - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;900&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; color: #0d0d0d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrapper { background: #f5f4ef; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 4px; color: #ffffff; position: relative; z-index: 1; }
    .tagline { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #facc15; margin-top: 4px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
        <div class="tagline">Telecom • Connected</div>
      </div>
      
      <div style="background: ${config.urgencyColor}; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff;">
          ${config.icon} ${config.title}
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(data.customer_name)},</p>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0;">
          ${config.bodyText}
        </p>
        
        <div style="background: #f5f4ef; border: 3px solid #0d0d0d; margin: 24px 0;">
          <div style="background: #0d0d0d; color: #fff; padding: 12px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;">
            Invoice Details
          </div>
          <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Invoice Number</span>
              <span style="font-weight: 700;">${escapeHtml(data.invoice_number)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Amount Due</span>
              <span style="font-weight: 700; font-size: 18px; color: ${config.urgencyColor};">£${sanitizeNumber(data.total)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Due Date</span>
              <span style="font-weight: 700;">${escapeHtml(data.due_date)}</span>
            </div>
          </div>
        </div>
        
        ${data.template === 'overdue_7' ? `
        <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
            <strong>⚠️ Important:</strong> Late payments may incur a £5.00 fee. Services may be suspended after 30 days of non-payment.
          </p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(data.pay_url)}" style="display: inline-block; background: #0d0d0d; color: #ffffff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; box-shadow: 4px 4px 0 0 ${config.urgencyColor};">
            Pay Now — £${sanitizeNumber(data.total)} →
          </a>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 13px; margin-top: 24px;">
          If you've already paid, please disregard this reminder. Payments can take 1-2 business days to process.
        </p>
      </div>
      
      ${getStandardFooter(config.urgencyColor)}
    </div>
  </div>
</body>
</html>`;
};

interface InvoiceWithProfile {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string;
  status: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify cron job secret for protection
  const cronSecret = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    console.log("SECURITY: Unauthorized cron job request - invalid or missing secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Define reminder schedule: [dayOffset, templateName]
    // T-3 = 3 days before due, T+0 = due today, T+7 = 7 days overdue
    const reminderSchedule: { dayOffset: number; template: ReminderTemplate }[] = [
      { dayOffset: 3, template: 'due_soon' },    // 3 days before due
      { dayOffset: 0, template: 'due_today' },   // Due today
      { dayOffset: -7, template: 'overdue_7' },  // 7 days overdue
    ];
    
    const emailsSent: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const { dayOffset, template } of reminderSchedule) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

      console.log(`Processing ${template} reminders for due_date=${dateStr}`);

      // Get unpaid invoices with this due date (outstanding balance)
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total,
          due_date,
          status,
          user_id
        `)
        .eq('due_date', dateStr)
        .in('status', ['sent', 'draft', 'overdue']);

      if (invError) {
        console.error(`Error fetching invoices for ${dateStr}:`, invError);
        errors.push(`Failed to fetch invoices for ${dateStr}`);
        continue;
      }

      if (!invoices || invoices.length === 0) {
        console.log(`No invoices found for ${template} on ${dateStr}`);
        continue;
      }

      for (const invoice of invoices) {
        // Fetch profile for customer name and email
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', invoice.user_id)
          .single();

        if (!profile?.email) {
          console.log(`Skipping invoice ${invoice.invoice_number} - no email found`);
          skipped.push(`${invoice.invoice_number}: no email`);
          continue;
        }

        // Check for duplicate: has this invoice+template been sent already?
        const { data: existingLog, error: logCheckError } = await supabase
          .from('communications_log')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('template_name', template)
          .limit(1)
          .maybeSingle();

        if (logCheckError) {
          console.error(`Error checking communications_log for ${invoice.invoice_number}:`, logCheckError);
        }

        if (existingLog) {
          console.log(`Skipping ${invoice.invoice_number} - ${template} already sent`);
          skipped.push(`${invoice.invoice_number}: ${template} already sent`);
          continue;
        }

        // Update status to overdue if applicable
        if (dayOffset < 0 && invoice.status !== 'overdue') {
          await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoice.id);
        }

        // IMPORTANT: token_hash stores a SHA-256 hash, so we cannot reuse an existing request
        // (we don't keep raw tokens). Always create a new payment request for email reminders.
        const rawToken = crypto.randomUUID();
        const tokenHash = await hashToken(rawToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

        // Optional: mark any previous active requests as cancelled to reduce confusion
        await supabase
          .from('payment_requests')
          .update({ status: 'cancelled' })
          .eq('invoice_id', invoice.id)
          .in('status', ['sent', 'opened'])
          .gt('expires_at', new Date().toISOString());

        const { data: newPaymentRequest, error: prError } = await supabase
          .from('payment_requests')
          .insert({
            type: 'card_payment',
            invoice_id: invoice.id,
            user_id: invoice.user_id,
            customer_name: profile.full_name || 'Customer',
            customer_email: profile.email,
            amount: invoice.total,
            currency: 'GBP',
            status: 'sent',
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
          })
          .select('id')
          .single();

        if (prError || !newPaymentRequest) {
          console.error(`Failed to create payment request for ${invoice.invoice_number}:`, prError);
          errors.push(`Failed to create payment request for ${invoice.invoice_number}`);
          continue;
        }

        const paymentRequestId = newPaymentRequest.id;
        const payUrl = `${siteUrl}/pay?token=${rawToken}`;

        const html = getReminderHtml({
          customer_name: profile.full_name || 'Customer',
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          due_date: new Date(invoice.due_date!).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          pay_url: payUrl,
          template,
        });

        const config = getTemplateConfig(template);
        const subject = `${config.subject} - Invoice ${invoice.invoice_number} (£${invoice.total.toFixed(2)})`;

        try {
          const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "billing@occta.co.uk";
          const emailResponse = await resend.emails.send({
            from: `OCCTA Billing <${fromEmail}>`,
            to: [profile.email],
            subject,
            html,
          });

          // Log to communications_log
          await supabase.from('communications_log').insert({
            invoice_id: invoice.id,
            user_id: invoice.user_id,
            payment_request_id: paymentRequestId,
            template_name: template,
            recipient_email: profile.email,
            status: 'sent',
            provider_message_id: (emailResponse as { id?: string })?.id || null,
            sent_at: new Date().toISOString(),
            metadata: { subject, pay_url: payUrl },
          });

          emailsSent.push(`${invoice.invoice_number} (${template}) -> ${profile.email}`);
          console.log(`Sent ${template} reminder for ${invoice.invoice_number} to ${profile.email}`);
        } catch (emailErr) {
          console.error(`Failed to send email for ${invoice.invoice_number}:`, emailErr);
          
          // Log failed attempt
          await supabase.from('communications_log').insert({
            invoice_id: invoice.id,
            user_id: invoice.user_id,
            payment_request_id: paymentRequestId,
            template_name: template,
            recipient_email: profile.email,
            status: 'failed',
            error_message: emailErr instanceof Error ? emailErr.message : 'Unknown error',
            metadata: { subject },
          });
          
          errors.push(`Failed to send ${template} to ${profile.email}`);
        }
      }
    }

    console.log(`Payment reminders complete: ${emailsSent.length} sent, ${skipped.length} skipped, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      emailsSent,
      skipped,
      errors,
      message: `Sent ${emailsSent.length} payment reminders`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Payment reminders error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
