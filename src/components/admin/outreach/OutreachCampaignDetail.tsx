import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Eye, Pause, Play, RefreshCw, Rocket, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  outreachAction, outreachTable, pct,
  type OutreachAudience, type OutreachCampaign, type OutreachEvent, type OutreachMessage, type OutreachSettings, type OutreachStats,
} from "@/lib/outreach/api";
import { downloadText, toCsv } from "@/lib/outreach/csv";
import { CampaignStatusBadge, MessageStatusBadge, Section, StatTile } from "./shared";

type AudiencePreview = {
  count: number;
  excluded_suppressed: number;
  excluded_recent: number;
  truncated: boolean;
  sample: { id: string; email: string; business_name: string; category: string | null; district: string | null; priority: string | null }[];
};

type Preview = { subject: string; html: string; text: string; from: string; reply_to: string; problems: string[] };

const CONTENT_FIELDS = ["subject", "preheader", "body_html", "body_text", "cta_label", "cta_path", "hero_image_url", "flyer_ref"] as const;

export function OutreachCampaignDetail({ campaignId, settings, onClose, onChanged }: {
  campaignId: string;
  settings: OutreachSettings | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<OutreachCampaign | null>(null);
  const [draft, setDraft] = useState<Partial<OutreachCampaign>>({});
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [audience, setAudience] = useState<OutreachAudience>({});
  const [districtsText, setDistrictsText] = useState("");
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testTo, setTestTo] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmLaunch, setConfirmLaunch] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [recipientFilter, setRecipientFilter] = useState("all");

  const isDraft = campaign?.status === "draft";

  const load = useCallback(async () => {
    const [c, s, m, e] = await Promise.all([
      outreachTable("outreach_campaigns").select("*").eq("id", campaignId).maybeSingle(),
      outreachTable("outreach_campaign_stats").select("*").eq("campaign_id", campaignId).maybeSingle(),
      outreachTable("outreach_messages").select("*").eq("campaign_id", campaignId).order("created_at").limit(2000),
      outreachTable("outreach_events").select("*").eq("campaign_id", campaignId).order("occurred_at", { ascending: false }).limit(200),
    ]);
    const camp = (c.data ?? null) as unknown as OutreachCampaign | null;
    setCampaign(camp);
    if (camp) {
      setDraft(Object.fromEntries(CONTENT_FIELDS.map((k) => [k, camp[k] ?? ""])) as Partial<OutreachCampaign>);
      setAudience(camp.audience ?? {});
      setDistrictsText((camp.audience?.districts ?? []).join(", "));
    }
    setStats((s.data ?? null) as unknown as OutreachStats | null);
    setMessages((m.data ?? []) as unknown as OutreachMessage[]);
    setEvents((e.data ?? []) as unknown as OutreachEvent[]);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    (async () => {
      const { data } = await outreachTable("outreach_contacts").select("category").eq("eligible", true).limit(5000);
      const set = new Set<string>();
      for (const r of (data ?? []) as unknown as { category: string | null }[]) if (r.category) set.add(r.category);
      setCategories([...set].sort());
      const { data: u } = await supabase.auth.getUser();
      setTestTo(u.user?.email ?? "");
    })();
  }, []);
  useEffect(() => {
    if (!campaign || isDraft) return;
    const t = window.setInterval(load, 20_000);
    return () => window.clearInterval(t);
  }, [campaign, isDraft, load]);

  const run = async <T,>(key: string, fn: () => Promise<T>, success?: string): Promise<T | null> => {
    setBusy(key);
    try {
      const r = await fn();
      if (success) toast({ title: success });
      return r;
    } catch (e) {
      toast({ title: "Something went wrong", description: (e as Error).message, variant: "destructive" });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const normalisedAudience = (): OutreachAudience => ({
    categories: audience.categories ?? [],
    priorities: audience.priorities ?? [],
    districts: districtsText.split(/[,\s]+/).map((d) => d.trim().toUpperCase()).filter(Boolean),
  });

  const saveDraft = () => run("save", async () => {
    const { error } = await outreachTable("outreach_campaigns")
      .update({ ...draft, flyer_ref: draft.flyer_ref ? String(draft.flyer_ref).toUpperCase() : null, hero_image_url: draft.hero_image_url || null, audience: normalisedAudience() } as never)
      .eq("id", campaignId);
    if (error) throw new Error(error.message);
    setAudiencePreview(null);
    await load();
    onChanged();
  }, "Draft saved");

  const checkAudience = () => run("audience", async () => {
    const r = await outreachAction<AudiencePreview>("audience_preview", { audience: normalisedAudience() });
    setAudiencePreview(r);
  });

  const showPreview = () => run("preview", async () => {
    await saveDraftSilently();
    setPreview(await outreachAction<Preview>("preview", { campaign_id: campaignId }));
  });

  const saveDraftSilently = async () => {
    if (!isDraft) return;
    const { error } = await outreachTable("outreach_campaigns")
      .update({ ...draft, flyer_ref: draft.flyer_ref ? String(draft.flyer_ref).toUpperCase() : null, hero_image_url: draft.hero_image_url || null, audience: normalisedAudience() } as never)
      .eq("id", campaignId);
    if (error) throw new Error(error.message);
  };

  const testSend = () => run("test", async () => {
    await saveDraftSilently();
    await outreachAction("test_send", { campaign_id: campaignId, to: testTo });
  }, `Test sent to ${testTo}`);

  const openLaunch = () => run("prelaunch", async () => {
    await saveDraftSilently();
    const r = await outreachAction<AudiencePreview>("audience_preview", { audience: normalisedAudience() });
    setAudiencePreview(r);
    if (!r.count) throw new Error("No eligible recipients match this audience.");
    setConfirmLaunch(true);
  });

  const launch = () => run("launch", async () => {
    const r = await outreachAction<{ queued: number; status: string; sending_enabled: boolean }>("launch", {
      campaign_id: campaignId,
      expected_count: audiencePreview?.count,
      scheduled_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
    });
    setConfirmLaunch(false);
    await load();
    onChanged();
    toast({
      title: r.status === "scheduled" ? `Scheduled ${r.queued} emails` : `Launched — ${r.queued} emails queued`,
      description: r.sending_enabled ? "They go out in batches within your sending window and daily limit." : "Sending is switched off in Settings, so nothing goes out until you switch it on.",
    });
  });

  const control = (action: "pause" | "resume" | "cancel") => run(action, async () => {
    await outreachAction(action, { campaign_id: campaignId });
    setConfirmCancel(false);
    await load();
    onChanged();
  }, action === "pause" ? "Campaign paused" : action === "resume" ? "Campaign resumed" : "Campaign cancelled");

  const sendNow = () => run("worker", async () => {
    const r = await outreachAction<{ result: { sent: number; skipped?: string } }>("run_worker");
    await load();
    onChanged();
    toast({ title: r.result.skipped ? `Nothing sent: ${r.result.skipped.replace(/_/g, " ")}` : `Sent ${r.result.sent} emails` });
  });

  const markReplied = (id: string) => run("reply", async () => {
    await outreachAction("mark_replied", { message_id: id });
    await load();
  }, "Marked as replied");

  const filteredMessages = useMemo(() => messages.filter((m) => {
    switch (recipientFilter) {
      case "opened": return Boolean(m.first_opened_at);
      case "clicked": return Boolean(m.first_clicked_at);
      case "not_opened": return Boolean(m.sent_at) && !m.first_opened_at;
      case "converted": return Boolean(m.converted_at);
      case "problems": return ["failed", "bounced", "complained", "suppressed"].includes(m.status) || Boolean(m.unsubscribed_at);
      case "pending": return ["queued", "sending"].includes(m.status);
      default: return true;
    }
  }), [messages, recipientFilter]);

  const exportRecipients = () => {
    const rows = [
      ["Business", "Email", "Status", "Sent", "Delivered", "Opened", "Opens", "Clicked", "Clicks", "Replied", "Enquiry", "Unsubscribed", "Error"],
      ...messages.map((m) => [m.business_name, m.email, m.status, m.sent_at, m.delivered_at, m.first_opened_at, m.open_count, m.first_clicked_at, m.click_count, m.replied_at, m.converted_at, m.unsubscribed_at, m.last_error]),
    ];
    downloadText(`${campaign?.slug ?? "campaign"}-recipients.csv`, toCsv(rows));
  };

  if (!campaign) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent><DialogHeader><DialogTitle>Loading campaign…</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  const s = stats;
  const progress = campaign.total_recipients ? Math.round((((s?.total ?? 0) - (s?.pending ?? 0)) / campaign.total_recipients) * 100) : 0;
  const toggle = (key: "categories" | "priorities", value: string, on: boolean) => {
    const current = new Set(audience[key] ?? []);
    if (on) current.add(value); else current.delete(value);
    setAudience({ ...audience, [key]: [...current] });
    setAudiencePreview(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="font-display text-2xl">{campaign.name}</span>
            <CampaignStatusBadge status={campaign.status} />
            {campaign.flyer_ref && <span className="text-xs border-2 border-foreground px-2 py-0.5">REF {campaign.flyer_ref}</span>}
          </DialogTitle>
        </DialogHeader>

        {campaign.paused_reason && campaign.status === "paused" && (
          <div className="border-4 border-amber-600 bg-amber-50 p-3 text-sm">{campaign.paused_reason}</div>
        )}

        {!isDraft && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {["sending", "scheduled"].includes(campaign.status) && (
                <Button variant="outline" onClick={() => control("pause")} disabled={busy !== null}><Pause className="h-4 w-4 mr-1" /> Pause</Button>
              )}
              {campaign.status === "paused" && (
                <Button onClick={() => control("resume")} disabled={busy !== null}><Play className="h-4 w-4 mr-1" /> Resume</Button>
              )}
              {["sending", "scheduled", "paused"].includes(campaign.status) && (
                <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={busy !== null}><XCircle className="h-4 w-4 mr-1" /> Cancel remaining</Button>
              )}
              {campaign.status === "sending" && (
                <Button variant="outline" onClick={sendNow} disabled={busy !== null}><Send className="h-4 w-4 mr-1" /> {busy === "worker" ? "Sending…" : "Send next batch now"}</Button>
              )}
              <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
              <Button variant="outline" onClick={exportRecipients}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{campaign.status === "scheduled" && campaign.scheduled_at ? `Starts ${format(new Date(campaign.scheduled_at), "EEE dd MMM HH:mm")}` : `${(s?.total ?? 0) - (s?.pending ?? 0)} of ${campaign.total_recipients} processed`}</span>
                <span>{s?.pending ?? 0} waiting</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatTile label="Sent" value={s?.sent ?? 0} />
              <StatTile label="Delivered" value={pct(s?.delivered ?? 0, s?.sent ?? 0)} />
              <StatTile label="Opened" value={pct(s?.opened ?? 0, s?.sent ?? 0)} sub={`${s?.opened ?? 0}`} />
              <StatTile label="Clicked" value={pct(s?.clicked ?? 0, s?.sent ?? 0)} sub={`${s?.clicked ?? 0}`} tone={s?.clicked ? "good" : "default"} />
              <StatTile label="Enquiries" value={s?.converted ?? 0} tone={s?.converted ? "good" : "default"} />
              <StatTile label="Replied" value={s?.replied ?? 0} />
              <StatTile label="Unsubscribed" value={s?.unsubscribed ?? 0} />
              <StatTile label="Bounced / spam" value={`${s?.bounced ?? 0} / ${s?.complained ?? 0}`} tone={(s?.bounced ?? 0) + (s?.complained ?? 0) ? "warn" : "default"} />
            </div>
          </div>
        )}

        <Tabs defaultValue={isDraft ? "content" : "recipients"} className="mt-2">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="content">Email</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            {!isDraft && <TabsTrigger value="recipients">Recipients ({messages.length})</TabsTrigger>}
            {!isDraft && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="oc-subject">Subject</Label>
                <Input id="oc-subject" value={draft.subject ?? ""} disabled={!isDraft} maxLength={200} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="oc-pre">Preview text (shown after the subject in the inbox)</Label>
                <Input id="oc-pre" value={draft.preheader ?? ""} disabled={!isDraft} maxLength={200} onChange={(e) => setDraft({ ...draft, preheader: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="oc-cta">Button label</Label>
                <Input id="oc-cta" value={draft.cta_label ?? ""} disabled={!isDraft} maxLength={60} onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="oc-path">Button goes to (page on occta.co.uk)</Label>
                <Input id="oc-path" value={draft.cta_path ?? ""} disabled={!isDraft} placeholder="/business/contact-sales" onChange={(e) => setDraft({ ...draft, cta_path: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="oc-ref">Flyer reference</Label>
                <Input id="oc-ref" value={draft.flyer_ref ?? ""} disabled={!isDraft} placeholder="LAST-A" maxLength={24} onChange={(e) => setDraft({ ...draft, flyer_ref: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label htmlFor="oc-hero">Flyer image URL (optional)</Label>
                <Input id="oc-hero" value={draft.hero_image_url ?? ""} disabled={!isDraft} placeholder="https://www.occta.co.uk/flyers/…" onChange={(e) => setDraft({ ...draft, hero_image_url: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="oc-html">Email body (HTML)</Label>
                <Textarea id="oc-html" rows={12} className="font-mono text-xs" value={draft.body_html ?? ""} disabled={!isDraft} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="oc-text">Plain-text version</Label>
                <Textarea id="oc-text" rows={8} className="font-mono text-xs" value={draft.body_text ?? ""} disabled={!isDraft} onChange={(e) => setDraft({ ...draft, body_text: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">
                  Placeholders: {"{{business_name}} {{area}} {{district}} {{category}} {{flyer_ref}} {{cta_url}} {{unsubscribe_url}} {{sender_name}}"}. The unsubscribe link and company details are added automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {isDraft && <Button onClick={saveDraft} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save draft"}</Button>}
              <Button variant="outline" onClick={showPreview} disabled={busy !== null}><Eye className="h-4 w-4 mr-1" /> Preview</Button>
              {isDraft && (
                <>
                  <div className="flex items-end gap-2">
                    <div>
                      <Label htmlFor="oc-test" className="text-xs">Send a test to</Label>
                      <Input id="oc-test" className="w-64" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                    </div>
                    <Button variant="outline" onClick={testSend} disabled={busy !== null || !testTo}><Send className="h-4 w-4 mr-1" /> {busy === "test" ? "Sending…" : "Send test"}</Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audience" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Only contacts that can lawfully be emailed are included: verified companies with a general inbox (or recorded consent). Anyone unsubscribed, bounced, marked as spam or emailed in the last {settings?.recontact_cooldown_days ?? 30} days is left out automatically.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <Section title="Categories">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {categories.length === 0 && <p className="text-sm text-muted-foreground">No eligible contacts yet. Import some on the Contacts tab.</p>}
                  {categories.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Checkbox disabled={!isDraft} checked={(audience.categories ?? []).includes(c)} onCheckedChange={(v) => toggle("categories", c, v === true)} />
                      {c}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">None ticked = all categories.</p>
              </Section>
              <Section title="Priority">
                <div className="space-y-2">
                  {["A", "B", "C"].map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox disabled={!isDraft} checked={(audience.priorities ?? []).includes(p)} onCheckedChange={(v) => toggle("priorities", p, v === true)} />
                      Priority {p}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">None ticked = all priorities.</p>
              </Section>
              <Section title="Postcode districts">
                <Input disabled={!isDraft} value={districtsText} placeholder="HD1, HD2, HD3" onChange={(e) => { setDistrictsText(e.target.value); setAudiencePreview(null); }} />
                <p className="text-xs text-muted-foreground mt-2">Leave empty for all districts.</p>
              </Section>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkAudience} disabled={busy !== null}>{busy === "audience" ? "Checking…" : "Check audience"}</Button>
              {isDraft && <Button variant="outline" onClick={saveDraft} disabled={busy !== null}>Save audience</Button>}
            </div>
            {audiencePreview && (
              <div className="border-4 border-foreground p-4 space-y-2">
                <div className="font-display text-2xl">{audiencePreview.count} recipients</div>
                <div className="text-sm text-muted-foreground">
                  {audiencePreview.excluded_suppressed} left out (do not contact) · {audiencePreview.excluded_recent} left out (emailed recently)
                  {audiencePreview.truncated && " · audience too large — narrow it down"}
                </div>
                <ul className="text-sm grid md:grid-cols-2 gap-x-6">
                  {audiencePreview.sample.map((r) => <li key={r.id} className="truncate">{r.business_name} · <span className="text-muted-foreground">{r.email}</span></li>)}
                </ul>
                {audiencePreview.count > audiencePreview.sample.length && <p className="text-xs text-muted-foreground">Showing the first {audiencePreview.sample.length}.</p>}
              </div>
            )}
          </TabsContent>

          {!isDraft && (
            <TabsContent value="recipients" className="space-y-3">
              <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recipients</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="not_opened">Sent, not opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="converted">Sent an enquiry</SelectItem>
                  <SelectItem value="pending">Waiting to send</SelectItem>
                  <SelectItem value="problems">Problems & opt-outs</SelectItem>
                </SelectContent>
              </Select>
              <div className="overflow-x-auto border-4 border-foreground">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Opens</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No recipients match.</TableCell></TableRow>}
                    {filteredMessages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-semibold">{m.business_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </TableCell>
                        <TableCell>
                          <MessageStatusBadge status={m.status} />
                          {m.last_error && ["failed", "suppressed", "queued"].includes(m.status) && <div className="text-xs text-muted-foreground max-w-[220px] truncate" title={m.last_error}>{m.last_error}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{m.sent_at ? format(new Date(m.sent_at), "dd MMM HH:mm") : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.open_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.click_count}</TableCell>
                        <TableCell className="text-xs">
                          {m.converted_at ? <span className="font-semibold text-green-700">Enquiry {format(new Date(m.converted_at), "dd MMM")}</span>
                            : m.unsubscribed_at ? "Unsubscribed"
                            : m.replied_at ? "Replied"
                            : m.first_clicked_at ? "Clicked"
                            : m.first_opened_at ? "Opened" : "—"}
                        </TableCell>
                        <TableCell>
                          {m.sent_at && !m.replied_at && (
                            <Button size="sm" variant="ghost" onClick={() => markReplied(m.id)} disabled={busy !== null}>Mark replied</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}

          {!isDraft && (
            <TabsContent value="activity">
              <ul className="space-y-1 text-sm max-h-[480px] overflow-y-auto">
                {events.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
                {events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4 border-b py-1">
                    <span>{e.event_type}{e.suspected_bot ? " (mail filter scan, not counted)" : ""}{e.url ? ` · ${e.url}` : ""}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(e.occurred_at), "dd MMM HH:mm:ss")}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          )}
        </Tabs>

        {isDraft && (
          <div className="flex flex-wrap items-end justify-between gap-3 border-t-4 border-foreground pt-4">
            <div>
              <Label htmlFor="oc-when" className="text-xs">Start sending at (optional)</Label>
              <Input id="oc-when" type="datetime-local" className="w-64" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </div>
            <Button size="lg" onClick={openLaunch} disabled={busy !== null}>
              <Rocket className="h-4 w-4 mr-2" /> {busy === "prelaunch" ? "Checking…" : "Review & launch"}
            </Button>
          </div>
        )}

        <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
            {preview && (
              <div className="space-y-3 text-sm">
                {preview.problems.length > 0 && (
                  <div className="border-4 border-red-600 bg-red-50 p-3">
                    <div className="font-semibold">Fix before launching:</div>
                    <ul className="list-disc pl-5">{preview.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                )}
                <div><span className="text-muted-foreground">From:</span> {preview.from} · <span className="text-muted-foreground">Reply-to:</span> {preview.reply_to}</div>
                <div><span className="text-muted-foreground">Subject:</span> <strong>{preview.subject}</strong></div>
                <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[560px] border-4 border-foreground bg-white" />
                <details>
                  <summary className="cursor-pointer font-semibold">Plain-text version</summary>
                  <pre className="whitespace-pre-wrap text-xs bg-muted p-3 mt-2">{preview.text}</pre>
                </details>
                <p className="text-xs text-muted-foreground">Preview uses a sample business. Real emails use each recipient's business name and tracked links.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmLaunch} onOpenChange={setConfirmLaunch}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send to {audiencePreview?.count ?? 0} businesses?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>Subject: <strong>{draft.subject}</strong></p>
                  <p>{scheduleAt ? `Starts ${format(new Date(scheduleAt), "EEE dd MMM HH:mm")}.` : "Starts with the next batch."} Emails go out within your sending window, up to {settings?.daily_cap ?? "—"} a day and {settings?.hourly_cap ?? "—"} an hour.</p>
                  {!settings?.sending_enabled && <p className="text-amber-700 font-semibold">Sending is switched off in Settings, so nothing will go out until you switch it on.</p>}
                  <p>You can pause or cancel at any time.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); launch(); }} disabled={busy !== null}>
                {busy === "launch" ? "Launching…" : `Launch to ${audiencePreview?.count ?? 0}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel the remaining emails?</AlertDialogTitle>
              <AlertDialogDescription>{s?.pending ?? 0} emails that haven't gone out yet will be cancelled. Emails already sent stay tracked. This can't be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep sending</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); control("cancel"); }}>Cancel remaining</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
