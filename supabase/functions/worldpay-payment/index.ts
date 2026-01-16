import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Worldpay Access Checkout API endpoints
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
    const worldpayCheckoutId = Deno.env.get('WORLDPAY_CHECKOUT_ID');

    if (!worldpayUsername || !worldpayPassword || !worldpayEntityId || !worldpayCheckoutId) {
      throw new Error('Worldpay credentials not configured');
    }

    // Using Try mode URL for testing
    const baseUrl = WORLDPAY_TRY_URL;
    const authHeader = 'Basic ' + btoa(`${worldpayUsername}:${worldpayPassword}`);

    const { action, ...data } = await req.json();

    switch (action) {
      case 'get-checkout-config': {
        // Just return the checkout ID for the SDK initialization
        // The SDK will handle session creation internally
        return new Response(JSON.stringify({
          success: true,
          checkoutId: worldpayCheckoutId,
          entityId: worldpayEntityId,
          isTryMode: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'process-payment': {
        const { cardSessionHref, cvvSessionHref, invoiceId, amount, currency, customerEmail, customerName, userId, invoiceNumber } = data;

        if (!cardSessionHref || !invoiceId || !amount) {
          throw new Error('Missing required payment data (cardSessionHref, invoiceId, amount required)');
        }

        console.log('Processing payment with sessions:', { 
          cardSession: cardSessionHref?.substring(0, 50) + '...', 
          cvvSession: cvvSessionHref ? cvvSessionHref.substring(0, 50) + '...' : 'none'
        });

        // Create the payment using the sessions from Access Checkout
        const paymentResponse = await fetch(`${baseUrl}/payments`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/vnd.worldpay.payments-v6+json',
            'Accept': 'application/vnd.worldpay.payments-v6+json',
          },
          body: JSON.stringify({
            transactionReference: `INV-${invoiceId.substring(0, 8)}-${Date.now()}`,
            merchant: {
              entity: worldpayEntityId,
            },
            instruction: {
              narrative: {
                line1: `Invoice ${invoiceNumber || 'Payment'}`,
              },
              value: {
                currency: currency || 'GBP',
                amount: Math.round(amount * 100), // Convert to minor units (pence)
              },
              paymentInstrument: {
                type: 'card/checkout+session',
                sessionHref: cardSessionHref,
                cvcHref: cvvSessionHref,
              },
            },
          }),
        });

        const paymentResult = await paymentResponse.json();
        console.log('Payment response status:', paymentResponse.status);
        console.log('Payment result:', JSON.stringify(paymentResult));

        if (!paymentResponse.ok) {
          console.error('Payment failed:', paymentResult);
          
          // Log the failed payment attempt
          await supabase.from('payment_attempts').insert({
            user_id: userId,
            invoice_id: invoiceId,
            amount: amount,
            status: 'failed',
            provider: 'worldpay',
            provider_ref: paymentResult.errorName || 'unknown',
            reason: paymentResult.message || 'Payment failed',
          });

          return new Response(JSON.stringify({
            success: false,
            error: paymentResult.message || 'Payment failed',
            details: paymentResult,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Payment successful - update invoice and create receipt
        const paymentRef = paymentResult.outcome?.id || 
                          paymentResult._links?.self?.href?.split('/').pop() || 
                          `WP-${Date.now()}`;

        // Update invoice status
        await supabase
          .from('invoices')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', invoiceId);

        // Create receipt
        await supabase.from('receipts').insert({
          invoice_id: invoiceId,
          user_id: userId,
          amount: amount,
          method: 'worldpay_card',
          reference: paymentRef,
          paid_at: new Date().toISOString(),
        });

        // Log successful payment
        await supabase.from('payment_attempts').insert({
          user_id: userId,
          invoice_id: invoiceId,
          amount: amount,
          status: 'success',
          provider: 'worldpay',
          provider_ref: paymentRef,
        });

        // Send confirmation email
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: customerEmail,
              type: 'invoice_paid',
              data: {
                customerName,
                invoiceNumber: invoiceNumber,
                amount: `£${amount.toFixed(2)}`,
                paymentReference: paymentRef,
              },
            }),
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }

        return new Response(JSON.stringify({
          success: true,
          paymentRef,
          message: 'Payment processed successfully',
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
