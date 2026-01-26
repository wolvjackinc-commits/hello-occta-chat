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

// Rate limit configuration
const MAX_INVALID_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 60;

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check rate limit for token validation attempts
async function checkRateLimit(supabase: any, identifier: string): Promise<{ allowed: boolean; locked: boolean }> {
  const action = 'payment_token_validation';
  
  // Check if locked out
  const { data: lockCheck } = await supabase
    .from('rate_limits')
    .select('request_count, window_start')
    .eq('action', `${action}_lockout`)
    .eq('identifier', identifier)
    .single();
  
  if (lockCheck) {
    const lockoutEnd = new Date(lockCheck.window_start);
    lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_MINUTES);
    if (new Date() < lockoutEnd) {
      return { allowed: false, locked: true };
    }
  }

  // Check current rate limit
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

  const { data: rateData } = await supabase
    .from('rate_limits')
    .select('id, request_count')
    .eq('action', action)
    .eq('identifier', identifier)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (rateData && rateData.request_count >= MAX_INVALID_ATTEMPTS) {
    // Lock out the user
    await supabase.from('rate_limits').upsert({
      action: `${action}_lockout`,
      identifier,
      request_count: 1,
      window_start: new Date().toISOString(),
    }, { onConflict: 'action,identifier' });

    return { allowed: false, locked: true };
  }

  return { allowed: true, locked: false };
}

// Record invalid attempt
async function recordInvalidAttempt(supabase: any, identifier: string): Promise<void> {
  const action = 'payment_token_validation';
  
  // Upsert rate limit record
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('id, request_count')
    .eq('action', action)
    .eq('identifier', identifier)
    .single();

  if (existing) {
    await supabase
      .from('rate_limits')
      .update({ request_count: existing.request_count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase.from('rate_limits').insert({
      action,
      identifier,
      request_count: 1,
      window_start: new Date().toISOString(),
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';

  try {
    const { action, ...data } = await req.json();
    console.log(`Payment request action: ${action}`);

    switch (action) {
      // ==========================================
      // VALIDATE TOKEN (with security enhancements)
      // ==========================================
      case 'validate-token': {
        const { token, type } = data;

        if (!token) {
          return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Rate limit check
        const rateCheck = await checkRateLimit(supabase, clientIp);
        if (!rateCheck.allowed) {
          console.log(`Rate limit exceeded for IP: ${clientIp}`);
          return new Response(JSON.stringify({ 
            success: false, 
            error: rateCheck.locked 
              ? 'Too many invalid attempts. Please try again later.' 
              : 'Rate limit exceeded' 
          }), {
            status: 429,
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
          await recordInvalidAttempt(supabase, clientIp);
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

        // SECURITY: Reject completed/cancelled/failed tokens (one-time use)
        if (['completed', 'cancelled', 'failed'].includes(request.status)) {
          const statusMessages: Record<string, string> = {
            completed: 'This request has already been completed',
            cancelled: 'This request has been cancelled',
            failed: 'This request is no longer valid',
          };
          return new Response(JSON.stringify({ 
            success: false, 
            error: statusMessages[request.status] || 'Invalid request status'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Only allow sent or opened status
        if (!['sent', 'opened'].includes(request.status)) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'This request is not available'
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
          metadata: { client_ip: clientIp },
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

        // SECURITY: Only allow sent/opened status
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
          .update({ 
            provider: 'worldpay',
            provider_reference: transactionRef 
          })
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
      // SUBMIT DD MANDATE (keep pending until verified)
      // ==========================================
      case 'submit-dd-mandate': {
        const { token, mandateData } = data;

        if (!token || !mandateData) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Rate limit check
        const rateCheck = await checkRateLimit(supabase, clientIp);
        if (!rateCheck.allowed) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Too many attempts. Please try again later.' 
          }), {
            status: 429,
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
          await recordInvalidAttempt(supabase, clientIp);
          return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // SECURITY: Only allow sent/opened status
        if (!['sent', 'opened'].includes(request.status)) {
          return new Response(JSON.stringify({ success: false, error: 'Request not active' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Generate mandate reference
        const mandateRef = `DD-${request.account_number || 'OCC'}-${Date.now().toString(36).toUpperCase()}`;

        // Create DD mandate record with status 'pending' (NOT 'active' until provider/admin verifies)
        const { data: mandate, error: mandateError } = await supabase
          .from('dd_mandates')
          .insert({
            user_id: request.user_id,
            status: 'pending', // Keep pending until admin/provider verifies
            mandate_reference: mandateRef,
            bank_last4: mandateData.accountNumber.slice(-4),
            account_holder: mandateData.accountHolderName,
            account_holder_name: mandateData.accountHolderName,
            sort_code: mandateData.sortCode,
            account_number_full: mandateData.accountNumber,
            billing_address: mandateData.billingAddress,
            consent_timestamp: new Date().toISOString(),
            consent_ip: clientIp,
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

        // Update payment request to 'opened' (NOT completed - awaiting verification)
        // Use a special status to indicate submission received but pending verification
        await supabase
          .from('payment_requests')
          .update({ 
            status: 'opened', // Keep as opened, not completed
            provider: 'direct_debit',
            provider_reference: mandateRef,
          })
          .eq('id', request.id);

        // Log events
        await supabase.from('payment_request_events').insert({
          request_id: request.id,
          event_type: 'dd_submitted',
          metadata: { 
            mandate_id: mandate.id, 
            mandate_reference: mandateRef,
            awaiting_verification: true,
          },
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          action: 'create',
          entity: 'dd_mandate',
          entity_id: mandate.id,
          metadata: { 
            mandate_reference: mandateRef, 
            payment_request_id: request.id,
            status: 'pending',
            consent_ip: clientIp,
          },
        });

        return new Response(JSON.stringify({
          success: true,
          mandateId: mandate.id,
          mandateReference: mandateRef,
          status: 'pending', // Explicitly indicate pending verification
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // VERIFY DD MANDATE (admin action) with email notification
      // ==========================================
      case 'verify-dd-mandate': {
        const { mandateId, status, adminUserId, provider, providerReference } = data;

        if (!mandateId || !status) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const validStatuses = ['verified', 'active', 'cancelled', 'submitted_to_provider', 'failed'];
        if (!validStatuses.includes(status)) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid status' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // For submitted_to_provider, require provider details
        if (status === 'submitted_to_provider' && (!provider || !providerReference)) {
          return new Response(JSON.stringify({ success: false, error: 'Provider and provider reference required for submitted_to_provider status' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get current mandate with user info
        const { data: currentMandate, error: fetchError } = await supabase
          .from('dd_mandates')
          .select('*, payment_request_id')
          .eq('id', mandateId)
          .single();

        if (fetchError || !currentMandate) {
          return new Response(JSON.stringify({ success: false, error: 'Mandate not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const previousStatus = currentMandate.status;

        // Build update payload - include provider fields if submitting to provider
        const updatePayload: Record<string, unknown> = { 
          status, 
          updated_at: new Date().toISOString() 
        };
        
        if (status === 'submitted_to_provider' && provider && providerReference) {
          updatePayload.provider = provider;
          updatePayload.provider_reference = providerReference;
        }

        // Update mandate status
        const { data: mandate, error } = await supabase
          .from('dd_mandates')
          .update(updatePayload)
          .eq('id', mandateId)
          .select('*, payment_request_id')
          .single();

        if (error || !mandate) {
          return new Response(JSON.stringify({ success: false, error: 'Failed to update mandate' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // If verified/active, mark payment request as completed
        if (['verified', 'active'].includes(status) && mandate.payment_request_id) {
          await supabase
            .from('payment_requests')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', mandate.payment_request_id);

          await supabase.from('payment_request_events').insert({
            request_id: mandate.payment_request_id,
            event_type: 'completed',
            metadata: { mandate_status: status, verified_by: adminUserId },
          });
        }

        // Audit log with detailed action type
        const actionType = status === 'cancelled' ? 'cancel' : 
                          status === 'active' ? 'activate' : 'update';
        
        await supabase.from('audit_logs').insert({
          actor_user_id: adminUserId,
          action: actionType,
          entity: 'dd_mandate',
          entity_id: mandateId,
          metadata: { 
            previous_status: previousStatus,
            new_status: status,
            mandate_reference: mandate.mandate_reference,
            ...(provider && { provider }),
            ...(providerReference && { provider_reference: providerReference }),
          },
        });

        // Send email notification to customer on status change
        if (previousStatus !== status) {
          // Get customer email from payment request or profile
          let customerEmail: string | null = null;
          let customerName: string | null = null;
          let accountNumber: string | null = null;

          if (mandate.payment_request_id) {
            const { data: request } = await supabase
              .from('payment_requests')
              .select('customer_email, customer_name, account_number')
              .eq('id', mandate.payment_request_id)
              .single();
            if (request) {
              customerEmail = request.customer_email;
              customerName = request.customer_name;
              accountNumber = request.account_number;
            }
          }

          if (!customerEmail && mandate.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, full_name, account_number')
              .eq('id', mandate.user_id)
              .single();
            if (profile) {
              customerEmail = profile.email;
              customerName = profile.full_name;
              accountNumber = profile.account_number;
            }
          }

          // Send DD status email
          if (customerEmail) {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
              const emailContent = getDDStatusEmail({
                customerName: customerName || 'Customer',
                accountNumber,
                mandateReference: mandate.mandate_reference,
                status,
                previousStatus,
              });

              try {
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'OCCTA Billing <billing@occta.co.uk>',
                    to: [customerEmail],
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text,
                  }),
                });
                console.log(`DD status email sent to ${customerEmail} for status: ${status}`);
              } catch (emailErr) {
                console.error('Failed to send DD status email:', emailErr);
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, mandate }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // VIEW DD BANK DETAILS (with audit logging) - FULL DETAILS
      // ==========================================
      case 'view-dd-bank-details': {
        const { mandateId, adminUserId } = data;

        if (!mandateId || !adminUserId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch ALL mandate fields for admin view
        const { data: mandate, error } = await supabase
          .from('dd_mandates')
          .select(`
            id, 
            user_id,
            status,
            mandate_reference,
            sort_code, 
            account_number_full, 
            account_holder_name, 
            billing_address, 
            consent_timestamp, 
            consent_ip,
            consent_user_agent,
            signature_name,
            payment_request_id,
            provider,
            bank_last4,
            created_at,
            updated_at
          `)
          .eq('id', mandateId)
          .single();

        if (error || !mandate) {
          return new Response(JSON.stringify({ success: false, error: 'Mandate not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // AUDIT LOG: Record sensitive data access
        await supabase.from('audit_logs').insert({
          actor_user_id: adminUserId,
          action: 'view_sensitive',
          entity: 'dd_mandate',
          entity_id: mandateId,
          metadata: { 
            fields_viewed: ['sort_code', 'account_number_full', 'account_holder_name', 'billing_address', 'consent_ip', 'consent_user_agent'],
            client_ip: clientIp,
            mandate_reference: mandate.mandate_reference,
          },
        });

        return new Response(JSON.stringify({ 
          success: true, 
          bankDetails: {
            sortCode: mandate.sort_code,
            accountNumber: mandate.account_number_full,
            accountHolderName: mandate.account_holder_name,
            billingAddress: mandate.billing_address,
            consentTimestamp: mandate.consent_timestamp,
            consentIp: mandate.consent_ip,
            consentUserAgent: mandate.consent_user_agent,
            signatureName: mandate.signature_name,
            mandateReference: mandate.mandate_reference,
            status: mandate.status,
            provider: mandate.provider,
            bankLast4: mandate.bank_last4,
            paymentRequestId: mandate.payment_request_id,
            createdAt: mandate.created_at,
            updatedAt: mandate.updated_at,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // RECORD PHONE PAYMENT (admin action)
      // ==========================================
      case 'record-phone-payment': {
        const { invoiceId, amount, reference, notes, adminUserId } = data;

        if (!invoiceId || !amount || !adminUserId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get invoice details
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, user_id, invoice_number, total, status')
          .eq('id', invoiceId)
          .single();

        if (invoiceError || !invoice) {
          return new Response(JSON.stringify({ success: false, error: 'Invoice not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (invoice.status === 'paid') {
          return new Response(JSON.stringify({ success: false, error: 'Invoice already paid' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const receiptRef = reference || `TEL-${Date.now().toString(36).toUpperCase()}`;

        // Create receipt
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({
            invoice_id: invoiceId,
            user_id: invoice.user_id,
            amount: parseFloat(amount),
            method: 'phone',
            reference: receiptRef,
            paid_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (receiptError) {
          console.error('Failed to create receipt:', receiptError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to create receipt' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Mark invoice as paid
        await supabase
          .from('invoices')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', invoiceId);

        // Create payment attempt record
        await supabase.from('payment_attempts').insert({
          user_id: invoice.user_id,
          invoice_id: invoiceId,
          amount: parseFloat(amount),
          status: 'success',
          provider: 'phone',
          provider_ref: receiptRef,
          reason: notes || 'Phone payment recorded by admin',
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          actor_user_id: adminUserId,
          action: 'payment_received',
          entity: 'invoice',
          entity_id: invoiceId,
          metadata: {
            amount,
            method: 'phone',
            receipt_id: receipt.id,
            receipt_ref: receiptRef,
            invoice_number: invoice.invoice_number,
            notes,
          },
        });

        return new Response(JSON.stringify({
          success: true,
          receipt: {
            id: receipt.id,
            reference: receiptRef,
            amount,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==========================================
      // SEND EMAIL (improved templates)
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

        // Send email via Resend API
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
          console.log('RESEND_API_KEY not configured, skipping email');
          return new Response(JSON.stringify({ success: true, message: 'Email skipped (no API key)' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const emailContent = request.type === 'card_payment' 
          ? getCardPaymentEmail({
              customerName: request.customer_name,
              amount: request.amount,
              accountNumber: request.account_number,
              dueDate: request.due_date,
              paymentLink,
              expiresAt: request.expires_at,
            })
          : getDDSetupEmail({
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
            from: 'OCCTA Billing <billing@occta.co.uk>',
            to: [request.customer_email],
            subject,
            html: emailContent.html,
            text: emailContent.text,
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

          let receiptRef = '';
          // If linked to invoice, mark invoice as paid and create receipt
          if (request.invoice_id) {
            await supabase
              .from('invoices')
              .update({ status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', request.invoice_id);

            receiptRef = `RCP-${Date.now().toString(36).toUpperCase()}`;
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
                provider: 'worldpay',
                provider_reference: request.provider_reference,
                receipt_ref: receiptRef,
                payment_request_id: requestId,
              },
            });
          }

          // Log event
          await supabase.from('payment_request_events').insert({
            request_id: requestId,
            event_type: 'completed',
            metadata: { 
              status: 'success',
              provider_reference: request.provider_reference,
            },
          });

          // Send payment confirmation email
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey && request.customer_email) {
            try {
              const invoiceNumber = request.invoices?.invoice_number || null;
              const emailContent = getPaymentConfirmationEmail({
                customerName: request.customer_name,
                amount: request.amount,
                accountNumber: request.account_number,
                invoiceNumber,
                receiptReference: receiptRef,
                paidAt: new Date().toISOString(),
              });

              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'OCCTA Billing <billing@occta.co.uk>',
                  to: [request.customer_email],
                  subject: emailContent.subject,
                  html: emailContent.html,
                  text: emailContent.text,
                }),
              });
              console.log(`Payment confirmation email sent to ${request.customer_email}`);
            } catch (emailError) {
              console.error('Failed to send payment confirmation email:', emailError);
            }
          }

          return new Response(JSON.stringify({ success: true, status: 'paid' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Failed or cancelled
          const newStatus = status === 'cancelled' ? 'cancelled' : 'failed';
          
          await supabase
            .from('payment_requests')
            .update({ status: newStatus })
            .eq('id', requestId);

          await supabase
            .from('payment_attempts')
            .update({ 
              status: newStatus, 
              reason: status === 'cancelled' ? 'Cancelled by user' : 'Payment failed' 
            })
            .eq('provider_ref', request.provider_reference)
            .eq('status', 'pending');

          await supabase.from('payment_request_events').insert({
            request_id: requestId,
            event_type: newStatus,
            metadata: { provider_reference: request.provider_reference },
          });

          // Send payment cancellation/failure email
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey && request.customer_email) {
            try {
              const emailContent = getPaymentCancelledEmail({
                customerName: request.customer_name,
                amount: request.amount,
                accountNumber: request.account_number,
                status: newStatus,
              });

              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'OCCTA Billing <billing@occta.co.uk>',
                  to: [request.customer_email],
                  subject: emailContent.subject,
                  html: emailContent.html,
                  text: emailContent.text,
                }),
              });
              console.log(`Payment ${newStatus} email sent to ${request.customer_email}`);
            } catch (emailError) {
              console.error(`Failed to send payment ${newStatus} email:`, emailError);
            }
          }

          return new Response(JSON.stringify({ success: false, status: newStatus }), {
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
// EMAIL TEMPLATES (improved with plain-text)
// ==========================================

function getCardPaymentEmail(data: {
  customerName: string;
  amount: number;
  accountNumber: string | null;
  dueDate: string | null;
  paymentLink: string;
  expiresAt: string | null;
}): { html: string; text: string } {
  const expiryDate = data.expiresAt 
    ? new Date(data.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) 
    : '7 days from now';
  const dueDateFormatted = data.dueDate 
    ? new Date(data.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  
  const html = `
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
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 24px 0; font-size: 13px; color: #92400e; }
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
          ${dueDateFormatted ? `<div style="font-size: 14px; color: #666; margin-top: 8px;">Due: ${dueDateFormatted}</div>` : ''}
        </div>
        
        <p class="text">Click the button below to make your payment securely via our payment partner.</p>
        
        <div style="text-align: center;">
          <a href="${data.paymentLink}" class="cta">Pay Now →</a>
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">
          <strong>This link expires on ${expiryDate}.</strong>
        </p>
        
        <div class="warning">
          <strong>Didn't request this?</strong> If you didn't expect this payment request, please ignore this email or contact us immediately on 0800 260 6627.
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">
          If you have any questions, call us on <strong>0800 260 6627</strong> (Mon-Fri 9am-6pm, Sat 9am-1pm).
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
        <p style="margin-top: 12px; font-size: 11px;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `
OCCTA Payment Request

Hi ${data.customerName},

You have a payment due on your OCCTA account${data.accountNumber ? ` (${data.accountNumber})` : ''}.

Amount Due: £${data.amount?.toFixed(2)}
${dueDateFormatted ? `Due Date: ${dueDateFormatted}` : ''}

To make your payment securely, please visit:
${data.paymentLink}

This link expires on ${expiryDate}.

DIDN'T REQUEST THIS?
If you didn't expect this payment request, please ignore this email or contact us immediately on 0800 260 6627.

Questions? Call us on 0800 260 6627 (Mon-Fri 9am-6pm, Sat 9am-1pm).

---
© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.
OCCTA Limited is registered in England and Wales (Company No. 13828933)
`;

  return { html, text };
}

function getDDSetupEmail(data: {
  customerName: string;
  accountNumber: string | null;
  setupLink: string;
  expiresAt: string | null;
}): { html: string; text: string } {
  const expiryDate = data.expiresAt 
    ? new Date(data.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) 
    : '7 days from now';
  
  const html = `
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
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 24px 0; font-size: 13px; color: #92400e; }
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
        
        <p class="text" style="font-size: 13px; color: #666;">
          <strong>This link expires on ${expiryDate}.</strong>
        </p>
        
        <div class="warning">
          <strong>Didn't request this?</strong> If you didn't expect this Direct Debit setup request, please ignore this email or contact us immediately on 0800 260 6627.
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">
          If you have any questions, call us on <strong>0800 260 6627</strong> (Mon-Fri 9am-6pm, Sat 9am-1pm).
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
        <p style="margin-top: 12px; font-size: 11px;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `
OCCTA Direct Debit Setup

Hi ${data.customerName},

We'd like to set up a Direct Debit for your OCCTA account${data.accountNumber ? ` (${data.accountNumber})` : ''} to make your future payments hassle-free.

Benefits of Direct Debit:
- Never miss a payment
- Protected by the Direct Debit Guarantee
- Easy to cancel at any time

To set up your Direct Debit securely, please visit:
${data.setupLink}

This link expires on ${expiryDate}.

DIDN'T REQUEST THIS?
If you didn't expect this Direct Debit setup request, please ignore this email or contact us immediately on 0800 260 6627.

Questions? Call us on 0800 260 6627 (Mon-Fri 9am-6pm, Sat 9am-1pm).

---
© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.
OCCTA Limited is registered in England and Wales (Company No. 13828933)
`;

  return { html, text };
}

// ==========================================
// DD STATUS CHANGE EMAIL TEMPLATE
// ==========================================
function getDDStatusEmail(data: {
  customerName: string;
  accountNumber: string | null;
  mandateReference: string | null;
  status: string;
  previousStatus: string;
}): { html: string; text: string; subject: string } {
  const statusMessages: Record<string, { subject: string; title: string; message: string; nextSteps: string[] }> = {
    verified: {
      subject: 'Your OCCTA Direct Debit has been verified',
      title: 'Direct Debit Verified',
      message: 'Your Direct Debit mandate has been successfully verified. We will now submit it to our payment provider for activation.',
      nextSteps: [
        'Your mandate is being submitted to our payment provider',
        'You will receive confirmation once fully active',
        'Your first payment will be collected as agreed',
      ],
    },
    submitted_to_provider: {
      subject: 'Your OCCTA Direct Debit is being processed',
      title: 'Direct Debit Processing',
      message: 'Your Direct Debit mandate has been submitted to our payment provider and is currently being processed.',
      nextSteps: [
        'Processing typically takes 2-3 business days',
        'You will receive confirmation once active',
        'No action required from you',
      ],
    },
    active: {
      subject: 'Your OCCTA Direct Debit is now active',
      title: 'Direct Debit Active',
      message: 'Great news! Your Direct Debit mandate is now fully active and ready to process payments.',
      nextSteps: [
        'Payments will be collected automatically as agreed',
        'You will receive advance notice before each payment',
        'You can cancel at any time by contacting your bank',
      ],
    },
    cancelled: {
      subject: 'Your OCCTA Direct Debit has been cancelled',
      title: 'Direct Debit Cancelled',
      message: 'Your Direct Debit mandate has been cancelled. No further payments will be collected via this mandate.',
      nextSteps: [
        'No further payments will be taken via Direct Debit',
        'If you have outstanding payments, please arrange an alternative payment method',
        'Contact us if you would like to set up a new Direct Debit',
      ],
    },
  };

  const statusInfo = statusMessages[data.status] || {
    subject: 'Update on your OCCTA Direct Debit',
    title: 'Direct Debit Update',
    message: `Your Direct Debit mandate status has been updated to: ${data.status}.`,
    nextSteps: ['Contact us if you have any questions.'],
  };

  const statusColor = data.status === 'active' ? '#dcfce7' : data.status === 'cancelled' ? '#fee2e2' : '#fef3c7';
  const refHtml = data.mandateReference ? `<div class="status-ref">Reference: ${data.mandateReference}</div>` : '';
  const accountHtml = data.accountNumber ? `<div class="status-ref">Account: ${data.accountNumber}</div>` : '';
  const stepsHtml = statusInfo.nextSteps.map(step => `<li>${step}</li>`).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; }
    .header { background: #0d0d0d; padding: 24px; text-align: center; }
    .logo { color: #fff; font-size: 28px; letter-spacing: 4px; font-weight: bold; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #333; margin: 16px 0; }
    .status-box { background: ${statusColor}; border: 3px solid #0d0d0d; padding: 24px; text-align: center; margin: 24px 0; }
    .status-title { font-size: 20px; font-weight: bold; color: #0d0d0d; }
    .status-ref { font-size: 13px; color: #666; margin-top: 8px; }
    .next-steps { background: #f5f4ef; border-left: 4px solid #0d0d0d; padding: 16px; margin: 24px 0; }
    .next-steps h4 { margin: 0 0 12px 0; font-size: 14px; }
    .next-steps ul { margin: 0; padding-left: 20px; color: #666; }
    .next-steps li { margin-bottom: 8px; }
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
        
        <div class="status-box">
          <div class="status-title">${statusInfo.title}</div>
          ${refHtml}
          ${accountHtml}
        </div>
        
        <p class="text">${statusInfo.message}</p>
        
        <div class="next-steps">
          <h4>What happens next?</h4>
          <ul>
            ${stepsHtml}
          </ul>
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">
          If you have any questions, call us on <strong>0800 260 6627</strong> (Mon-Fri 9am-6pm, Sat 9am-1pm).
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
        <p style="margin-top: 12px; font-size: 11px;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const stepsText = statusInfo.nextSteps.map(step => `- ${step}`).join('\n');
  const refText = data.mandateReference ? `Reference: ${data.mandateReference}` : '';
  const accountText = data.accountNumber ? `Account: ${data.accountNumber}` : '';

  const text = `
OCCTA Direct Debit Update

Hi ${data.customerName},

${statusInfo.title}
${refText}
${accountText}

${statusInfo.message}

What happens next?
${stepsText}

Questions? Call us on 0800 260 6627 (Mon-Fri 9am-6pm, Sat 9am-1pm).

---
© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.
OCCTA Limited is registered in England and Wales (Company No. 13828933)
`;

  return { html, text, subject: statusInfo.subject };
}

// ==========================================
// PAYMENT CONFIRMATION EMAIL TEMPLATE
// ==========================================
function getPaymentConfirmationEmail(data: {
  customerName: string;
  amount: number;
  accountNumber: string | null;
  invoiceNumber: string | null;
  receiptReference: string;
  paidAt: string;
}): { html: string; text: string; subject: string } {
  const paidDate = new Date(data.paidAt).toLocaleDateString('en-GB', { 
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; }
    .header { background: #0d0d0d; padding: 24px; text-align: center; }
    .logo { color: #fff; font-size: 28px; letter-spacing: 4px; font-weight: bold; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #333; margin: 16px 0; }
    .success-box { background: #dcfce7; border: 3px solid #16a34a; padding: 24px; text-align: center; margin: 24px 0; }
    .success-title { font-size: 20px; font-weight: bold; color: #15803d; }
    .amount { font-size: 36px; font-weight: bold; color: #0d0d0d; margin-top: 12px; }
    .details-box { background: #f5f4ef; border-left: 4px solid #0d0d0d; padding: 16px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #0d0d0d; }
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
        
        <div class="success-box">
          <div class="success-title">✓ Payment Successful</div>
          <div class="amount">£${data.amount?.toFixed(2)}</div>
        </div>
        
        <p class="text">Thank you for your payment. Your transaction has been processed successfully.</p>
        
        <div class="details-box">
          <div style="font-weight: 600; margin-bottom: 12px;">Payment Details</div>
          ${data.accountNumber ? `<div class="detail-row"><span class="detail-label">Account:</span><span class="detail-value">${data.accountNumber}</span></div>` : ''}
          ${data.invoiceNumber ? `<div class="detail-row"><span class="detail-label">Invoice:</span><span class="detail-value">${data.invoiceNumber}</span></div>` : ''}
          <div class="detail-row"><span class="detail-label">Receipt:</span><span class="detail-value">${data.receiptReference}</span></div>
          <div class="detail-row"><span class="detail-label">Paid:</span><span class="detail-value">${paidDate}</span></div>
        </div>
        
        <p class="text" style="font-size: 13px; color: #666;">
          If you have any questions about this payment, call us on <strong>0800 260 6627</strong> (Mon-Fri 9am-6pm, Sat 9am-1pm).
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
        <p style="margin-top: 12px; font-size: 11px;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `
OCCTA Payment Confirmation

Hi ${data.customerName},

✓ Payment Successful: £${data.amount?.toFixed(2)}

Thank you for your payment. Your transaction has been processed successfully.

Payment Details:
${data.accountNumber ? `Account: ${data.accountNumber}` : ''}
${data.invoiceNumber ? `Invoice: ${data.invoiceNumber}` : ''}
Receipt: ${data.receiptReference}
Paid: ${paidDate}

Questions? Call us on 0800 260 6627 (Mon-Fri 9am-6pm, Sat 9am-1pm).

---
© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.
OCCTA Limited is registered in England and Wales (Company No. 13828933)
`;

  return { html, text, subject: 'Payment Confirmed - OCCTA' };
}

// ==========================================
// PAYMENT CANCELLED/FAILED EMAIL TEMPLATE
// ==========================================
function getPaymentCancelledEmail(data: {
  customerName: string;
  amount: number;
  accountNumber: string | null;
  status: 'cancelled' | 'failed';
}): { html: string; text: string; subject: string } {
  const isCancelled = data.status === 'cancelled';
  const title = isCancelled ? 'Payment Cancelled' : 'Payment Failed';
  const message = isCancelled 
    ? 'Your payment was cancelled. No money has been taken from your account.'
    : 'Unfortunately, your payment could not be processed. Please try again or use a different payment method.';
  const subject = isCancelled ? 'Payment Cancelled - OCCTA' : 'Payment Failed - OCCTA';
  const statusColor = isCancelled ? '#fef3c7' : '#fee2e2';
  const titleColor = isCancelled ? '#92400e' : '#dc2626';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f4ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border: 4px solid #0d0d0d; }
    .header { background: #0d0d0d; padding: 24px; text-align: center; }
    .logo { color: #fff; font-size: 28px; letter-spacing: 4px; font-weight: bold; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #333; margin: 16px 0; }
    .status-box { background: ${statusColor}; border: 3px solid #0d0d0d; padding: 24px; text-align: center; margin: 24px 0; }
    .status-title { font-size: 20px; font-weight: bold; color: ${titleColor}; }
    .amount { font-size: 28px; font-weight: bold; color: #0d0d0d; margin-top: 12px; }
    .next-steps { background: #f5f4ef; border-left: 4px solid #0d0d0d; padding: 16px; margin: 24px 0; }
    .cta { display: inline-block; background: #0d0d0d; color: #fff; padding: 16px 40px; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; margin: 16px 0; }
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
        
        <div class="status-box">
          <div class="status-title">${isCancelled ? '⚠' : '✗'} ${title}</div>
          <div class="amount">£${data.amount?.toFixed(2)}</div>
          ${data.accountNumber ? `<div style="font-size: 14px; color: #666; margin-top: 8px;">Account: ${data.accountNumber}</div>` : ''}
        </div>
        
        <p class="text">${message}</p>
        
        ${!isCancelled ? `
        <div class="next-steps">
          <strong>What you can do:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #666;">
            <li>Try paying again with the same or different card</li>
            <li>Contact your bank to ensure your card isn't blocked</li>
            <li>Call us on 0800 260 6627 for alternative payment options</li>
          </ul>
        </div>
        ` : ''}
        
        <p class="text" style="font-size: 13px; color: #666;">
          If you need assistance or would like to make a payment over the phone, call us on <strong>0800 260 6627</strong> (Mon-Fri 9am-6pm, Sat 9am-1pm).
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.</p>
        <p>OCCTA Limited is registered in England and Wales (Company No. 13828933)</p>
        <p style="margin-top: 12px; font-size: 11px;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `
OCCTA ${title}

Hi ${data.customerName},

${isCancelled ? '⚠' : '✗'} ${title}: £${data.amount?.toFixed(2)}
${data.accountNumber ? `Account: ${data.accountNumber}` : ''}

${message}

${!isCancelled ? `What you can do:
- Try paying again with the same or different card
- Contact your bank to ensure your card isn't blocked
- Call us on 0800 260 6627 for alternative payment options
` : ''}

Questions? Call us on 0800 260 6627 (Mon-Fri 9am-6pm, Sat 9am-1pm).

---
© ${new Date().getFullYear()} OCCTA Limited. All rights reserved.
OCCTA Limited is registered in England and Wales (Company No. 13828933)
`;

  return { html, text, subject };
}
