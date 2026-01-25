import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

// Cron job secret for protecting scheduled endpoints
const CRON_SECRET = Deno.env.get("CRON_JOB_SECRET");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

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

// UK Companies Act 2006 compliant footer
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
            Need help? Call <strong style="color: #fff;">0800 260 6627</strong> or email <a href="mailto:hello@occta.co.uk" style="color: ${accentColor}; text-decoration: none;">hello@occta.co.uk</a>
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

const getPaymentReminderHtml = (data: {
  customer_name: string;
  invoice_number: string;
  total: number;
  due_date: string;
  days_until_due: number;
  is_overdue: boolean;
  pay_url: string;
}) => {
  const urgencyColor = data.is_overdue ? '#ef4444' : data.days_until_due <= 3 ? '#f59e0b' : '#3b82f6';
  const urgencyText = data.is_overdue 
    ? 'OVERDUE' 
    : data.days_until_due === 0 
      ? 'DUE TODAY' 
      : data.days_until_due === 1 
        ? 'DUE TOMORROW' 
        : `DUE IN ${data.days_until_due} DAYS`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Payment Reminder - OCCTA</title>
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
      
      <div style="background: ${urgencyColor}; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff;">
          ${data.is_overdue ? '⚠️' : '⏰'} Payment ${data.is_overdue ? 'Overdue' : 'Reminder'}
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(data.customer_name)},</p>
        
        <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 16px 0;">
          ${data.is_overdue 
            ? 'Your payment is now overdue. Please settle this invoice as soon as possible to avoid any service interruptions or late fees.' 
            : 'This is a friendly reminder that you have an upcoming payment due soon.'}
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
              <span style="font-weight: 700; font-size: 18px; color: ${urgencyColor};">£${sanitizeNumber(data.total)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Due Date</span>
              <span style="font-weight: 700;">${escapeHtml(data.due_date)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
              <span style="font-size: 12px; text-transform: uppercase; color: #666;">Status</span>
              <span style="display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1px;">${urgencyText}</span>
            </div>
          </div>
        </div>
        
        ${data.is_overdue ? `
        <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
            <strong>⚠️ Important:</strong> Late payments may incur a £5.00 fee after 7 days. Services may be suspended after 30 days of non-payment.
          </p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(data.pay_url)}" style="display: inline-block; background: #0d0d0d; color: #ffffff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; box-shadow: 4px 4px 0 0 ${urgencyColor};">
            Pay Now →
          </a>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 13px; margin-top: 24px;">
          If you've already paid, please disregard this reminder. Payments can take 1-2 business days to process.
        </p>
      </div>
      
      ${getStandardFooter(urgencyColor)}
    </div>
  </div>
</body>
</html>`;
};

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
    
    // Find invoices that are:
    // 1. Due in 7 days
    // 2. Due in 3 days
    // 3. Due today
    // 4. 1 day overdue
    // 5. 7 days overdue
    const reminderDays = [7, 3, 0, -1, -7];
    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const dayOffset of reminderDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Get unpaid invoices with this due date
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
        continue;
      }

      for (const invoice of invoices) {
        // Fetch profile separately
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', invoice.user_id)
          .single();

        if (!profile?.email) {
          console.log(`Skipping invoice ${invoice.invoice_number} - no email`);
          continue;
        }

        const isOverdue = dayOffset < 0;
        const daysUntilDue = Math.abs(dayOffset);
        
        // Update status to overdue if applicable
        if (isOverdue && invoice.status !== 'overdue') {
          await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoice.id);
        }

        const html = getPaymentReminderHtml({
          customer_name: profile.full_name || 'Customer',
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          due_date: new Date(invoice.due_date!).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          days_until_due: daysUntilDue,
          is_overdue: isOverdue,
          pay_url: `${siteUrl}/pay-invoice?id=${invoice.id}`,
        });

        const subject = isOverdue
          ? `⚠️ Overdue: Invoice ${invoice.invoice_number} - £${invoice.total.toFixed(2)}`
          : dayOffset === 0
            ? `⏰ Due Today: Invoice ${invoice.invoice_number}`
            : `📅 Reminder: Invoice ${invoice.invoice_number} due in ${daysUntilDue} days`;

        try {
          const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "billing@occta.co.uk";
          await resend.emails.send({
            from: `OCCTA Billing <${fromEmail}>`,
            to: [profile.email],
            subject,
            html,
          });
          emailsSent.push(`${invoice.invoice_number} -> ${profile.email}`);
          console.log(`Sent reminder for ${invoice.invoice_number} to ${profile.email}`);
        } catch (emailErr) {
          console.error(`Failed to send email for ${invoice.invoice_number}:`, emailErr);
          errors.push(`Failed to send to ${profile.email}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      emailsSent,
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
