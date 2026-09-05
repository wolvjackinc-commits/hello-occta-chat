import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from '../_shared/quoteHelpers.ts';
import { submissionHash } from '../_shared/quoteSubmission.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  let body: { submission_key?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  if (typeof body?.submission_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submission_key)) return jsonResponse({ error: 'invalid_receipt' }, 400);
  if (!(await checkRateLimit(getRequestIp(req) ?? 'noip', 'quote_receipt', 30, 60))) return jsonResponse({ error: 'rate_limited' }, 429);
  const client = getServiceClient();
  const { data, error } = await client.from('quote_submission_receipts')
    .select('quote_request_id, request:quote_requests(reference)')
    .eq('key_hash', await submissionHash(body.submission_key)).maybeSingle();
  if (error) return jsonResponse({ error: 'verification_unavailable' }, 503);
  if (!data) return jsonResponse({ received: false });
  const request = data.request as unknown as { reference: string };
  return jsonResponse({ received: true, reference: request.reference, quote_request_id: data.quote_request_id });
});
