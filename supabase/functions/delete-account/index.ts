import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HTML escape helper to prevent injection attacks
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

    const { reason, confirmEmail, password } = await req.json();

    // Rate limiting for deletion attempts (5 attempts per hour per user)
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      _action: 'account_deletion',
      _identifier: user.id,
      _max_requests: 5,
      _window_minutes: 60
    });
    
    if (rateLimitError || rateLimitResult === false) {
      console.log(`SECURITY: Rate limit exceeded for account deletion: ${user.id}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many deletion attempts. Please wait an hour before trying again.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    
    // SECURITY: Require password re-authentication before deletion
    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Password is required to confirm account deletion',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Verify password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password,
    });
    
    if (signInError) {
      console.log(`SECURITY: Invalid password for account deletion attempt: ${user.id}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid password. Please enter your current password to confirm deletion.',
      }), {
        status: 401,
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

    // 6. Send confirmation email - UK Professional Template
    if (resendApiKey && user.email) {
      try {
        const siteUrl = Deno.env.get("SITE_URL") || "https://occta.co.uk";
        const currentYear = new Date().getFullYear();
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@occta.co.uk";
        
        await resend.emails.send({
          from: `OCCTA Telecom <${fromEmail}>`,
          to: [user.email],
          subject: 'Your OCCTA Account Has Been Deleted',
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Account Deleted - OCCTA</title>
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
      
      <div style="background: #6b7280; padding: 16px 32px; border-bottom: 4px solid #0d0d0d;">
        <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; margin: 0; letter-spacing: 2px;">
          Account Deleted
        </h1>
      </div>
      
      <div style="padding: 32px;">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Hi ${escapeHtml(profile?.full_name) || 'there'},</p>
        
        <p style="margin: 16px 0; color: #333; font-size: 15px; line-height: 1.7;">
          Your OCCTA account has been successfully deleted as requested.
        </p>
        
        <div style="background: #f0fdf4; border: 3px solid #22c55e; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
            ✓ All your personal data has been removed from our systems in accordance with <strong>GDPR requirements</strong>.
          </p>
        </div>
        
        <div style="background: #fef3c7; border: 2px solid #facc15; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
            <strong>⚠️ Didn't request this?</strong><br>
            If you did not request this deletion, please contact us immediately at <strong>hello@occta.co.uk</strong> or call <strong>0800 260 6626</strong>.
          </p>
        </div>
        
        <p style="margin: 24px 0 0 0; color: #333; font-size: 15px; line-height: 1.7;">
          We're sorry to see you go. If you ever want to return, we'll be here — no hard feelings!
        </p>
        
        <p style="margin: 24px 0 0 0; color: #333; font-size: 15px; line-height: 1.7;">
          Best regards,<br>
          <strong>The OCCTA Team</strong>
        </p>
      </div>
      
      <div style="background: #0d0d0d; padding: 32px;">
        <div style="text-align: center;">
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: #facc15;">OCCTA</div>
          
          <div style="margin: 20px 0;">
            <a href="${siteUrl}" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Website</a>
            <a href="${siteUrl}/privacy-policy" style="color: #ffffff; text-decoration: none; font-size: 12px; margin: 0 12px; text-transform: uppercase; letter-spacing: 1px;">Privacy</a>
          </div>
          
          <div style="margin: 24px 0; padding-top: 20px; border-top: 1px solid #333;">
            <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6;">
              Need help? Call <strong style="color: #fff;">0800 260 6626</strong> or email <a href="mailto:hello@occta.co.uk" style="color: #facc15; text-decoration: none;">hello@occta.co.uk</a>
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
      </div>
    </div>
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
