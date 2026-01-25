import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Worldpay endpoints
const WORLDPAY_TRY_URL = "https://try.access.worldpay.com";
const WORLDPAY_LIVE_URL = "https://access.worldpay.com";
const isLiveMode = Deno.env.get('WORLDPAY_LIVE_MODE') === 'true';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, ...data } = await req.json();
    console.log(`Payment request action: ${action}`);

    switch (action) {
      // ==========================================
      // VALIDATE TOKEN
      // ==========================================
      case 'validate-token': {
        const { token, type } = data;

        if (!token) {
          return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenHash = await hashToken(token);

        const { data: request, error } = await supabase
          .from('payment_requests')
          .select('id, amount, currency, customer_name, customer_email, account_number, invoice_id, due_date, status, expires_at, type, user_id')
          .eq('token_hash', tokenHash)
          .eq('type', type)
          .single();

        if (error || !request) {
          console.log('Token lookup failed:', error);
          return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check expiry
        if (request.expires_at && new Date(request.expires_at) < new Date()) {
          return new Response(JSON.stringify({ success: false, error: 'Link has expired' }), {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check status
        if (!['sent', 'opened'].includes(request.status)) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: request.status === 'completed' ? 'This request has already been completed' : 'Invalid request status'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update to opened status and last_opened_at
        await supabase
          .from('payment_requests')
          .update({ status: 'opened', last_opened_at: new Date().toISOString() })
          .eq('id', request.id);

        await supabase.from('payment_request_events').insert({
          request_id: request.id,
          event_type: 'opened',
          metadata: {},
        });

        // Get invoice number if linked
        let invoiceNumber = null;
        if (request.invoice_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('invoice_number')
            .eq('id', request.invoice_id)
            .single();
          invoiceNumber = invoice?.invoice_number;
        }

        return new Response(JSON.stringify({
          success: true,
          request: {
            id: request.id,
            amount: request.amount,
            currency: request.currency,
            customer_name: request.customer_name,
            customer_email: request.customer_email,
            account_number: request.account_number,
            invoice_number: invoiceNumber,
            due_date: request.due_date,
            status: request.status,
            expires_at: request.expires_at,
            user_id: request.user_id,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // CREATE WORLDPAY SESSION
      // ==========================================
      case 'create-worldpay-session': {
        const { token, returnUrl } = data;

        if (!token || !returnUrl) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenHash = await hashToken(token);

        const { data: request, error } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('token_hash', tokenHash)
          .eq('type', 'card_payment')
          .single();

        if (error || !request) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!['sent', 'opened'].includes(request.status)) {
          return new Response(JSON.stringify({ success: false, error: 'Request not active' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const worldpayUsername = Deno.env.get('WORLDPAY_API_USERNAME');
        const worldpayPassword = Deno.env.get('WORLDPAY_API_PASSWORD');
        const worldpayEntityId = Deno.env.get('WORLDPAY_ENTITY_ID');

        if (!worldpayUsername || !worldpayPassword || !worldpayEntityId) {
          throw new Error('Worldpay credentials not configured');
        }

        const baseUrl = isLiveMode ? WORLDPAY_LIVE_URL : WORLDPAY_TRY_URL;
        const authHeader = 'Basic ' + btoa(`${worldpayUsername}:${worldpayPassword}`);

        // Get invoice number if linked
        let invoiceNumber = null;
        if (request.invoice_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('invoice_number')
            .eq('id', request.invoice_id)
            .single();
          invoiceNumber = invoice?.invoice_number;
        }

        const transactionRef = `PR-${request.id.slice(0, 8)}-${Date.now()}`;

        const response = await fetch(`${baseUrl}/payment_pages`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/vnd.worldpay.payment_pages-v1.hal+json',
            'Content-Type': 'application/vnd.worldpay.payment_pages-v1.hal+json',
          },
          body: JSON.stringify({
            transactionReference: transactionRef,
            merchant: { entity: worldpayEntityId },
            narrative: { line1: invoiceNumber ? `Invoice ${invoiceNumber}` : 'OCCTA Payment' },
            value: {
              currency: request.currency || 'GBP',
              amount: Math.round(request.amount * 100),
            },
            resultURLs: {
              successURL: `${returnUrl}&status=success`,
              failureURL: `${returnUrl}&status=failed`,
              cancelURL: `${returnUrl}&status=cancelled`,
            },
            ...(request.customer_email ? {
              riskData: { account: { email: request.customer_email } },
            } : {}),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Worldpay HPP error:', result);
          return new Response(JSON.stringify({ 
            success: false, 
            error: result.message || 'Failed to create payment session' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const checkoutUrl = result.url ?? result._links?.checkout?.href;

        if (!checkoutUrl) {
          return new Response(JSON.stringify({ success: false, error: 'No checkout URL returned' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Log payment attempt
        await supabase.from('payment_attempts').insert({
          user_id: request.user_id,
          invoice_id: request.invoice_id,
          amount: request.amount,
          status: 'pending',
          provider: isLiveMode ? 'worldpay_hpp_live' : 'worldpay_hpp_test',
          provider_ref: transactionRef,
        });

        // Update request with provider reference
        await supabase
          .from('payment_requests')
          .update({ provider_reference: transactionRef })
          .eq('id', request.id);

        return new Response(JSON.stringify({
          success: true,
          checkoutUrl,
          transactionReference: transactionRef,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // SUBMIT DD MANDATE
      // ==========================================
      case 'submit-dd-mandate': {
        const { token, mandateData } = data;

        if (!token || !mandateData) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenHash = await hashToken(token);

        const { data: request, error } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('token_hash', tokenHash)
          .eq('type', 'dd_setup')
          .single();

        if (error || !request) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!['sent', 'opened'].includes(request.status)) {
          return new Response(JSON.stringify({ success: false, error: 'Request not active' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Generate mandate reference
        const mandateRef = `DD-${request.account_number || 'OCC'}-${Date.now().toString(36).toUpperCase()}`;

        // Create DD mandate record
        const { data: mandate, error: mandateError } = await supabase
          .from('dd_mandates')
          .insert({
            user_id: request.user_id,
            status: 'pending',
            mandate_reference: mandateRef,
            bank_last4: mandateData.accountNumber.slice(-4),
            account_holder: mandateData.accountHolderName,
            account_holder_name: mandateData.accountHolderName,
            sort_code: mandateData.sortCode,
            account_number_full: mandateData.accountNumber,
            billing_address: mandateData.billingAddress,
            consent_timestamp: new Date().toISOString(),
            consent_ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
            consent_user_agent: mandateData.consentUserAgent,
            signature_name: mandateData.signatureName,
            payment_request_id: request.id,
          })
          .select()
          .single();

        if (mandateError) {
          console.error('Failed to create DD mandate:', mandateError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to create mandate' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update payment request as completed
        await supabase
          .from('payment_requests')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', request.id);

        // Log events
        await supabase.from('payment_request_events').insert({
          request_id: request.id,
          event_type: 'completed',
          metadata: { mandate_id: mandate.id, mandate_reference: mandateRef },
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          action: 'create',
          entity: 'dd_mandate',
          entity_id: mandate.id,
          metadata: { mandate_reference: mandateRef, payment_request_id: request.id },
        });

        return new Response(JSON.stringify({
          success: true,
          mandateId: mandate.id,
          mandateReference: mandateRef,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // SEND EMAIL
      // ==========================================
      case 'send-email': {
        const { requestId, rawToken } = data;

        if (!requestId || !rawToken) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: request, error } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (error || !request) {
          return new Response(JSON.stringify({ success: false, error: 'Request not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const siteUrl = Deno.env.get('SITE_URL') || 'https://www.occta.co.uk';
        const path = request.type === 'card_payment' ? '/pay' : '/dd/setup';
        const paymentLink = `${siteUrl}${path}?token=${rawToken}`;

        // Send email via existing send-email function
        const emailType = request.type === 'card_payment' ? 'payment_request_card' : 'payment_request_dd';
        
        // Call the Resend API directly
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
          console.log('RESEND_API_KEY not configured, skipping email');
          return new Response(JSON.stringify({ success: true, message: 'Email skipped (no API key)' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const emailHtml = request.type === 'card_payment' 
          ? getCardPaymentEmailHtml({
              customerName: request.customer_name,
              amount: request.amount,
              accountNumber: request.account_number,
              dueDate: request.due_date,
              paymentLink,
              expiresAt: request.expires_at,
            })
          : getDDSetupEmailHtml({
              customerName: request.customer_name,
              accountNumber: request.account_number,
              setupLink: paymentLink,
              expiresAt: request.expires_at,
            });

        const subject = request.type === 'card_payment' 
          ? 'Your OCCTA payment link'
          : 'Set up your OCCTA Direct Debit';

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'OCCTA <noreply@occta.co.uk>',
            to: [request.customer_email],
            subject,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error('Resend error:', errorData);
          return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // VERIFY PAYMENT (callback from Worldpay return)
      // ==========================================
      case 'verify-payment': {
        const { requestId, status } = data;

        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing requestId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: request, error } = await supabase
          .from('payment_requests')
          .select('*, invoices:invoice_id(invoice_number, total, user_id)')
          .eq('id', requestId)
          .single();

        if (error || !request) {
          return new Response(JSON.stringify({ success: false, error: 'Request not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (status === 'success') {
          // Mark request as completed
          await supabase
            .from('payment_requests')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', requestId);

          // Update payment attempt
          await supabase
            .from('payment_attempts')
            .update({ status: 'success' })
            .eq('provider_ref', request.provider_reference)
            .eq('status', 'pending');

          // If linked to invoice, mark invoice as paid and create receipt
          if (request.invoice_id) {
            await supabase
              .from('invoices')
              .update({ status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', request.invoice_id);

            const receiptRef = `RCP-${Date.now().toString(36).toUpperCase()}`;
            await supabase.from('receipts').insert({
              invoice_id: request.invoice_id,
              user_id: request.user_id,
              amount: request.amount,
              method: 'card',
              reference: receiptRef,
              paid_at: new Date().toISOString(),
            });

            // Audit log
            await supabase.from('audit_logs').insert({
              actor_user_id: request.user_id,
              action: 'payment_received',
              entity: 'invoice',
              entity_id: request.invoice_id,
              metadata: {
                amount: request.amount,
                method: 'payment_request',
                receipt_ref: receiptRef,
                payment_request_id: requestId,
              },
            });
          }

          // Log event
          await supabase.from('payment_request_events').insert({
            request_id: requestId,
            event_type: 'completed',
            metadata: { status: 'success' },
          });

          return new Response(JSON.stringify({ success: true, status: 'paid' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Failed or cancelled
          await supabase
            .from('payment_requests')
            .update({ status: status === 'cancelled' ? 'cancelled' : 'failed' })
            .eq('id', requestId);

          await supabase
            .from('payment_attempts')
            .update({ status, reason: status === 'cancelled' ? 'Cancelled by user' : 'Payment failed' })
            .eq('provider_ref', request.provider_reference)
            .eq('status', 'pending');

          await supabase.from('payment_request_events').insert({
            request_id: requestId,
            event_type: status === 'cancelled' ? 'cancelled' : 'failed',
            metadata: {},
          });

          return new Response(JSON.stringify({ success: false, status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Payment request error:', error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ==========================================
// EMAIL TEMPLATES
// ==========================================

function getCardPaymentEmailHtml(data: {
  customerName: string;
  amount: number;
  accountNumber: string | null;
  dueDate: string | null;
  paymentLink: string;
  expiresAt: string | null;
}) {
  const expiryDate = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('en-GB') : '7 days';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OCCTA Payment Link</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; }
    .header { background: #0d0d0d; padding: 24px; text-align: center; }
    .logo { color: #fff; font-size: 28px; letter-spacing: 4px; font-weight: bold; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #333; margin: 16px 0; }
    .amount-box { background: #f5f4ef; border: 3px solid #0d0d0d; padding: 24px; text-align: center; margin: 24px 0; }
    .amount { font-size: 36px; font-weight: bold; }
    .cta { display: inline-block; background: #0d0d0d; color: #fff; padding: 16px 40px; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0d0d0d; padding: 24px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
      </div>
      <div class="content">
        <p class="greeting">Hi ${data.customerName},</p>
        <p class="text">You have a payment due on your OCCTA account${data.accountNumber ? ` (${data.accountNumber})` : ''}.</p>
        
        <div class="amount-box">
          <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Amount Due</div>
          <div class="amount">£${data.amount?.toFixed(2)}</div>
          ${data.dueDate ? `<div style="font-size: 14px; color: #666; margin-top: 8px;">Due: ${new Date(data.dueDate).toLocaleDateString('en-GB')}</div>` : ''}
        </div>
        
        <p class="text">Click the button below to make your payment securely via our payment partner.</p>
        
        <div style="text-align: center;">
          <a href="${data.paymentLink}" class="cta">Pay Now →</a>
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">This link expires on ${expiryDate}. If you have any questions, call us on 0800 260 6627.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function getDDSetupEmailHtml(data: {
  customerName: string;
  accountNumber: string | null;
  setupLink: string;
  expiresAt: string | null;
}) {
  const expiryDate = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('en-GB') : '7 days';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set Up Your OCCTA Direct Debit</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; }
    .header { background: #0d0d0d; padding: 24px; text-align: center; }
    .logo { color: #fff; font-size: 28px; letter-spacing: 4px; font-weight: bold; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #333; margin: 16px 0; }
    .info-box { background: #f5f4ef; border-left: 4px solid #facc15; padding: 16px; margin: 24px 0; }
    .cta { display: inline-block; background: #0d0d0d; color: #fff; padding: 16px 40px; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; margin: 24px 0; }
    .footer { background: #0d0d0d; padding: 24px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">OCCTA</div>
      </div>
      <div class="content">
        <p class="greeting">Hi ${data.customerName},</p>
        <p class="text">We'd like to set up a Direct Debit for your OCCTA account${data.accountNumber ? ` (${data.accountNumber})` : ''} to make your future payments hassle-free.</p>
        
        <div class="info-box">
          <strong>Benefits of Direct Debit:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #666;">
            <li>Never miss a payment</li>
            <li>Protected by the Direct Debit Guarantee</li>
            <li>Easy to cancel at any time</li>
          </ul>
        </div>
        
        <p class="text">Click the button below to securely set up your Direct Debit. It only takes a few minutes.</p>
        
        <div style="text-align: center;">
          <a href="${data.setupLink}" class="cta">Set Up Direct Debit →</a>
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">This link expires on ${expiryDate}. If you have any questions, call us on 0800 260 6627.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
