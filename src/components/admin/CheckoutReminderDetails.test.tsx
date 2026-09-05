import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutReminderDetails from './CheckoutReminderDetails';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

const inspection = {
  inactivity_minutes: 60, attribution: {},
  reminders: [{ id: 'reminder', number: 1, subject: 'Saved order', status: 'sent', queued_at: '2026-09-01T10:00:00Z', worker_sent_at: '2026-09-01T10:01:00Z', failed_at: null, error: null,
    attempts: [{ id: 'email', recipient: 'customer@example.test', subject: 'Saved order', body_html: null, status: 'sent', sent_at: '2026-09-01T10:01:00Z', delivered_at: null, opened_at: null, last_opened_at: null, open_count: 0, error: null, created_at: '2026-09-01T10:00:00Z' }] }],
};

describe('reminder inspection', () => {
  beforeEach(() => rpc.mockReset());
  it('does not invent a saved body or delivery/open confirmation', async () => {
    rpc.mockResolvedValue({ data: inspection, error: null });
    render(<CheckoutReminderDetails source="journey2" sessionId="session" />);
    expect(await screen.findByText(/The sent email body was not saved/)).toBeInTheDocument();
    expect(screen.getByText(/not a delivery confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/missing events do not mean unread/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('admin_checkout_inspection', { _source: 'journey2', _session_id: 'session' });
  });
  it('shows permission failures and retries without claiming no reminders', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'staff access required' } }).mockResolvedValue({ data: { ...inspection, reminders: [] }, error: null });
    render(<CheckoutReminderDetails source="journey2" sessionId="session" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('staff access required');
    expect(screen.queryByText(/No reminder attempts/)).toBeNull();
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByText(/No reminder attempts/)).toBeInTheDocument());
  });
});
