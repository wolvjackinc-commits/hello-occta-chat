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

// Configuration
const LATE_FEE_AMOUNT = 5.00; // £5.00 late fee
const GRACE_PERIOD_DAYS = 7; // Days after due date before late fee
const OVERDUE_DAYS_FOR_STATUS_UPDATE = 1; // Mark as overdue after 1 day
const SUSPENSION_WARNING_DAYS = 21; // Send warning at 21 days overdue
const SUSPENSION_DAYS = 30; // Suspend at 30 days overdue

const escapeHtml = (unsafe: unknown): string => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

const getLateFeeEmailHtml = (data: {
  customer_name: string;
  invoice_number: string;
  original_amount: number;
  late_fee: number;
  new_total: number;
  days_overdue: number;
}) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Late Fee Applied - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; position: relative; z-index: 1; }
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
      
      <div style="background: #ef4444; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; letter-spacing: 2px;">
          ⚠️ Late Fee Applied
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(data.customer_name)},</p>
        
        <p style="margin: 16px 0; color: #333; font-size: 15px; line-height: 1.7;">
          Your invoice <strong>${escapeHtml(data.invoice_number)}</strong> is now ${data.days_overdue} days overdue. In accordance with our payment terms, a late payment fee has been applied to your account.
        </p>
        
        <div style="background: #fef2f2; border: 3px solid #ef4444; padding: 24px; margin: 24px 0;">
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #fca5a5;">
            <span style="color: #666; font-size: 13px;">Original Amount</span>
            <span style="font-weight: 600;">£${data.original_amount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #fca5a5;">
            <span style="color: #ef4444; font-weight: 600; font-size: 13px;">Late Fee</span>
            <span style="color: #ef4444; font-weight: 600;">+£${data.late_fee.toFixed(2)}</span>
          </div>
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 22px; margin-top: 16px; background: #ef4444; color: #fff; padding: 14px; text-align: center; letter-spacing: 2px;">
            NEW TOTAL: £${data.new_total.toFixed(2)}
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          To avoid further fees and potential service interruption, please pay your invoice as soon as possible. If your account remains unpaid after 30 days, your services may be suspended.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background: #0d0d0d; color: #fff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; box-shadow: 4px 4px 0 0 #ef4444;">
            Pay Now →
          </a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">
          Need to discuss payment options? We're here to help.
        </p>
      </div>
      
      ${getStandardFooter('#ef4444')}
    </div>
  </div>
</body>
</html>`;
};

const getSuspensionWarningEmailHtml = (data: {
  customer_name: string;
  invoice_number: string;
  amount: number;
  days_until_suspension: number;
}) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Final Warning - Service Suspension - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; position: relative; z-index: 1; }
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
      
      <div style="background: #dc2626; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; letter-spacing: 2px;">
          🚨 FINAL WARNING - Service Suspension
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(data.customer_name)},</p>
        
        <p style="margin: 16px 0; color: #333; font-size: 15px; line-height: 1.7;">
          Your invoice <strong>${escapeHtml(data.invoice_number)}</strong> remains unpaid and your services are at risk of suspension. This is your final warning before action is taken.
        </p>
        
        <div style="background: #fef2f2; border: 4px solid #dc2626; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #991b1b;">
            Service Suspension In
          </p>
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 64px; color: #dc2626; letter-spacing: 4px;">
            ${data.days_until_suspension}
          </div>
          <p style="margin: 0; font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #dc2626; letter-spacing: 2px;">
            DAYS
          </p>
          <p style="margin: 16px 0 0 0; font-size: 15px; color: #666;">
            Amount Due: <strong style="font-size: 18px; color: #dc2626;">£${data.amount.toFixed(2)}</strong>
          </p>
        </div>
        
        <div style="background: #fef2f2; border: 2px solid #fca5a5; padding: 16px; margin: 24px 0;">
          <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
            <strong>What happens if services are suspended:</strong>
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 13px; line-height: 1.8;">
            <li>Your broadband/phone service will be disconnected</li>
            <li>A reconnection fee of £25 may apply</li>
            <li>Your account may be referred to a debt collection agency</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background: #dc2626; color: #fff; padding: 18px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px;">
            PAY NOW TO AVOID SUSPENSION →
          </a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">
          Need to discuss payment options? Contact us urgently on <strong>0800 260 6626</strong>.
        </p>
      </div>
      
      ${getStandardFooter('#dc2626')}
    </div>
  </div>
</body>
</html>`;
};

const getServiceSuspendedEmailHtml = (data: {
  customer_name: string;
  service_type: string;
  amount_owed: number;
}) => {
  const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Service Suspended - OCCTA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 120px; height: 120px; background: #facc15; transform: translate(30%, -30%) rotate(45deg); }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; position: relative; z-index: 1; }
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
      
      <div style="background: #7f1d1d; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; letter-spacing: 2px;">
          ⛔ Service Suspended
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(data.customer_name)},</p>
        
        <p style="margin: 16px 0; color: #333; font-size: 15px; line-height: 1.7;">
          Due to non-payment of your account, your <strong>${escapeHtml(data.service_type)}</strong> service has been suspended with immediate effect.
        </p>
        
        <div style="background: #1f2937; color: #fff; padding: 28px; margin: 24px 0; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">⛔</div>
          <p style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; margin: 0; letter-spacing: 3px;">SERVICE SUSPENDED</p>
          <p style="margin: 16px 0 0 0; font-size: 15px; opacity: 0.8;">
            Outstanding Balance: <strong style="font-size: 20px; color: #fbbf24;">£${data.amount_owed.toFixed(2)}</strong>
          </p>
        </div>
        
        <div style="background: #f0fdf4; border: 3px solid #22c55e; padding: 20px; margin: 24px 0;">
          <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
            <strong>To restore your service:</strong>
          </p>
          <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px; line-height: 1.8;">
            <li>Pay your outstanding balance in full</li>
            <li>A reconnection fee of £25 will be added</li>
            <li>Service will be restored within 24 hours of payment confirmation</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background: #16a34a; color: #fff; padding: 18px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px;">
            PAY NOW TO RESTORE SERVICE →
          </a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">
          Contact us to discuss payment options on <strong>0800 260 6626</strong>.
        </p>
      </div>
      
      ${getStandardFooter('#16a34a')}
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

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const results = {
      statusUpdates: 0,
      lateFeesApplied: 0,
      suspensionWarnings: 0,
      servicesSuspended: 0,
      errors: [] as string[],
    };

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "billing@occta.co.uk";

    console.log('Starting late fee processing...');

    // 1. Update overdue status for invoices past due date
    const overdueThreshold = new Date(today);
    overdueThreshold.setDate(overdueThreshold.getDate() - OVERDUE_DAYS_FOR_STATUS_UPDATE);
    
    const { data: overdueInvoices, error: overdueError } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('status', ['sent', 'draft'])
      .lt('due_date', overdueThreshold.toISOString().split('T')[0])
      .select('id');

    if (overdueError) {
      console.error('Error updating overdue status:', overdueError);
      results.errors.push('Failed to update overdue statuses');
    } else {
      results.statusUpdates = overdueInvoices?.length || 0;
      console.log(`Updated ${results.statusUpdates} invoices to overdue status`);
    }

    // 2. Apply late fees after grace period
    const lateFeeThreshold = new Date(today);
    lateFeeThreshold.setDate(lateFeeThreshold.getDate() - GRACE_PERIOD_DAYS);
    
    const { data: invoicesForLateFee, error: lateFeeError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total,
        due_date,
        user_id,
        late_fee_amount,
        late_fee_applied_at
      `)
      .eq('status', 'overdue')
      .lt('due_date', lateFeeThreshold.toISOString().split('T')[0])
      .is('late_fee_applied_at', null);

    if (lateFeeError) {
      console.error('Error fetching invoices for late fee:', lateFeeError);
      results.errors.push('Failed to fetch invoices for late fee');
    } else if (invoicesForLateFee && invoicesForLateFee.length > 0) {
      for (const invoice of invoicesForLateFee) {
        try {
          const newTotal = invoice.total + LATE_FEE_AMOUNT;
          const daysOverdue = Math.floor((today.getTime() - new Date(invoice.due_date!).getTime()) / (1000 * 60 * 60 * 24));

          // Update invoice with late fee
          await supabase
            .from('invoices')
            .update({
              late_fee_amount: LATE_FEE_AMOUNT,
              late_fee_applied_at: new Date().toISOString(),
              total: newTotal,
            })
            .eq('id', invoice.id);

          // Get customer email
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', invoice.user_id)
            .single();

          if (profile?.email) {
            // Send late fee notification
            await resend.emails.send({
              from: `OCCTA Billing <${fromEmail}>`,
              to: [profile.email],
              subject: `⚠️ Late Fee Applied - Invoice ${invoice.invoice_number}`,
              html: getLateFeeEmailHtml({
                customer_name: profile.full_name || 'Customer',
                invoice_number: invoice.invoice_number,
                original_amount: invoice.total,
                late_fee: LATE_FEE_AMOUNT,
                new_total: newTotal,
                days_overdue: daysOverdue,
              }),
            });
          }

          // Log audit
          await supabase.from('audit_logs').insert({
            action: 'late_fee_applied',
            entity: 'invoice',
            entity_id: invoice.id,
            metadata: { amount: LATE_FEE_AMOUNT, days_overdue: daysOverdue },
          });

          results.lateFeesApplied++;
          console.log(`Applied late fee to invoice ${invoice.invoice_number}`);
        } catch (err) {
          console.error(`Error processing late fee for ${invoice.invoice_number}:`, err);
          results.errors.push(`Failed to process ${invoice.invoice_number}`);
        }
      }
    }

    // 3. Send suspension warnings at 21 days overdue
    const suspensionWarningThreshold = new Date(today);
    suspensionWarningThreshold.setDate(suspensionWarningThreshold.getDate() - SUSPENSION_WARNING_DAYS);
    
    const { data: warningInvoices } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total,
        user_id,
        due_date
      `)
      .eq('status', 'overdue')
      .is('overdue_notified_at', null)
      .lte('due_date', suspensionWarningThreshold.toISOString().split('T')[0]);

    if (warningInvoices && warningInvoices.length > 0) {
      for (const invoice of warningInvoices) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', invoice.user_id)
            .single();

          const daysOverdue = Math.floor((today.getTime() - new Date(invoice.due_date!).getTime()) / (1000 * 60 * 60 * 24));
          const daysUntilSuspension = SUSPENSION_DAYS - daysOverdue;

          if (profile?.email && daysUntilSuspension > 0) {
            await resend.emails.send({
              from: `OCCTA Billing <${fromEmail}>`,
              to: [profile.email],
              subject: `🚨 FINAL WARNING - Service Suspension in ${daysUntilSuspension} days`,
              html: getSuspensionWarningEmailHtml({
                customer_name: profile.full_name || 'Customer',
                invoice_number: invoice.invoice_number,
                amount: invoice.total,
                days_until_suspension: daysUntilSuspension,
              }),
            });

            // Mark as warned
            await supabase
              .from('invoices')
              .update({ overdue_notified_at: new Date().toISOString() })
              .eq('id', invoice.id);

            results.suspensionWarnings++;
            console.log(`Sent suspension warning for invoice ${invoice.invoice_number}`);
          }
        } catch (err) {
          console.error(`Error sending suspension warning for ${invoice.invoice_number}:`, err);
        }
      }
    }

    // 4. SUSPEND SERVICES at 30 days overdue
    const suspensionThreshold = new Date(today);
    suspensionThreshold.setDate(suspensionThreshold.getDate() - SUSPENSION_DAYS);
    
    const { data: suspensionInvoices } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total,
        user_id,
        service_id
      `)
      .eq('status', 'overdue')
      .not('overdue_notified_at', 'is', null)
      .lt('due_date', suspensionThreshold.toISOString().split('T')[0]);

    if (suspensionInvoices && suspensionInvoices.length > 0) {
      for (const invoice of suspensionInvoices) {
        try {
          if (!invoice.service_id) continue;

          // Get service info
          const { data: service } = await supabase
            .from('services')
            .select('id, service_type, status')
            .eq('id', invoice.service_id)
            .single();

          if (!service || service.status === 'suspended') continue;

          // Get customer info
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', invoice.user_id)
            .single();

          // Suspend the service
          await supabase
            .from('services')
            .update({
              status: 'suspended',
              suspension_reason: `Non-payment: Invoice ${invoice.invoice_number}`,
            })
            .eq('id', service.id);

          if (profile?.email) {
            await resend.emails.send({
              from: `OCCTA Billing <${fromEmail}>`,
              to: [profile.email],
              subject: `⛔ Service Suspended - Invoice ${invoice.invoice_number}`,
              html: getServiceSuspendedEmailHtml({
                customer_name: profile.full_name || 'Customer',
                service_type: service.service_type || 'Broadband',
                amount_owed: invoice.total,
              }),
            });
          }

          // Log audit
          await supabase.from('audit_logs').insert({
            action: 'service_suspended',
            entity: 'service',
            entity_id: service.id,
            metadata: { reason: 'non_payment', invoice_id: invoice.id },
          });

          results.servicesSuspended++;
          console.log(`Suspended service for invoice ${invoice.invoice_number}`);
        } catch (err) {
          console.error(`Error suspending service for ${invoice.invoice_number}:`, err);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...results,
      message: `Processed: ${results.statusUpdates} status updates, ${results.lateFeesApplied} late fees, ${results.suspensionWarnings} warnings, ${results.servicesSuspended} suspensions`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process late fees error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
