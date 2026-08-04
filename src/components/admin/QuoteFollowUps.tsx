import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Send, Clock, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import {
  FOLLOWUP_CHANNELS, FOLLOWUP_OUTCOMES, channelLabel, outcomeLabel,
  dueState, nextFollowUp, type FollowUp,
} from "@/lib/quoteFollowups";
import {
  formatLondonDateTime, formatLondonLong, londonWallToUtcIso, utcIsoToLondonParts,
} from "@/lib/londonTime";

type QuoteRequestLike = {
  id: string;
  reference?: string | null;
  full_name?: string | null;
  email?: string | null;
  customer_id?: string | null;
  service_interest?: string | null;
  plan_preference?: string | null;
  postcode?: string | null;
  status?: string | null;
};

const emptyForm = () => ({
  id: null as string | null,
  date: utcIsoToLondonParts(new Date().toISOString()).date,
  time: utcIsoToLondonParts(new Date().toISOString()).time,
  channel: "phone",
  outcome: "spoke_to_customer",
  notes: "",
  customerSummary: "",
  nextDate: "",
  nextTime: "",
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export function QuoteFollowUps({
  request,
  onChanged,
}: {
  request: QuoteRequestLike;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<FollowUp | null>(null);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from("quote_request_followups")
      .select("*")
      .eq("quote_request_id", request.id)
      .is("deleted_at", null)
      .order("followup_at", { ascending: false });
    if (err) setError(err.message);
    setRows((data ?? []) as FollowUp[]);
    setLoading(false);
  };

  useEffect(() => {
    if (request?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const next = useMemo(() => nextFollowUp(rows), [rows]);
  const state = useMemo(() => dueState(rows, request.status), [rows, request.status]);

  const openCreate = () => { setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (f: FollowUp) => {
    const at = utcIsoToLondonParts(f.followup_at);
    const nx = utcIsoToLondonParts(f.next_followup_at);
    setForm({
      id: f.id, date: at.date, time: at.time, channel: f.channel, outcome: f.outcome,
      notes: f.notes ?? "", customerSummary: f.customer_summary ?? "",
      nextDate: nx.date, nextTime: nx.time,
    });
    setFormOpen(true);
  };

  const save = async () => {
    const followupAt = londonWallToUtcIso(form.date, form.time || "09:00");
    if (!followupAt) { toast({ title: "Follow-up date is required", variant: "destructive" }); return; }
    if (!form.notes.trim()) { toast({ title: "Follow-up details are required", variant: "destructive" }); return; }
    const nextAt = form.nextDate ? londonWallToUtcIso(form.nextDate, form.nextTime || "09:00") : null;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const staffName =
        (u?.user?.user_metadata as any)?.full_name || u?.user?.email || "OCCTA staff";
      const payload: Record<string, unknown> = {
        quote_request_id: request.id,
        followup_at: followupAt,
        channel: form.channel,
        outcome: form.outcome,
        notes: form.notes.trim(),
        customer_summary: form.customerSummary.trim() || null,
        next_followup_at: nextAt,
      };
      if (form.id) {
        const { error: err } = await (supabase as any)
          .from("quote_request_followups")
          .update({ ...payload, updated_by: uid })
          .eq("id", form.id);
        if (err) throw err;
        toast({ title: "Follow-up updated" });
      } else {
        // A new entry represents completion of the previously scheduled
        // follow-up: clear stale next dates from older live entries so only
        // the newest entry drives the current/next action.
        const { error: clearErr } = await (supabase as any)
          .from("quote_request_followups")
          .update({ next_followup_at: null, updated_by: uid })
          .eq("quote_request_id", request.id)
          .is("deleted_at", null)
          .not("next_followup_at", "is", null);
        if (clearErr) throw clearErr;
        const { error: err } = await (supabase as any)
          .from("quote_request_followups")
          .insert({ ...payload, created_by: uid, created_by_name: staffName });
        if (err) throw err;
        toast({ title: "Follow-up saved internally" });
      }
      setFormOpen(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Could not save follow-up", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: err } = await (supabase as any)
        .from("quote_request_followups")
        .update({ deleted_at: new Date().toISOString(), deleted_by: u?.user?.id ?? null })
        .eq("id", deleteTarget.id);
      if (err) throw err;
      toast({ title: "Follow-up removed", description: "Kept in the audit trail." });
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const buildCustomerMessage = (f: FollowUp) => {
    const lines: string[] = [];
    lines.push(`Hi ${request.full_name?.split(" ")[0] || "there"},`);
    lines.push("");
    lines.push("Thank you for your interest in OCCTA. Here is a summary of our latest follow-up on your quote request.");
    lines.push("");
    if (request.reference) lines.push(`Quote reference: ${request.reference}`);
    if (request.service_interest) lines.push(`Service: ${request.service_interest}`);
    if (request.postcode) lines.push(`Installation postcode: ${request.postcode}`);
    lines.push(`Follow-up: ${formatLondonLong(f.followup_at)} (UK time)`);
    lines.push(`Contact method: ${channelLabel(f.channel)}`);
    lines.push("");
    lines.push("Summary:");
    // Internal notes are NEVER used here. Only the admin-authored
    // customer-facing summary, or a neutral placeholder.
    lines.push(
      f.customer_summary?.trim() ||
        "We've reviewed your quote request and are progressing it. We'll confirm the next steps with you shortly.",
    );
    if (f.next_followup_at) {
      lines.push("");
      lines.push(`We'll be in touch again on ${formatLondonLong(f.next_followup_at)} (UK time).`);
    }
    lines.push("");
    lines.push("If anything above needs correcting, or you'd like to talk it through, reply to this email or call us on 0800 260 6626 (Mon–Fri 9am–6pm, Sat 9am–1pm).");
    lines.push("");
    lines.push("Kind regards,");
    lines.push("The OCCTA Team");
    lines.push("hello@occta.co.uk · 0800 260 6626");
    return lines.join("\n");
  };

  const openSend = (f: FollowUp) => {
    setSendTarget(f);
    setSendSubject(`Your OCCTA quote follow-up${request.reference ? ` — ${request.reference}` : ""}`);
    setSendBody(buildCustomerMessage(f));
  };

  const send = async () => {
    if (!sendTarget || sending) return;
    if (!request.email) { toast({ title: "No customer email on this request", variant: "destructive" }); return; }
    if (!sendBody.trim() || !sendSubject.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" }); return;
    }
    setSending(true);
    const messageHtml = sendBody
      .split("\n")
      .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 10px 0;">${escapeHtml(line)}</p>`))
      .join("");
    try {
      // Idempotency guard: re-read the row and abort if it was sent moments ago
      // (protects against double-clicks / duplicate tabs).
      const { data: fresh } = await (supabase as any)
        .from("quote_request_followups")
        .select("sent_at")
        .eq("id", sendTarget.id)
        .maybeSingle();
      const lastSent = fresh?.sent_at ? new Date(fresh.sent_at).getTime() : 0;
      if (lastSent && Date.now() - lastSent < 60_000) {
        toast({ title: "Already sent moments ago", description: "Duplicate send prevented." });
        setSendTarget(null);
        await load();
        return;
      }

      const { data, error: err } = await supabase.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: request.email,
          userId: request.customer_id || undefined,
          logToCommunications: true,
          data: {
            subject: sendSubject.trim(),
            message_html: messageHtml,
            customer_name: request.full_name || "there",
            account_number: request.reference || "",
          },
        },
      });
      if (err) throw err;
      if ((data as any)?.error) throw new Error((data as any).error);

      const reference =
        (data as any)?.id || (data as any)?.messageId || (data as any)?.message_id || null;
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("quote_request_followups").update({
        sent_at: new Date().toISOString(),
        sent_to: request.email,
        sent_subject: sendSubject.trim(),
        sent_message_html: messageHtml,
        sent_by: u?.user?.id ?? null,
        send_reference: reference,
        send_status: "sent",
      }).eq("id", sendTarget.id);

      toast({ title: "Follow-up sent", description: `Delivered to ${request.email}` });
      setSendTarget(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      await (supabase as any).from("quote_request_followups")
        .update({ send_status: `failed: ${String(e?.message ?? "unknown").slice(0, 200)}` })
        .eq("id", sendTarget.id);
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
      await load();
    } finally { setSending(false); }
  };

  return (
    <section className="mt-4 border-2 border-foreground/40 p-3 space-y-3" aria-label="Follow-up details">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display uppercase text-[10px] tracking-widest">Follow-up details (internal)</h3>
          <p className="text-[10px] text-muted-foreground">
            Admin-only. Customers only see what you explicitly send.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="w-3 h-3 mr-1" /> Add follow-up
        </Button>
      </div>

      <NextFollowUpBadge state={state} nextAt={next?.next_followup_at ?? null} />

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading follow-up history…
        </p>
      ) : error ? (
        <div className="border-2 border-destructive bg-destructive/5 p-2 text-xs">
          Could not load follow-ups: {error}
          <Button size="sm" variant="outline" className="mt-2" onClick={load}>Retry</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No follow-ups recorded yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((f) => (
            <li key={f.id} className="border-2 border-foreground/20 bg-background p-2 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{formatLondonDateTime(f.followup_at)}</span>
                <Badge variant="outline" className="border-2">{channelLabel(f.channel)}</Badge>
                <Badge className="border-2 border-foreground bg-muted text-foreground">{outcomeLabel(f.outcome)}</Badge>
                {f.sent_at && (
                  <Badge className="border-2 border-primary bg-primary/10 text-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Sent {formatLondonDateTime(f.sent_at)}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                By {f.created_by_name || "staff"} · created {formatLondonDateTime(f.created_at)}
                {f.updated_at !== f.created_at ? ` · updated ${formatLondonDateTime(f.updated_at)}` : ""}
              </p>
              <div className="border-l-2 border-foreground/30 pl-2">
                <p className="font-display uppercase text-[9px] tracking-widest text-muted-foreground">
                  Internal notes — never sent automatically
                </p>
                <p className="text-xs whitespace-pre-wrap">{f.notes}</p>
              </div>
              {f.customer_summary?.trim() ? (
                <div className="border-l-2 border-primary pl-2">
                  <p className="font-display uppercase text-[9px] tracking-widest text-primary">
                    Customer-facing summary
                  </p>
                  <p className="text-xs whitespace-pre-wrap">{f.customer_summary}</p>
                </div>
              ) : null}
              {f.next_followup_at && (
                <p className="text-[10px] text-muted-foreground">
                  Next follow-up: {formatLondonDateTime(f.next_followup_at)}
                </p>
              )}
              {f.send_status?.startsWith("failed") && (
                <p className="text-[10px] text-destructive">Last send {f.send_status}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(f)} aria-label="Edit follow-up">
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteTarget(f)} aria-label="Delete follow-up">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
                <Button size="sm" variant="hero" onClick={() => openSend(f)} disabled={!request.email}>
                  <Send className="w-3 h-3 mr-1" /> {f.sent_at ? "Resend to customer" : "Send follow-up details"}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit follow-up" : "Add follow-up"}</DialogTitle>
            <DialogDescription>
              Internal record for {request.reference || "this quote request"}. Times are UK (Europe/London).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fu-date" className="text-xs">Follow-up date</Label>
                <Input id="fu-date" type="date" value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="fu-time" className="text-xs">Follow-up time</Label>
                <Input id="fu-time" type="time" value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Method / channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((p) => ({ ...p, channel: v }))}>
                  <SelectTrigger aria-label="Follow-up method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Contact outcome</Label>
                <Select value={form.outcome} onValueChange={(v) => setForm((p) => ({ ...p, outcome: v }))}>
                  <SelectTrigger aria-label="Contact outcome"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="fu-notes" className="text-xs">
                Internal follow-up notes — never sent automatically
              </Label>
              <Textarea id="fu-notes" rows={5} value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="What was discussed, next steps, objections, pricing points…" />
            </div>
            <div>
              <Label htmlFor="fu-cust" className="text-xs">
                Customer-facing follow-up summary (optional)
              </Label>
              <Textarea id="fu-cust" rows={4} value={form.customerSummary}
                onChange={(e) => setForm((p) => ({ ...p, customerSummary: e.target.value }))}
                placeholder="Wording that is safe to send to the customer. Used to prefill the follow-up email." />
              <p className="text-[10px] text-muted-foreground mt-1">
                Only this text (never the internal notes) prefills the customer email.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fu-next-date" className="text-xs">Next follow-up date (optional)</Label>
                <Input id="fu-next-date" type="date" value={form.nextDate}
                  onChange={(e) => setForm((p) => ({ ...p, nextDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="fu-next-time" className="text-xs">Next follow-up time</Label>
                <Input id="fu-next-time" type="time" value={form.nextTime}
                  onChange={(e) => setForm((p) => ({ ...p, nextTime: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="hero" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Save follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this follow-up?</DialogTitle>
            <DialogDescription>
              The entry is removed from the timeline but preserved in the audit trail.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-xs text-muted-foreground">
              {formatLondonDateTime(deleteTarget.followup_at)} · {channelLabel(deleteTarget.channel)} · {outcomeLabel(deleteTarget.outcome)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview & send */}
      <Dialog open={!!sendTarget} onOpenChange={(o) => { if (!o && !sending) setSendTarget(null); }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Send follow-up details to customer</DialogTitle>
            <DialogDescription>
              To {request.email || "—"}. Prefilled from the customer-facing summary only — internal notes are never included. Review and edit before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div>
              <Label htmlFor="fu-subject" className="text-xs">Subject</Label>
              <Input id="fu-subject" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fu-body" className="text-xs">Customer-facing message</Label>
              <Textarea id="fu-body" rows={16} value={sendBody} onChange={(e) => setSendBody(e.target.value)} />
            </div>
            <div className="border-2 border-foreground/20 bg-muted/40 p-3">
              <p className="font-display uppercase text-[10px] tracking-widest mb-2">Preview</p>
              <div className="bg-background border-2 border-foreground/20 p-3 text-xs whitespace-pre-wrap">
                {sendBody}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTarget(null)} disabled={sending}>Cancel</Button>
            <Button variant="hero" onClick={send} disabled={sending || !request.email}>
              {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
              {sending ? "Sending…" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function NextFollowUpBadge({
  state,
  nextAt,
  compact,
  loading,
}: {
  state: ReturnType<typeof dueState>;
  nextAt: string | null;
  compact?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Badge variant="outline" className="border-2 text-muted-foreground flex items-center gap-1 w-fit">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
      </Badge>
    );
  }
  if (state === "none") {
    return (
      <Badge variant="outline" className="border-2 text-muted-foreground">
        {compact ? "No follow-up" : "No follow-up set"}
      </Badge>
    );
  }
  if (state === "completed") {
    return (
      <Badge className="border-2 border-primary bg-primary/10 text-foreground flex items-center gap-1 w-fit">
        <CheckCircle2 className="w-3 h-3" /> {compact ? "Converted" : "Completed / Converted"}
      </Badge>
    );
  }
  const cls =
    state === "overdue"
      ? "border-destructive bg-destructive/10"
      : state === "today"
        ? "border-warning bg-warning/20"
        : "border-foreground bg-muted";
  const Icon = state === "overdue" ? AlertTriangle : Clock;
  const label = state === "overdue" ? "Overdue" : state === "today" ? "Due today" : "Upcoming";
  return (
    <Badge className={`border-2 ${cls} text-foreground flex items-center gap-1 w-fit`}>
      <Icon className="w-3 h-3" /> {label}
      {nextAt ? <span className="font-mono">· {formatLondonDateTime(nextAt)}</span> : null}
    </Badge>
  );
}