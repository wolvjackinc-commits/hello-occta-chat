import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wp-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the raw body for signature verification
    const body = await req.text();
    const payload = JSON.parse(body);

    console.log('Worldpay webhook received:', JSON.stringify(payload, null, 2));

    // Extract event type and data
    const eventType = payload.eventType || payload.type;
    const eventId = payload.eventId || payload.id;
    const eventTimestamp = payload.eventTimestamp || new Date().toISOString();

    // Log the webhook event
    await supabase.from('audit_logs').insert({
      action: 'worldpay_webhook',
      entity: 'payment',
      entity_id: payload.transactionReference || eventId,
      metadata: {
        eventType,
        eventId,
        eventTimestamp,
        payload,
      },
    });

    // Handle different event types
    switch (eventType) {
      case 'payment.authorized':
      case 'payment.settled':
      case 'payment.captured': {
        // Payment successful - find and update invoice
        const transactionRef = payload.transactionReference;
        if (transactionRef && transactionRef.startsWith('INV-')) {
          const invoiceId = transactionRef.split('-')[1];
          
          // Update invoice status
          await supabase
            .from('invoices')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', invoiceId);

          console.log(`Invoice ${invoiceId} marked as paid via webhook`);
        }
        break;
      }

      case 'payment.failed':
      case 'payment.refused': {
        // Payment failed
        const transactionRef = payload.transactionReference;
        if (transactionRef && transactionRef.startsWith('INV-')) {
          const invoiceId = transactionRef.split('-')[1];

          // Log the failed payment
          await supabase.from('payment_attempts').insert({
            invoice_id: invoiceId,
            amount: (payload.instruction?.value?.amount || 0) / 100,
            status: 'failed',
            provider: 'worldpay',
            provider_ref: eventId,
            reason: payload.outcome?.reason || 'Payment refused',
            user_id: payload.metadata?.userId || null,
          });

          console.log(`Payment failed for invoice ${invoiceId}`);
        }
        break;
      }

      case 'refund.requested':
      case 'refund.completed': {
        // Refund processed
        const transactionRef = payload.transactionReference;
        console.log(`Refund ${eventType} for transaction ${transactionRef}`);
        
        // Could update invoice status to 'refunded' or create credit note
        if (transactionRef && transactionRef.startsWith('INV-')) {
          const invoiceId = transactionRef.split('-')[1];
          const refundAmount = (payload.instruction?.value?.amount || 0) / 100;

          // Create credit note for refund
          const { data: invoice } = await supabase
            .from('invoices')
            .select('user_id')
            .eq('id', invoiceId)
            .single();

          if (invoice) {
            await supabase.from('credit_notes').insert({
              invoice_id: invoiceId,
              user_id: invoice.user_id,
              amount: refundAmount,
              reason: `Worldpay refund - ${eventId}`,
            });
          }
        }
        break;
      }

      case 'chargeback.received':
      case 'dispute.opened': {
        // Chargeback/dispute - urgent action needed
        console.log(`URGENT: Chargeback/dispute received - ${eventId}`);
        
        // Log for admin attention
        await supabase.from('audit_logs').insert({
          action: 'chargeback_received',
          entity: 'payment',
          entity_id: payload.transactionReference || eventId,
          metadata: {
            urgent: true,
            eventType,
            payload,
          },
        });
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // Return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true, eventId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook processing error:', error);
    
    // Still return 200 to prevent Worldpay from retrying
    // Log the error for investigation
    return new Response(JSON.stringify({ 
      received: true, 
      error: errorMessage,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
