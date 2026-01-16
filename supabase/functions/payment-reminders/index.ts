import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { days_before = 3 } = await req.json().catch(() => ({}));

    console.log(`Checking for invoices due within ${days_before} days...`);

    // Calculate the target date range
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + days_before);
    
    const todayStr = today.toISOString().split('T')[0];
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Find unpaid invoices approaching due date
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total_amount:total,
        due_date,
        user_id,
        profiles:user_id (
          email,
          full_name
        )
      `)
      .in('status', ['sent', 'draft', 'overdue'])
      .gte('due_date', todayStr)
      .lte('due_date', targetDateStr);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${invoices?.length || 0} invoices needing reminders`);

    const results = {
      total: invoices?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send reminder emails for each invoice
    for (const invoice of invoices || []) {
      // Handle profiles as array (from join) or single object
      const profileData = invoice.profiles;
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      
      if (!profile?.email) {
        console.log(`Skipping invoice ${invoice.invoice_number} - no email`);
        results.failed++;
        results.errors.push(`Invoice ${invoice.invoice_number}: No email address`);
        continue;
      }

      try {
        // Calculate days until due
        const dueDate = new Date(invoice.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            type: 'payment_reminder',
            to: profile.email,
            data: {
              customer_name: profile.full_name || 'Customer',
              invoice_number: invoice.invoice_number,
              total: invoice.total_amount,
              due_date: new Date(invoice.due_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              days_until_due: daysUntilDue,
              invoice_id: invoice.id,
            },
          }),
        });

        if (emailResponse.ok) {
          console.log(`Reminder sent for invoice ${invoice.invoice_number}`);
          results.sent++;
        } else {
          const errorText = await emailResponse.text();
          console.error(`Failed to send reminder for ${invoice.invoice_number}:`, errorText);
          results.failed++;
          results.errors.push(`Invoice ${invoice.invoice_number}: ${errorText}`);
        }
      } catch (emailError) {
        console.error(`Error sending reminder for ${invoice.invoice_number}:`, emailError);
        results.failed++;
        results.errors.push(`Invoice ${invoice.invoice_number}: ${emailError}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.total} invoices: ${results.sent} sent, ${results.failed} failed`,
      results,
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
