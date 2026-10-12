import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { outreachTable, pct, type OutreachCampaign, type OutreachEvent, type OutreachStats } from "@/lib/outreach/api";
import { CampaignStatusBadge, Section, StatTile } from "./shared";

const EVENT_LABELS: Record<string, string> = {
  sent: "Sent", delivered: "Delivered", delivery_delayed: "Delivery delayed", open: "Opened", click: "Clicked",
  bounce: "Bounced", complaint: "Marked as spam", unsubscribe: "Unsubscribed", failed: "Failed", suppressed: "Skipped (do not contact)",
  converted: "Enquiry received", replied: "Replied", test_sent: "Test sent", queued: "Queued",
};

export function OutreachDashboard({ onOpenCampaign }: { onOpenCampaign: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [stats, setStats] = useState<OutreachStats[]>([]);
  const [events, setEvents] = useState<(OutreachEvent & { email?: string | null })[]>([]);
  const [pool, setPool] = useState({ total: 0, eligible: 0, suppressed: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, e, total, eligible, suppressed] = await Promise.all([
      outreachTable("outreach_campaigns").select("*").order("created_at", { ascending: false }).limit(200),
      outreachTable("outreach_campaign_stats").select("*"),
      outreachTable("outreach_events").select("*").neq("event_type", "test_sent").order("occurred_at", { ascending: false }).limit(40),
      outreachTable("outreach_contacts").select("id", { count: "exact", head: true }),
      outreachTable("outreach_contacts").select("id", { count: "exact", head: true }).eq("eligible", true),
      outreachTable("outreach_suppressions").select("email", { count: "exact", head: true }),
    ]);
    setCampaigns((c.data ?? []) as unknown as OutreachCampaign[]);
    setStats((s.data ?? []) as unknown as OutreachStats[]);
    const evs = (e.data ?? []) as unknown as OutreachEvent[];
    const ids = [...new Set(evs.map((x) => x.message_id).filter(Boolean))] as string[];
    const emailById = new Map<string, string>();
    if (ids.length) {
      const { data: msgs } = await outreachTable("outreach_messages").select("id, email").in("id", ids);
      for (const m of (msgs ?? []) as unknown as { id: string; email: string }[]) emailById.set(m.id, m.email);
    }
    setEvents(evs.map((x) => ({ ...x, email: x.message_id ? emailById.get(x.message_id) ?? null : null })));
    setPool({ total: total.count ?? 0, eligible: eligible.count ?? 0, suppressed: suppressed.count ?? 0 });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const statsById = useMemo(() => new Map(stats.map((s) => [s.campaign_id, s])), [stats]);
  const totals = useMemo(() => stats.reduce((a, s) => ({
    sent: a.sent + s.sent, delivered: a.delivered + s.delivered, opened: a.opened + s.opened, clicked: a.clicked + s.clicked,
    replied: a.replied + s.replied, converted: a.converted + s.converted, unsubscribed: a.unsubscribed + s.unsubscribed,
    bounced: a.bounced + s.bounced, complained: a.complained + s.complained, pending: a.pending + s.pending,
  }), { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, converted: 0, unsubscribed: 0, bounced: 0, complained: 0, pending: 0 }), [stats]);
  const campaignName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);

  const bounceRate = totals.sent ? totals.bounced / totals.sent : 0;
  const complaintRate = totals.sent ? totals.complained / totals.sent : 0;

  const funnel = [
    { label: "Sent", value: totals.sent },
    { label: "Delivered", value: totals.delivered },
    { label: "Opened", value: totals.opened },
    { label: "Clicked", value: totals.clicked },
    { label: "Enquiries", value: totals.converted },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} aria-label="Refresh dashboard">
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Emails sent" value={totals.sent} sub={totals.pending ? `${totals.pending} waiting to send` : "All caught up"} />
        <StatTile label="Open rate" value={pct(totals.opened, totals.sent)} sub={`${totals.opened} opened · Apple Mail can inflate this`} />
        <StatTile label="Click rate" value={pct(totals.clicked, totals.sent)} sub={`${totals.clicked} clicked`} tone={totals.clicked ? "good" : "default"} />
        <StatTile label="Enquiries" value={totals.converted} sub={`${totals.replied} replies marked`} tone={totals.converted ? "good" : "default"} />
        <StatTile label="Delivered" value={pct(totals.delivered, totals.sent)} sub="Needs the Resend webhook" />
        <StatTile label="Bounce rate" value={pct(totals.bounced, totals.sent)} sub="Keep under 2%" tone={bounceRate > 0.02 ? "bad" : "default"} />
        <StatTile label="Spam complaints" value={pct(totals.complained, totals.sent)} sub="Keep under 0.1%" tone={complaintRate > 0.001 ? "bad" : "default"} />
        <StatTile label="Contacts you can email" value={pool.eligible} sub={`${pool.total} contacts · ${pool.suppressed} do not contact`} />
      </div>

      <Section title="Funnel">
        <div className="space-y-2">
          {funnel.map((f) => (
            <div key={f.label} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm">
              <div className="font-semibold">{f.label}</div>
              <div className="h-6 bg-muted border-2 border-foreground">
                <div className="h-full bg-primary" style={{ width: totals.sent ? `${Math.max(2, (f.value / totals.sent) * 100)}%` : "0%" }} />
              </div>
              <div className="text-right tabular-nums">{f.value} <span className="text-muted-foreground">{f.label === "Sent" ? "" : pct(f.value, totals.sent)}</span></div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Section title="Campaigns">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Enquiries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No campaigns yet.</TableCell></TableRow>
                  )}
                  {campaigns.slice(0, 15).map((c) => {
                    const s = statsById.get(c.id);
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpenCampaign(c.id)}>
                        <TableCell className="font-semibold">{c.name}</TableCell>
                        <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{s?.sent ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s?.opened ?? 0, s?.sent ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s?.clicked ?? 0, s?.sent ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{s?.converted ?? 0}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Live activity">
            <ul className="space-y-2 text-sm max-h-[420px] overflow-y-auto">
              {events.length === 0 && <li className="text-muted-foreground">Nothing yet.</li>}
              {events.map((e) => (
                <li key={e.id} className="border-l-4 border-primary pl-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{EVENT_LABELS[e.event_type] ?? e.event_type}{e.suspected_bot ? " (filter scan)" : ""}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(e.occurred_at), "dd MMM HH:mm")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.email ?? "—"}{e.campaign_id ? ` · ${campaignName.get(e.campaign_id) ?? ""}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
