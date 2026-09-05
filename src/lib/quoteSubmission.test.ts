import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const { invoke, track } = vi.hoisted(() => ({ invoke: vi.fn(), track: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/lib/checkoutTracking', () => ({ getCheckoutTrackingId: () => '11111111-1111-4111-8111-111111111111', clearCheckoutTrackingId: vi.fn(), trackCheckoutEvent: track }));
import { submitQuote, receiptKey } from './quoteSubmission';

describe('quote submission recovery', () => {
  beforeEach(() => { invoke.mockReset(); track.mockReset(); sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
  it('recovers a saved request after a lost response without sending another submission', async () => {
    invoke.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ data: { received: true, reference: 'QR-RECOVER', quote_request_id: 'id' }, error: null });
    const result = await submitQuote('submit-quote-request', { full_name: 'Test Recover' });
    expect(result.data.reference).toBe('QR-RECOVER');
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(['submit-quote-request', 'quote-submission-status']);
    expect(receiptKey('QR-RECOVER')).toBe(invoke.mock.calls[0][1].body.submission_key);
  });
  it('reuses the key on retry and never claims a failed request was saved', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const body = { full_name: 'Test Retry' };
    await expect(submitQuote('submit-quote-request', body)).rejects.toThrow('could not confirm');
    await expect(submitQuote('submit-quote-request', body)).rejects.toThrow('could not confirm');
    expect(invoke.mock.calls[0][1].body.submission_key).toBe(invoke.mock.calls[2][1].body.submission_key);
    expect(body).toEqual({ full_name: 'Test Retry' });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'quote_submission_unconfirmed' }));
  });
  it('supports successful Build Plan submission and keeps customer details out of session storage', async () => {
    invoke.mockResolvedValue({ data: { ok: true, reference: 'QR-BUILD', quote_request_id: 'id' }, error: null });
    await submitQuote('submit-build-plan', { full_name: 'Private Name', email: 'private@example.test', date_of_birth: '1990-01-01' });
    expect(JSON.stringify(sessionStorage)).not.toMatch(/Private Name|private@example|1990-01-01/);
    expect(receiptKey('QR-BUILD')).toBeTruthy();
  });
});
