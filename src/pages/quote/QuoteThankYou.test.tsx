import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { invoke, key } = vi.hoisted(() => ({ invoke: vi.fn(), key: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('@/lib/quoteSubmission', () => ({ receiptKey: key }));
vi.mock('@/components/layout/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/seo', () => ({ SEO: () => null }));
import QuoteThankYou from './QuoteThankYou';

describe('quote confirmation', () => {
  beforeEach(() => { invoke.mockReset(); key.mockReset(); });
  it('does not claim receipt when the thank-you page is opened directly', async () => {
    key.mockReturnValue(null);
    render(<MemoryRouter initialEntries={['/quote/thank-you?ref=QR-INVENTED']}><QuoteThankYou /></MemoryRouter>);
    expect(await screen.findByText('We cannot verify this request from this page')).toBeInTheDocument();
    expect(screen.queryByText(/Thanks — we've got it/)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('requires a server receipt matching the displayed reference', async () => {
    key.mockReturnValue('private-key');
    invoke.mockResolvedValue({ data: { received: true, reference: 'QR-OTHER' }, error: null });
    render(<MemoryRouter initialEntries={['/quote/thank-you?ref=QR-SAVED']}><QuoteThankYou /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('We cannot verify this request from this page')).toBeInTheDocument());
    expect(screen.queryByText(/Thanks — we've got it/)).toBeNull();
  });
  it('shows success only after the server verifies the saved reference', async () => {
    key.mockReturnValue('private-key');
    invoke.mockResolvedValue({ data: { received: true, reference: 'QR-SAVED' }, error: null });
    render(<MemoryRouter initialEntries={['/quote/thank-you?ref=QR-SAVED']}><QuoteThankYou /></MemoryRouter>);
    expect(await screen.findByText(/Thanks — we've got it/)).toBeInTheDocument();
  });
});
