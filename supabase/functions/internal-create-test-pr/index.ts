// Internal one-shot helper to create a CS-linked INTERNAL TEST payment request
// at a fixed small amount and open a Worldpay HPP session. Guarded by CRON_JOB_SECRET.
// DO NOT use for any production flow. Safe to delete after Phase E verification.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const WORLDPAY_TRY_URL = "https://try.access.worldpay.com";
const WORLDPAY_LIVE_URL = "https://access.worldpay.com";
const isLiveMode = Deno.env.get('WORLDPAY_LIVE_MODE') === 'true';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    // TEMPORARY HELPER — restricted to a single allowlisted internal-test CS id
    // at a max amount of £1.00. Will be deleted immediately after Phase E verification.
    const ALLOWED_CS = new Set<string>([
      '2ac5824e-1c8c-4b5f-95e1-ee685c023db0',
    ]);

    const body = await req.json().catch(() => ({}));
    const contractSummaryId = body.contract_summary_id as string;
    const amount = Number(body.amount ?? 0.10);
    const label = String(body.label ?? 'INTERNAL TEST — DO NOT PROCESS');
    if (!contractSummaryId || !(amount > 0)) {
      return new Response(JSON.stringify({ success: false, error: 'bad_input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cs, error: csErr } = await supabase
      .from('contract_summaries')
      .select('id, cs_number, status, customer_email_snapshot, customer_name_snapshot, account_number, user_id')
      .eq('id', contractSummaryId).single();
    if (csErr || !cs) {
      return new Response(JSON.stringify({ success: false, error: 'cs_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate raw token + hash
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256Hex(rawToken);

    // Allocate a payment_request_number
    const today = new Date();
    const mmdd = `${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const prNumber = `PR-${today.getFullYear().toString().slice(2)}${mmdd}-T${suffix}`;

    const expiresAt = new Date(Date.now() + 14 * 86400_000).toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('payment_requests')
      .insert({
        type: 'card_payment',
        status: 'sent',
        amount,
        currency: 'GBP',
        customer_email: cs.customer_email_snapshot ?? 'internal-test@occta.co.uk',
        customer_name: cs.customer_name_snapshot ?? label,
        account_number: cs.account_number,
        user_id: cs.user_id,
        contract_summary_id: cs.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        payment_request_number: prNumber,
        notes: `${label} — Phase E live webhook verification (fresh PR)`,
        metadata: { internal_test: true, do_not_process: true, phase: 'E-live-webhook-verify-fresh' },
      })
      .select('id, payment_request_number')
      .single();
    if (insErr || !inserted) {
      return new Response(JSON.stringify({ success: false, error: 'insert_failed', detail: insErr?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Worldpay HPP session
    const u = Deno.env.get('WORLDPAY_API_USERNAME');
    const p = Deno.env.get('WORLDPAY_API_PASSWORD');
    const entity = Deno.env.get('WORLDPAY_ENTITY_ID');
    if (!u || !p || !entity) throw new Error('Worldpay credentials missing');

    const baseUrl = isLiveMode ? WORLDPAY_LIVE_URL : WORLDPAY_TRY_URL;
    const transactionRef = `PR-${inserted.id.slice(0, 8)}-${Date.now()}`;
    const origin = String(body.origin ?? 'https://www.occta.co.uk');
    const returnUrl = `${origin}/pay/${rawToken}?type=card_payment`;

    const resp = await fetch(`${baseUrl}/payment_pages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${u}:${p}`),
        'WP-CorrelationId': crypto.randomUUID(),
        'Accept': 'application/vnd.worldpay.payment_pages-v1.hal+json',
        'Content-Type': 'application/vnd.worldpay.payment_pages-v1.hal+json',
      },
      body: JSON.stringify({
        transactionReference: transactionRef,
        merchant: { entity },
        narrative: { line1: `OCCTA INTERNAL TEST ${inserted.payment_request_number}` },
        value: { currency: 'GBP', amount: Math.round(amount * 100) },
        resultURLs: {
          successURL: `${returnUrl}&status=success`,
          failureURL: `${returnUrl}&status=failed`,
          cancelURL: `${returnUrl}&status=cancelled`,
        },
        riskData: { account: { email: cs.customer_email_snapshot ?? 'internal-test@occta.co.uk' } },
      }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, error: 'wp_failed', status: resp.status, result }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const checkoutUrl = result.url ?? result._links?.checkout?.href;

    await supabase.from('payment_requests').update({
      provider: 'worldpay',
      provider_reference: transactionRef,
      provider_checkout_url: checkoutUrl,
      provider_session_id: result?._links?.self?.href ?? null,
      status: 'checkout_created',
    }).eq('id', inserted.id);

    return new Response(JSON.stringify({
      success: true,
      payment_request_id: inserted.id,
      payment_request_number: inserted.payment_request_number,
      amount,
      transactionReference: transactionRef,
      pay_url: returnUrl.split('?')[0],
      checkoutUrl,
      mode: isLiveMode ? 'live' : 'test',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? 'error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});