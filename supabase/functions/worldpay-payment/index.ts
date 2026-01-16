import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Worldpay Hosted Payment Pages endpoints
const WORLDPAY_TRY_URL = "https://try.access.worldpay.com";
const WORLDPAY_LIVE_URL = "https://access.worldpay.com";

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

    // Using Try mode URL for testing
    const baseUrl = WORLDPAY_TRY_URL;
    const authHeader = 'Basic ' + btoa(`${worldpayUsername}:${worldpayPassword}`);

    const { action, ...data } = await req.json();

    switch (action) {
      case 'create-payment-session': {
        // Create a Hosted Payment Page session
        const { invoiceId, invoiceNumber, amount, currency, customerEmail, customerName, userId, returnUrl } = data;

        if (!invoiceId || !amount || !returnUrl) {
          throw new Error('Missing required data (invoiceId, amount, returnUrl)');
        }

        console.log('Creating HPP session for invoice:', invoiceId);

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
          provider: 'worldpay_hpp',
          provider_ref: result.transactionReference || result._links?.self?.href,
        });

        return new Response(JSON.stringify({
          success: true,
          checkoutUrl,
          transactionReference: result.transactionReference,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'verify-payment': {
        // Verify payment status after redirect
        const { invoiceId, status } = data;

        if (!invoiceId) {
          throw new Error('Missing invoiceId');
        }

        console.log('Verifying payment for invoice:', invoiceId, 'status:', status);

        if (status === 'success') {
          // Update invoice status to paid
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', invoiceId);

          if (updateError) {
            console.error('Failed to update invoice:', updateError);
          }

          // Update payment attempt
          await supabase
            .from('payment_attempts')
            .update({ status: 'success' })
            .eq('invoice_id', invoiceId)
            .eq('status', 'pending');

          return new Response(JSON.stringify({
            success: true,
            status: 'paid',
            message: 'Payment verified successfully',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (status === 'failed') {
          // Update payment attempt as failed
          await supabase
            .from('payment_attempts')
            .update({ status: 'failed', reason: 'Payment failed at Worldpay' })
            .eq('invoice_id', invoiceId)
            .eq('status', 'pending');

          return new Response(JSON.stringify({
            success: false,
            status: 'failed',
            message: 'Payment failed',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Cancelled
          await supabase
            .from('payment_attempts')
            .update({ status: 'cancelled', reason: 'Payment cancelled by user' })
            .eq('invoice_id', invoiceId)
            .eq('status', 'pending');

          return new Response(JSON.stringify({
            success: false,
            status: 'cancelled',
            message: 'Payment was cancelled',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
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
