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

    if (!worldpayUsername || !worldpayPassword || !worldpayEntityId) {
      throw new Error('Worldpay credentials not configured');
    }

    // Using Try mode URL for testing
    const baseUrl = WORLDPAY_TRY_URL;
    const authHeader = 'Basic ' + btoa(`${worldpayUsername}:${worldpayPassword}`);

    const { action, ...data } = await req.json();

    switch (action) {
      case 'create-session': {
        // Create a verified tokens session for Access Checkout
        const sessionResponse = await fetch(`${baseUrl}/verifiedTokens/sessions`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/vnd.worldpay.verified-tokens-v3.hal+json',
            'Accept': 'application/vnd.worldpay.verified-tokens-v3.hal+json',
          },
          body: JSON.stringify({
            merchant: {
              entity: worldpayEntityId,
            },
            verificationCurrency: data.currency || 'GBP',
          }),
        });

        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          console.error('Session creation failed:', errorText);
          throw new Error(`Failed to create session: ${sessionResponse.status}`);
        }

        const sessionData = await sessionResponse.json();
        
        return new Response(JSON.stringify({
          success: true,
          sessionHref: sessionData._links?.['verifiedTokens:session']?.href,
          checkoutId: worldpayCheckoutId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'process-payment': {
        const { cvcHref, invoiceId, amount, currency, customerEmail, customerName } = data;

        if (!cvcHref || !invoiceId || !amount) {
          throw new Error('Missing required payment data');
        }

        // Create the payment using the verified token
        const paymentResponse = await fetch(`${baseUrl}/payments`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/vnd.worldpay.payments-v7+json',
            'Accept': 'application/vnd.worldpay.payments-v7+json',
          },
          body: JSON.stringify({
            transactionReference: `INV-${invoiceId}-${Date.now()}`,
            merchant: {
              entity: worldpayEntityId,
            },
            instruction: {
              narrative: {
                line1: `Invoice Payment`,
              },
              value: {
                currency: currency || 'GBP',
                amount: Math.round(amount * 100), // Convert to minor units (pence)
              },
              paymentInstrument: {
                type: 'card/checkout',
                cvcHref: cvcHref,
              },
            },
          }),
        });

        const paymentResult = await paymentResponse.json();

        if (!paymentResponse.ok) {
          console.error('Payment failed:', paymentResult);
          
          // Log the failed payment attempt
          await supabase.from('payment_attempts').insert({
            user_id: data.userId,
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
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Payment successful - update invoice and create receipt
        const paymentRef = paymentResult._links?.self?.href?.split('/').pop() || 
                          paymentResult.transactionReference;

        // Update invoice status
        await supabase
          .from('invoices')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', invoiceId);

        // Create receipt
        await supabase.from('receipts').insert({
          invoice_id: invoiceId,
          user_id: data.userId,
          amount: amount,
          method: 'worldpay_card',
          reference: paymentRef,
          paid_at: new Date().toISOString(),
        });

        // Log successful payment
        await supabase.from('payment_attempts').insert({
          user_id: data.userId,
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
                invoiceNumber: data.invoiceNumber,
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
