import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

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

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { reason, confirmEmail } = await req.json();

    // Verify the email matches the user's email
    if (confirmEmail?.toLowerCase() !== user.email?.toLowerCase()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email confirmation does not match your account email',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting account deletion for user ${user.id} (${user.email})`);

    // 1. Check for active services or unpaid invoices
    const { data: activeServices } = await supabase
      .from('services')
      .select('id, service_type, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (activeServices && activeServices.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You have active services. Please cancel all services before deleting your account.',
        activeServices: activeServices.map(s => s.service_type),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total')
      .eq('user_id', user.id)
      .in('status', ['sent', 'overdue']);

    if (unpaidInvoices && unpaidInvoices.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You have unpaid invoices. Please settle all outstanding balances before deleting your account.',
        unpaidInvoices: unpaidInvoices.map(i => ({ number: i.invoice_number, amount: i.total })),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get profile data for deletion record
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, account_number')
      .eq('id', user.id)
      .single();

    // 3. Create deletion record for audit trail
    await supabase.from('account_deletions').insert({
      original_user_id: user.id,
      email: user.email || '',
      full_name: profile?.full_name || null,
      account_number: profile?.account_number || null,
      reason: reason || 'User requested account deletion',
      deleted_by: 'user_request',
    });

    // 4. Delete user data (in correct order for foreign keys)
    
    // Delete ticket messages first
    await supabase
      .from('ticket_messages')
      .delete()
      .eq('user_id', user.id);

    // Delete support tickets
    await supabase
      .from('support_tickets')
      .delete()
      .eq('user_id', user.id);

    // Delete order messages
    await supabase
      .from('order_messages')
      .delete()
      .eq('sender_id', user.id);

    // Delete DD mandates
    await supabase
      .from('dd_mandates')
      .delete()
      .eq('user_id', user.id);

    // Delete billing settings
    await supabase
      .from('billing_settings')
      .delete()
      .eq('user_id', user.id);

    // Delete user files
    await supabase
      .from('user_files')
      .delete()
      .eq('user_id', user.id);

    // Delete receipts
    await supabase
      .from('receipts')
      .delete()
      .eq('user_id', user.id);

    // Delete payment attempts
    await supabase
      .from('payment_attempts')
      .delete()
      .eq('user_id', user.id);

    // Delete credit notes (need to get invoice IDs first)
    const { data: userInvoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', user.id);

    if (userInvoices && userInvoices.length > 0) {
      const invoiceIds = userInvoices.map(i => i.id);
      await supabase
        .from('credit_notes')
        .delete()
        .in('invoice_id', invoiceIds);
        
      await supabase
        .from('invoice_lines')
        .delete()
        .in('invoice_id', invoiceIds);
    }

    // Delete invoices
    await supabase
      .from('invoices')
      .delete()
      .eq('user_id', user.id);

    // Delete services
    await supabase
      .from('services')
      .delete()
      .eq('user_id', user.id);

    // Delete orders
    await supabase
      .from('orders')
      .delete()
      .eq('user_id', user.id);

    // Delete user roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user.id);

    // Delete profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // 5. Delete the auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Continue anyway - data is already deleted
    }

    // 6. Send confirmation email
    if (resendApiKey && user.email) {
      try {
        await resend.emails.send({
          from: 'OCCTA <noreply@occta.co.uk>',
          to: [user.email],
          subject: 'Your OCCTA Account Has Been Deleted',
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f5f4ef; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; padding: 32px; }
    h1 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Account Deleted</h1>
    <p>Hi ${profile?.full_name || 'there'},</p>
    <p>Your OCCTA account has been successfully deleted as requested.</p>
    <p>All your personal data has been removed from our systems in accordance with GDPR requirements.</p>
    <p>If you did not request this deletion, please contact us immediately at <strong>hello@occta.co.uk</strong> or call <strong>0333 772 1190</strong>.</p>
    <p>We're sorry to see you go. If you ever want to return, we'll be here.</p>
    <p>Best regards,<br>The OCCTA Team</p>
  </div>
</body>
</html>`,
        });
      } catch (emailErr) {
        console.error('Failed to send deletion confirmation email:', emailErr);
      }
    }

    console.log(`Account deleted successfully for user ${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Your account has been deleted successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
