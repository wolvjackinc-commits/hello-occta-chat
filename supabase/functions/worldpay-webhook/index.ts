import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wp-signature',
};

// Verify webhook signature using HMAC-SHA256
async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('WORLDPAY_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the raw body for signature verification
    const body = await req.text();
    
    // SECURITY: Verify webhook signature - REQUIRED
    const signature = req.headers.get('x-wp-signature') || req.headers.get('X-WP-Signature');
    
    // SECURITY: Fail closed - reject webhooks if secret is not configured
    if (!webhookSecret) {
      console.error('SECURITY ERROR: WORLDPAY_WEBHOOK_SECRET not configured - rejecting webhook');
      
      await supabase.from('audit_logs').insert({
        action: 'worldpay_webhook_missing_secret',
        entity: 'payment',
        entity_id: null,
        metadata: {
          error: 'Webhook secret not configured',
          timestamp: new Date().toISOString(),
        },
      });
      
      return new Response(JSON.stringify({ error: 'Webhook configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const isValid = await verifySignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature - rejecting request');
      
      // Log the failed attempt
      await supabase.from('audit_logs').insert({
        action: 'worldpay_webhook_invalid_signature',
        entity: 'payment',
        entity_id: null,
        metadata: {
          hasSignature: !!signature,
          timestamp: new Date().toISOString(),
        },
      });
      
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Webhook signature verified successfully');

    const payload = JSON.parse(body);

    console.log('Worldpay webhook received:', JSON.stringify(payload, null, 2));

    // Extract event type and data
    const eventType = payload.eventType || payload.type;
    const eventId = payload.eventId || payload.id;
    const eventTimestamp = payload.eventTimestamp || new Date().toISOString();

    // Validate required fields
    if (!eventType || !eventId) {
      console.error('Missing required fields in webhook payload');
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the webhook event
    await supabase.from('audit_logs').insert({
      action: 'worldpay_webhook',
      entity: 'payment',
      entity_id: payload.transactionReference || eventId,
      metadata: {
        eventType,
        eventId,
        eventTimestamp,
        signatureVerified: !!webhookSecret,
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
        
        // Handle INV- references (direct invoice payments)
        if (transactionRef && transactionRef.startsWith('INV-')) {
          const invoiceId = transactionRef.split('-')[1];
          
          // Validate UUID format before updating
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(invoiceId)) {
            console.error('Invalid invoice ID format:', invoiceId);
            break;
          }
          
          // Update invoice status
          await supabase
            .from('invoices')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', invoiceId);

          console.log(`Invoice ${invoiceId} marked as paid via webhook`);
        }
        
        // Handle PR- references (payment request flow) - backup mechanism
        if (transactionRef && transactionRef.startsWith('PR-')) {
          const prIdPrefix = transactionRef.split('-')[1]; // e.g., "d9ac4843" from "PR-d9ac4843-1738..."
          console.log(`Processing payment request webhook for PR prefix: ${prIdPrefix}`);
          
          // Find payment request by provider_reference
          const { data: paymentRequest, error: prError } = await supabase
            .from('payment_requests')
            .select('id, invoice_id, user_id, amount, status, customer_name, customer_email')
            .eq('provider_reference', transactionRef)
            .single();
          
          if (prError || !paymentRequest) {
            console.log('Payment request not found by exact ref, trying prefix match');
            // Try prefix match as fallback
            const { data: prByPrefix } = await supabase
              .from('payment_requests')
              .select('id, invoice_id, user_id, amount, status, customer_name, customer_email')
              .like('provider_reference', `PR-${prIdPrefix}%`)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (!prByPrefix) {
              console.error('Could not find payment request for transaction:', transactionRef);
              break;
            }
            
            // Use the found request
            await processPaymentRequestWebhook(supabase, prByPrefix, eventId, payload);
          } else {
            // Already completed? Skip to avoid duplicates
            if (paymentRequest.status === 'completed') {
              console.log(`Payment request ${paymentRequest.id} already completed, skipping`);
              break;
            }
            
            await processPaymentRequestWebhook(supabase, paymentRequest, eventId, payload);
          }
        }
        break;
      }

      case 'payment.failed':
      case 'payment.refused': {
        // Payment failed
        const transactionRef = payload.transactionReference;
        if (transactionRef && transactionRef.startsWith('INV-')) {
          const invoiceId = transactionRef.split('-')[1];

          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(invoiceId)) {
            console.error('Invalid invoice ID format:', invoiceId);
            break;
          }

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
        
        // Handle PR- references for failed payments
        if (transactionRef && transactionRef.startsWith('PR-')) {
          const { data: paymentRequest } = await supabase
            .from('payment_requests')
            .select('id, invoice_id, user_id, amount, status')
            .eq('provider_reference', transactionRef)
            .single();
          
          if (paymentRequest && paymentRequest.status !== 'failed') {
            await supabase
              .from('payment_requests')
              .update({ status: 'failed', updated_at: new Date().toISOString() })
              .eq('id', paymentRequest.id);
            
            // Log failed attempt
            await supabase.from('payment_attempts').insert({
              invoice_id: paymentRequest.invoice_id,
              user_id: paymentRequest.user_id,
              amount: paymentRequest.amount || 0,
              status: 'failed',
              provider: 'worldpay_webhook',
              provider_ref: eventId,
              reason: payload.outcome?.reason || 'Payment refused',
            });
            
            console.log(`Payment request ${paymentRequest.id} marked as failed via webhook`);
          }
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
          
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(invoiceId)) {
            console.error('Invalid invoice ID format:', invoiceId);
            break;
          }
          
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

// Helper function to process payment request webhooks
async function processPaymentRequestWebhook(
  supabase: any,
  paymentRequest: {
    id: string;
    invoice_id: string | null;
    user_id: string | null;
    amount: number | null;
    customer_name: string;
    customer_email: string;
  },
  eventId: string,
  payload: any
) {
  console.log(`Processing webhook for payment request: ${paymentRequest.id}`);
  
  // Mark payment request as completed
  await supabase
    .from('payment_requests')
    .update({ 
      status: 'completed', 
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentRequest.id);
  
  // Update payment attempt to success
  await supabase
    .from('payment_attempts')
    .update({ status: 'success' })
    .eq('provider_ref', payload.transactionReference)
    .eq('status', 'pending');
  
  // If there's a linked invoice, mark it as paid and create receipt
  if (paymentRequest.invoice_id) {
    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', paymentRequest.invoice_id);
    
    // Create receipt
    const receiptRef = `RCP-WH-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from('receipts').insert({
      invoice_id: paymentRequest.invoice_id,
      user_id: paymentRequest.user_id,
      amount: paymentRequest.amount || 0,
      method: 'card',
      reference: receiptRef,
      paid_at: new Date().toISOString(),
    });
    
    console.log(`Created receipt ${receiptRef} for invoice via webhook`);
  }
  
  // Log event
  await supabase.from('payment_request_events').insert({
    request_id: paymentRequest.id,
    event_type: 'completed_via_webhook',
    metadata: { worldpay_event_id: eventId },
  });
  
  // Audit log
  await supabase.from('audit_logs').insert({
    action: 'payment_received_webhook',
    entity: 'payment_request',
    entity_id: paymentRequest.id,
    metadata: {
      invoice_id: paymentRequest.invoice_id,
      amount: paymentRequest.amount,
      worldpay_event_id: eventId,
    },
  });
  
  console.log(`Payment request ${paymentRequest.id} completed via webhook`);
}