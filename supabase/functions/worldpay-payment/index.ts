import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Worldpay Hosted Payment Pages endpoints
const WORLDPAY_TRY_URL = "https://try.access.worldpay.com";
const WORLDPAY_LIVE_URL = "https://access.worldpay.com";

// Environment toggle - set WORLDPAY_LIVE_MODE=true in production
const isLiveMode = Deno.env.get('WORLDPAY_LIVE_MODE') === 'true';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const worldpayUsername = Deno.env.get('WORLDPAY_API_USERNAME');
    const worldpayPassword = Deno.env.get('WORLDPAY_API_PASSWORD');
    const worldpayEntityId = Deno.env.get('WORLDPAY_ENTITY_ID');

    if (!worldpayUsername || !worldpayPassword || !worldpayEntityId) {
      throw new Error('Worldpay credentials not configured');
    }

    // Select endpoint based on mode
    const baseUrl = isLiveMode ? WORLDPAY_LIVE_URL : WORLDPAY_TRY_URL;
    const authHeader = 'Basic ' + btoa(`${worldpayUsername}:${worldpayPassword}`);

    console.log(`Worldpay mode: ${isLiveMode ? 'LIVE' : 'TEST'}`);

    const { action, ...data } = await req.json();

    // SECURITY: All actions require an authenticated user. Ownership of the
    // referenced invoice is verified server-side (callers cannot mark
    // someone else's invoice as paid or initiate sessions for it).
    const reqAuthHeader = req.headers.get('Authorization') || '';
    const jwt = reqAuthHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerUserId = userData.user.id;
    const { data: callerIsAdmin } = await supabase.rpc('has_role', {
      _user_id: callerUserId,
      _role: 'admin',
    });

    switch (action) {
      case 'create-payment-session': {
        // Create a Hosted Payment Page session
        const { invoiceId, currency, customerEmail, returnUrl, paymentOrigin } = data;

        if (!invoiceId || !returnUrl) {
          throw new Error('Missing required data (invoiceId, returnUrl)');
        }

        // Verify the invoice exists and the caller owns it (or is admin).
        // Amount and invoice_number are derived from the DB — never trusted from client.
        const { data: invoiceRow, error: invErr } = await supabase
          .from('invoices')
          .select('id, user_id, invoice_number, total, status')
          .eq('id', invoiceId)
          .single();

        if (invErr || !invoiceRow) {
          return new Response(JSON.stringify({ success: false, error: 'Invoice not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (invoiceRow.user_id !== callerUserId && !callerIsAdmin) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (invoiceRow.status === 'paid') {
          return new Response(JSON.stringify({ success: false, error: 'Invoice already paid' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const amount = Number(invoiceRow.total);
        const invoiceNumber = invoiceRow.invoice_number;
        const userId = invoiceRow.user_id;

        console.log('Creating HPP session for invoice:', invoiceId, 'mode:', isLiveMode ? 'LIVE' : 'TEST');

        // Worldpay/Cardinal 3DS uses postMessage between iframes; the merchant origin must be explicit and stable.
        // Prefer an explicitly provided origin (from the frontend helper), otherwise derive it from returnUrl.
        let shopperBrowserPaymentOrigin: string | undefined;
        try {
          shopperBrowserPaymentOrigin = paymentOrigin || (returnUrl ? new URL(returnUrl).origin : undefined);
        } catch {
          shopperBrowserPaymentOrigin = paymentOrigin;
        }

        // Create the payment page session
        const response = await fetch(`${baseUrl}/payment_pages`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/vnd.worldpay.payment_pages-v1.hal+json',
            'Content-Type': 'application/vnd.worldpay.payment_pages-v1.hal+json',
          },
          body: JSON.stringify({
            transactionReference: `INV-${invoiceId}-${Date.now()}`,
            merchant: {
              entity: worldpayEntityId,
            },
            ...(shopperBrowserPaymentOrigin
              ? {
                  shopperBrowserPaymentOrigin,
                }
              : {}),
            narrative: {
              line1: `Invoice ${invoiceNumber || 'Payment'}`,
            },
            value: {
              currency: currency || 'GBP',
              amount: Math.round(amount * 100), // Convert to minor units (pence)
            },
            resultURLs: {
              successURL: `${returnUrl}?status=success&invoiceId=${invoiceId}`,
              failureURL: `${returnUrl}?status=failed&invoiceId=${invoiceId}`,
              cancelURL: `${returnUrl}?status=cancelled&invoiceId=${invoiceId}`,
              // Optional extras to avoid user dead-ends (Worldpay may ignore if not supported on account)
              errorURL: `${returnUrl}?status=failed&invoiceId=${invoiceId}`,
              pendingURL: `${returnUrl}?status=pending&invoiceId=${invoiceId}`,
              expiryURL: `${returnUrl}?status=failed&invoiceId=${invoiceId}`,
            },
            // HPP schema does not allow billingAddress.email; email belongs in riskData
            ...(customerEmail
              ? {
                  riskData: {
                    account: {
                      email: customerEmail,
                    },
                  },
                }
              : {}),
          }),
        });

        const result = await response.json();
        console.log('HPP session response status:', response.status);
        console.log('HPP session result:', JSON.stringify(result, null, 2));

        if (!response.ok) {
          console.error('Failed to create HPP session:', result);
          return new Response(
            JSON.stringify({
              success: false,
              error: result.message || result.errorName || 'Failed to create payment session',
              details: result,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Extract the checkout URL from the response (docs: `url` OR HAL link)
        const checkoutUrl = result.url ?? result._links?.checkout?.href;

        if (!checkoutUrl) {
          console.error('No checkout URL in response:', result);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'No checkout URL returned from Worldpay',
              details: result,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Log the payment attempt
        await supabase.from('payment_attempts').insert({
          user_id: userId,
          invoice_id: invoiceId,
          amount: amount,
          status: 'pending',
          provider: isLiveMode ? 'worldpay_hpp_live' : 'worldpay_hpp_test',
          provider_ref: result.transactionReference || result._links?.self?.href,
        });

        return new Response(JSON.stringify({
          success: true,
          checkoutUrl,
          transactionReference: result.transactionReference,
          mode: isLiveMode ? 'live' : 'test',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'verify-payment': {
        // SECURITY: Read-only. The Worldpay webhook is the sole source of truth
        // for invoice payment status changes. This endpoint only returns the
        // current status from the database so the UI can render the result.
        const { invoiceId, status } = data;

        if (!invoiceId) {
          throw new Error('Missing invoiceId');
        }

        const { data: invoice, error: invErr } = await supabase
          .from('invoices')
          .select('id, user_id, status')
          .eq('id', invoiceId)
          .single();

        if (invErr || !invoice) {
          return new Response(JSON.stringify({ success: false, error: 'Invoice not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (invoice.user_id !== callerUserId && !callerIsAdmin) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const isPaid = invoice.status === 'paid';
        return new Response(JSON.stringify({
          success: isPaid,
          status: isPaid ? 'paid' : (status || invoice.status),
          message: isPaid
            ? 'Payment verified successfully'
            : 'Payment is still being processed — please refresh in a moment.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Worldpay error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
