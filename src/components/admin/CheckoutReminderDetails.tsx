import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { dbErrorText } from '@/lib/dbErrorText';
import { emailPreviewDocument } from '@/lib/journey/emailPreview';

type EmailAttempt = {
  id: string; recipient: string; subject: string | null; body_html: string | null;
  status: string; sent_at: string | null; delivered_at: string | null;
  opened_at: string | null; last_opened_at: string | null; open_count: number | null;
  error: string | null; created_at: string;
};
type Inspection = {
  inactivity_minutes: number;
  attribution: { utm_source?: string; utm_medium?: string; utm_campaign?: string; google_click_recorded?: boolean };
  reminders: Array<{
    id: string; number: number; subject: string; status: string; queued_at: string;
    worker_sent_at: string | null; failed_at: string | null; error: string | null; attempts: EmailAttempt[];
  }>;
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' }) : 'Not recorded';
}

export default function CheckoutReminderDetails({ source, sessionId }: { source: 'journey2' | 'web'; sessionId: string }) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInspection(null);
    void (async () => {
      try {
        const result = await supabase.rpc('admin_checkout_inspection', { _source: source, _session_id: sessionId });
        if (result.error) throw result.error;
        if (!result.data) throw new Error('No inspection details were returned.');
        if (!cancelled) setInspection(result.data as unknown as Inspection);
      } catch (failure) {
        if (!cancelled) setError(dbErrorText(failure, 'Could not load reminder and source details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [source, sessionId, revision]);

  return <section className="xl:col-span-2 space-y-4 text-sm" aria-label="Traffic source and reminder emails">
    <div className="flex justify-between gap-3 items-center">
      <h3 className="font-display uppercase tracking-wider">Traffic source & reminder emails</h3>
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh details</Button>
    </div>
    {loading && <p role="status">Loading reminder and source details…</p>}
    {error && <div role="alert" className="border-2 border-destructive p-3"><p>{error}</p><Button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</Button></div>}
    {inspection && <>
      <p>Abandoned means no recorded activity for at least {inspection.inactivity_minutes} minutes when the inactivity check ran. It does not establish why a visitor left or whether they intend to return.</p>
      <dl className="grid grid-cols-[140px_1fr] gap-2 text-xs">
        <dt>Campaign source</dt><dd>{inspection.attribution.utm_source || 'Not recorded — direct traffic or an untagged referral cannot be distinguished'}</dd>
        <dt>Medium</dt><dd>{inspection.attribution.utm_medium || 'Not recorded'}</dd>
        <dt>Campaign</dt><dd>{inspection.attribution.utm_campaign || 'Not recorded'}</dd>
        <dt>Google ad click</dt><dd>{inspection.attribution.google_click_recorded ? 'Click identifier recorded' : 'Not recorded'}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Campaign tags describe recorded attribution, not verified customer identity. All times are Europe/London. An open event is a tracking signal, not proof the email was read; missing events do not mean unread.</p>
      {inspection.reminders.length === 0 && <p>No reminder attempts recorded for this session.{source === 'web' ? ' Anonymous web tracking does not collect an email address for reminders.' : ''}</p>}
      {inspection.reminders.map((reminder) => <article key={reminder.id} className="border-2 border-border p-3 space-y-3">
        <h4 className="font-semibold">Reminder {reminder.number}: {reminder.subject}</h4>
        <p>Worker status: {reminder.status} · Queued: {date(reminder.queued_at)}</p>
        {reminder.worker_sent_at && <p>Worker marked sent: {date(reminder.worker_sent_at)} (not a delivery confirmation)</p>}
        {reminder.failed_at && <p>Failed: {date(reminder.failed_at)}</p>}
        {reminder.error && <p className="text-destructive">{dbErrorText({ message: reminder.error }, 'Reminder failed')}</p>}
        {reminder.attempts.length === 0 && <p>No email log is linked to this reminder. Its content, delivery and open history are unavailable.</p>}
        {reminder.attempts.map((attempt) => <div key={attempt.id} className="border-t border-border pt-3 space-y-2">
          <p>To: {attempt.recipient} · Email status: {attempt.status}</p>
          <p className="font-semibold">{attempt.subject || reminder.subject}</p>
          <dl className="grid grid-cols-[140px_1fr] gap-2 text-xs">
            <dt>Attempt logged</dt><dd>{date(attempt.created_at)}</dd>
            <dt>Sent</dt><dd>{date(attempt.sent_at)}</dd>
            <dt>Delivered</dt><dd>{date(attempt.delivered_at)}</dd>
            <dt>First open event</dt><dd>{date(attempt.opened_at)}</dd>
            <dt>Latest open event</dt><dd>{date(attempt.last_opened_at)}</dd>
            <dt>Open events</dt><dd>{attempt.open_count ?? 0}</dd>
          </dl>
          {attempt.error && <p className="text-destructive">{dbErrorText({ message: attempt.error }, 'Email failed')}</p>}
          {attempt.body_html ? <details><summary className="cursor-pointer font-semibold">View saved email content</summary>
            <p className="text-xs my-2">Images, links and tracking requests are disabled in this preview.</p>
            <iframe title={`Reminder ${reminder.number} email ${attempt.id}`} sandbox="" referrerPolicy="no-referrer" srcDoc={emailPreviewDocument(attempt.body_html)} className="w-full h-[520px] bg-white border" />
          </details> : <p className="text-muted-foreground">The sent email body was not saved. The original content cannot be reconstructed reliably from the current template.</p>}
        </div>)}
      </article>)}
    </>}
  </section>;
}
