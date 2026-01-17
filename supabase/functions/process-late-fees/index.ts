import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; }
    .banner { background: #ef4444; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; }
    .content { padding: 32px; }
    .fee-box { background: #fef2f2; border: 3px solid #ef4444; padding: 24px; margin: 24px 0; }
    .fee-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #fca5a5; }
    .fee-total { font-family: 'Bebas Neue', sans-serif; font-size: 24px; margin-top: 12px; background: #ef4444; color: #fff; padding: 12px; text-align: center; }
    .cta { display: inline-block; background: #0d0d0d; color: #fff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; }
    .footer { background: #0d0d0d; padding: 28px; text-align: center; color: #888; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><div class="logo">OCCTA</div></div>
      <div class="banner"><h1 class="title">⚠️ Late Fee Applied</h1></div>
      <div class="content">
        <p style="font-size: 18px; font-weight: 700;">Hi ${escapeHtml(data.customer_name)},</p>
        <p style="margin: 16px 0; color: #333;">Your invoice <strong>${escapeHtml(data.invoice_number)}</strong> is now ${data.days_overdue} days overdue. A late payment fee has been applied to your account.</p>
        
        <div class="fee-box">
          <div class="fee-row"><span>Original Amount</span><span>£${data.original_amount.toFixed(2)}</span></div>
          <div class="fee-row"><span style="color: #ef4444; font-weight: 600;">Late Fee</span><span style="color: #ef4444; font-weight: 600;">+£${data.late_fee.toFixed(2)}</span></div>
          <div class="fee-total">NEW TOTAL: £${data.new_total.toFixed(2)}</div>
        </div>
        
        <p style="color: #666; font-size: 14px;">To avoid further fees and potential service interruption, please pay your invoice as soon as possible.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" class="cta">Pay Now →</a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">Questions? Contact hello@occta.co.uk or call 0333 772 1190</p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</div>
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
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; }
    .banner { background: #dc2626; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; }
    .content { padding: 32px; }
    .warning-box { background: #fef2f2; border: 4px solid #dc2626; padding: 24px; margin: 24px 0; text-align: center; }
    .countdown { font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #dc2626; }
    .cta { display: inline-block; background: #dc2626; color: #fff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; }
    .footer { background: #0d0d0d; padding: 28px; text-align: center; color: #888; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><div class="logo">OCCTA</div></div>
      <div class="banner"><h1 class="title">🚨 FINAL WARNING - Service Suspension</h1></div>
      <div class="content">
        <p style="font-size: 18px; font-weight: 700;">Hi ${escapeHtml(data.customer_name)},</p>
        <p style="margin: 16px 0; color: #333;">Your invoice <strong>${escapeHtml(data.invoice_number)}</strong> remains unpaid and your services are at risk of suspension.</p>
        
        <div class="warning-box">
          <p style="margin: 0 0 12px 0; font-weight: 600;">SERVICE SUSPENSION IN</p>
          <div class="countdown">${data.days_until_suspension} DAYS</div>
          <p style="margin: 12px 0 0 0; font-size: 14px; color: #666;">Amount Due: <strong>£${data.amount.toFixed(2)}</strong></p>
        </div>
        
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          <strong>What happens if services are suspended:</strong><br>
          • Your broadband/phone service will be disconnected<br>
          • A reconnection fee may apply<br>
          • Your account may be sent to collections
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" class="cta">PAY NOW TO AVOID SUSPENSION →</a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">
          Need to discuss payment options? Contact us at hello@occta.co.uk or call 0333 772 1190
        </p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</div>
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
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: 'Inter', sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; box-shadow: 8px 8px 0 0 #0d0d0d; }
    .header { background: #0d0d0d; padding: 32px; }
    .logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff; letter-spacing: 4px; }
    .banner { background: #7f1d1d; padding: 16px 32px; border-bottom: 4px solid #0d0d0d; }
    .title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; }
    .content { padding: 32px; }
    .suspended-box { background: #1f2937; color: #fff; padding: 24px; margin: 24px 0; text-align: center; }
    .suspended-icon { font-size: 48px; margin-bottom: 12px; }
    .cta { display: inline-block; background: #16a34a; color: #fff; padding: 16px 40px; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; }
    .footer { background: #0d0d0d; padding: 28px; text-align: center; color: #888; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><div class="logo">OCCTA</div></div>
      <div class="banner"><h1 class="title">⛔ Service Suspended</h1></div>
      <div class="content">
        <p style="font-size: 18px; font-weight: 700;">Hi ${escapeHtml(data.customer_name)},</p>
        <p style="margin: 16px 0; color: #333;">Due to non-payment of your account, your ${escapeHtml(data.service_type)} service has been suspended.</p>
        
        <div class="suspended-box">
          <div class="suspended-icon">⛔</div>
          <p style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; margin: 0;">SERVICE SUSPENDED</p>
          <p style="margin: 12px 0 0 0; font-size: 14px; opacity: 0.8;">Outstanding Balance: £${data.amount_owed.toFixed(2)}</p>
        </div>
        
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          <strong>To restore your service:</strong><br>
          1. Pay your outstanding balance in full<br>
          2. A reconnection fee of £25 may apply<br>
          3. Service will be restored within 24 hours of payment
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${siteUrl}/dashboard" class="cta">PAY NOW TO RESTORE SERVICE →</a>
        </div>
        
        <p style="color: #666; font-size: 13px; text-align: center;">
          Contact us at hello@occta.co.uk or call 0333 772 1190 to discuss payment options.
        </p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} OCCTA Telecom. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
              from: 'OCCTA Billing <billing@occta.co.uk>',
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
              from: 'OCCTA Billing <billing@occta.co.uk>',
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
      .lte('due_date', suspensionThreshold.toISOString().split('T')[0]);

    if (suspensionInvoices && suspensionInvoices.length > 0) {
      for (const invoice of suspensionInvoices) {
        try {
          // Get user's active services
          const { data: services } = await supabase
            .from('services')
            .select('id, service_type, status')
            .eq('user_id', invoice.user_id)
            .eq('status', 'active');

          if (services && services.length > 0) {
            // Suspend all active services for this user
            for (const service of services) {
              await supabase
                .from('services')
                .update({
                  status: 'suspended',
                  suspension_reason: `Non-payment - Invoice ${invoice.invoice_number} overdue 30+ days`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', service.id);

              console.log(`Suspended service ${service.id} (${service.service_type}) for user ${invoice.user_id}`);
            }

            // Get customer details and notify
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', invoice.user_id)
              .single();

            if (profile?.email) {
              const serviceTypes = services.map(s => s.service_type).join(', ');
              
              await resend.emails.send({
                from: 'OCCTA Billing <billing@occta.co.uk>',
                to: [profile.email],
                subject: `⛔ Your OCCTA Service Has Been Suspended`,
                html: getServiceSuspendedEmailHtml({
                  customer_name: profile.full_name || 'Customer',
                  service_type: serviceTypes,
                  amount_owed: invoice.total,
                }),
              });
            }

            // Log audit
            await supabase.from('audit_logs').insert({
              action: 'service_suspended',
              entity: 'user',
              entity_id: invoice.user_id,
              metadata: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                services_suspended: services.length,
                reason: 'non_payment_30_days',
              },
            });

            results.servicesSuspended += services.length;
          }
        } catch (err) {
          console.error(`Error suspending services for invoice ${invoice.invoice_number}:`, err);
          results.errors.push(`Failed to suspend for ${invoice.invoice_number}`);
        }
      }
    }

    console.log('Late fee processing complete:', results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
      message: `Processed: ${results.statusUpdates} status updates, ${results.lateFeesApplied} late fees, ${results.suspensionWarnings} warnings, ${results.servicesSuspended} services suspended`,
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
