type SubmissionClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export async function submissionHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function saveQuoteSubmission(client: SubmissionClient, endpoint: string, input: Record<string, unknown>, payload: Record<string, unknown>) {
  const { submission_key, tracking_client_id, ...businessInput } = input;
  const identity = typeof submission_key === 'string' ? submission_key : crypto.randomUUID();
  const fingerprintInput = { ...businessInput };
  for (const field of ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'landing_page', 'conversion_page']) delete fingerprintInput[field];
  const result = await client.rpc('save_quote_submission', {
    _key_hash: await submissionHash(identity),
    _fingerprint: await submissionHash(JSON.stringify([endpoint, fingerprintInput])),
    _payload: payload,
    _client_hash: typeof tracking_client_id === 'string' ? await submissionHash(tracking_client_id) : null,
  });
  if (result.error) {
    await client.rpc('log_event', {
      _actor_type: 'system', _event_type: 'quote_submission_failed',
      _title: 'Quote submission could not be saved', _source_module: 'quote',
      _severity: 'error', _details: { endpoint, retry_safe: true },
    });
    return { data: null, error: result.error };
  }
  return { data: result.data as { id: string; reference: string; replayed: boolean }, error: null };
}
