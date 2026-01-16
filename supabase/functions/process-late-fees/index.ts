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
        
        <p style="color: #666; font-size: 13px; text-align: center;">Questions? Contact hello@occta.co.uk</p>
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
      errors: [] as string[],
    };

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
        user_id
      `)
      .eq('status', 'overdue')
      .lt('due_date', suspensionWarningThreshold.toISOString().split('T')[0])
      .gte('due_date', new Date(suspensionWarningThreshold.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (warningInvoices && warningInvoices.length > 0) {
      for (const invoice of warningInvoices) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', invoice.user_id)
          .single();

        if (profile?.email) {
          await resend.emails.send({
            from: 'OCCTA Billing <billing@occta.co.uk>',
            to: [profile.email],
            subject: `🚨 Final Warning - Service Suspension in 9 days`,
            html: `
              <p>Hi ${profile.full_name || 'Customer'},</p>
              <p>Your invoice ${invoice.invoice_number} is 21 days overdue.</p>
              <p><strong>Your service will be suspended in 9 days if payment is not received.</strong></p>
              <p>Amount due: £${invoice.total.toFixed(2)}</p>
              <p>Please pay immediately to avoid service interruption.</p>
            `,
          });
          results.suspensionWarnings++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...results,
      message: `Processed: ${results.statusUpdates} status updates, ${results.lateFeesApplied} late fees, ${results.suspensionWarnings} warnings`,
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
