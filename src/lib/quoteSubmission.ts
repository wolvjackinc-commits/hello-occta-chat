import { supabase } from '@/integrations/supabase/client';
import { clearCheckoutTrackingId, getCheckoutTrackingId, trackCheckoutEvent } from '@/lib/checkoutTracking';

const pending = new Map<string, string>();
const receipts = new Map<string, string>();

export function receiptKey(reference: string): string | null {
  try { return sessionStorage.getItem(`quote-receipt:${reference}`) ?? receipts.get(reference) ?? null; }
  catch { return receipts.get(reference) ?? null; }
}

export async function submitQuote(endpoint: 'submit-quote-request' | 'submit-build-plan', body: Record<string, unknown>) {
  const fingerprintBody = { ...body };
  for (const field of ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'landing_page', 'conversion_page']) delete fingerprintBody[field];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([endpoint, fingerprintBody])));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let key = pending.get(fingerprint);
  try { key ??= sessionStorage.getItem(`quote-pending:${fingerprint}`) ?? undefined; } catch { key = pending.get(fingerprint); }
  key ??= crypto.randomUUID();
  pending.set(fingerprint, key);
  try { sessionStorage.setItem(`quote-pending:${fingerprint}`, key); } catch { pending.set(fingerprint, key); }
  const trackingId = getCheckoutTrackingId();
  const response = await supabase.functions.invoke(endpoint, { body: { ...body, submission_key: key, tracking_client_id: trackingId } })
    .catch((error: unknown) => ({ data: null, error }));
  let data = response.data;
  if (response.error || !data?.ok || !data?.reference || !data?.quote_request_id) {
    const recovered = await supabase.functions.invoke('quote-submission-status', { body: { submission_key: key } })
      .catch((error: unknown) => ({ data: null, error }));
    if (!recovered.error && recovered.data?.received && recovered.data?.reference && recovered.data?.quote_request_id) {
      data = { ...recovered.data, ok: true, mode: 'quote_only', recovered: true };
    } else {
      void trackCheckoutEvent({ eventType: 'error', route: '/quote/start', stage: 'quote_start', errorCode: 'quote_submission_unconfirmed', errorMessage: 'Submission not confirmed; retry with the same key', metadata: { endpoint } });
      throw new Error('We could not confirm your request. Your entries are still here. Please retry; the same request will not be saved twice.');
    }
  }
  receipts.set(data.reference, key);
  try { sessionStorage.setItem(`quote-receipt:${data.reference}`, key); } catch { receipts.set(data.reference, key); }
  clearCheckoutTrackingId();
  return { data, error: null };
}
