import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus } from "lucide-react";

type Row = {
  id: string;
  complaint_reference: string;
  category: string;
  status: string;
  priority: string;
  summary: string;
  opened_at: string;
  six_week_adr_eligible_at: string;
  deadlock_issued_at: string | null;
  resolved_at: string | null;
  customer_id: string | null;
  linked_ticket_id: string | null;
};

export const AdminComplaints = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [eventFor, setEventFor] = useState<Row | null>(null);
  const [evType, setEvType] = useState("update");
  const [evTitle, setEvTitle] = useState("");
  const [evNote, setEvNote] = useState("");
  const [evVisibility, setEvVisibility] = useState<"customer" | "internal">("customer");
  const [evNewStatus, setEvNewStatus] = useState<string>("");
  const [evIssueDeadlock, setEvIssueDeadlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const [evidenceFor, setEvidenceFor] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<any | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = supabase.from("complaints")
      .select("id, complaint_reference, category, status, priority, summary, opened_at, six_week_adr_eligible_at, deadlock_issued_at, resolved_at, customer_id, linked_ticket_id")
      .order("opened_at", { ascending: false }).limit(200);
    const { data } = await q;
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? rows : rows.filter(r => r.status === filter);

  const submitEvent = async () => {
    if (!eventFor || evTitle.trim().length < 3) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("add-complaint-event", {
      body: {
        complaint_id: eventFor.id,
        event_type: evType,
        title: evTitle.trim().slice(0, 200),
        note: evNote.trim().slice(0, 4000) || null,
        visibility: evVisibility,
        new_status: evNewStatus || null,
        issue_deadlock: evIssueDeadlock,
      },
    });
    setBusy(false);
    if (error) { toast({ title: "Couldn't add event", description: error.message, variant: "destructive" }); return; }
    toast({ title: (data as any)?.deadlock ? "Deadlock issued" : "Event added" });
    setEventFor(null); setEvTitle(""); setEvNote(""); setEvNewStatus(""); setEvIssueDeadlock(false); setEvVisibility("customer"); setEvType("update");
    load();
  };

  const openEvidence = async (r: Row) => {
    setEvidenceFor(r); setEvidence(null); setLoadingEvidence(true);
    const [complaint, events, letters, links, ticket, threads] = await Promise.all([
      supabase.from("complaints").select("*").eq("id", r.id).maybeSingle(),
      (supabase as any).from("complaint_events").select("id, event_type, title, actor_type, visibility, created_at, details").eq("complaint_id", r.id).order("created_at"),
      (supabase as any).from("complaint_letters").select("id, letter_type, subject, status, sent_at, created_at").eq("complaint_id", r.id).order("created_at"),
      (supabase as any).from("complaint_evidence_links").select("*").eq("complaint_id", r.id),
      r.linked_ticket_id ? supabase.from("support_tickets").select("id, subject, status, priority, created_at, vulnerable_customer_flag").eq("id", r.linked_ticket_id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase as any).from("communication_threads").select("id, subject, channel, status, created_at, updated_at").eq("related_complaint_id", r.id),
    ]);
    setEvidence({
      complaint: complaint.data,
      events: events.data ?? [],
      letters: letters.data ?? [],
      evidence_links: links.data ?? [],
      linked_ticket: ticket.data,
      communication_threads: threads.data ?? [],
    });
    setLoadingEvidence(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Complaints register</h1>
          <p className="text-sm text-muted-foreground">Formal complaints with six-week ADR tracking.</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all","open","investigating","waiting_customer","resolved","deadlock_issued","referred_to_adr","closed"].map(s => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} className="capitalize" onClick={() => setFilter(s)}>
              {s.replace(/_/g," ")}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No complaints match.</p>
      ) : (
        <div className="space-y-2">
          {visible.map(r => {
            const eligible = new Date(r.six_week_adr_eligible_at) < new Date();
            return (
              <div key={r.id} className="p-3 border-4 border-foreground bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-xs">{r.complaint_reference}</p>
                    <Badge className="capitalize border-2 border-foreground">{r.status.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className="capitalize">{r.category.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className="capitalize">{r.priority}</Badge>
                    {eligible && !r.resolved_at && <Badge className="border-2 border-foreground bg-destructive text-destructive-foreground">ADR-eligible</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.opened_at), "dd MMM yyyy")}</p>
                </div>
                <p className="text-sm mt-2 line-clamp-3">{r.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ADR eligible {format(new Date(r.six_week_adr_eligible_at), "dd MMM yyyy")}
                  {r.deadlock_issued_at && ` · Deadlock ${format(new Date(r.deadlock_issued_at), "dd MMM yyyy")}`}
                  {r.resolved_at && ` · Resolved ${format(new Date(r.resolved_at), "dd MMM yyyy")}`}
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => { setEventFor(r); setEvTitle(""); }}>
                    <Plus className="w-3 h-3 mr-1" /> Add event
                  </Button>
                  <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => openEvidence(r)}>
                    <FileText className="w-3 h-3 mr-1" /> Generate Evidence Pack
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!eventFor} onOpenChange={(o) => !o && setEventFor(null)}>
        <DialogContent className="border-4 border-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add complaint event · {eventFor?.complaint_reference}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={evType} onValueChange={setEvType}>
                <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["update","customer_response","internal_review","investigation","resolution_offered","deadlock","adr_referral"].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={evVisibility} onValueChange={(v) => setEvVisibility(v as "customer" | "internal")}>
                <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Visible to customer</SelectItem>
                  <SelectItem value="internal">Internal only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Event title (required)" className="border-2 border-foreground" maxLength={200} />
            <Textarea value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="Optional note" className="border-2 border-foreground" rows={4} maxLength={4000} />
            <Select value={evNewStatus} onValueChange={setEvNewStatus}>
              <SelectTrigger className="border-2 border-foreground"><SelectValue placeholder="Keep current status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Keep current status</SelectItem>
                {["open","investigating","waiting_customer","resolved","deadlock_issued","referred_to_adr","closed"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={evIssueDeadlock} onCheckedChange={(v) => setEvIssueDeadlock(!!v)} />
              Issue deadlock (sets status and timestamp)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-2 border-foreground" onClick={() => setEventFor(null)}>Cancel</Button>
            <Button onClick={submitEvent} disabled={busy || evTitle.trim().length < 3}>Add event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!evidenceFor} onOpenChange={(o) => !o && setEvidenceFor(null)}>
        <DialogContent className="border-4 border-foreground max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Evidence pack · {evidenceFor?.complaint_reference}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            {loadingEvidence || !evidence ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="space-y-4 text-sm">
                <section>
                  <h4 className="font-display uppercase mb-1">Complaint</h4>
                  <pre className="text-xs bg-muted/40 p-2 border-2 border-foreground overflow-x-auto">{JSON.stringify(evidence.complaint, null, 2)}</pre>
                </section>
                <section>
                  <h4 className="font-display uppercase mb-1">Events ({evidence.events.length})</h4>
                  <ul className="space-y-1">
                    {evidence.events.map((e: any) => (
                      <li key={e.id} className="border-l-4 border-foreground pl-2">
                        <span className="font-mono text-[11px]">{new Date(e.created_at).toLocaleString()}</span> · <b>{e.event_type}</b> — {e.title}
                        {e.visibility === "internal" && <Badge variant="outline" className="ml-1">internal</Badge>}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 className="font-display uppercase mb-1">Letters ({evidence.letters.length})</h4>
                  <ul className="text-xs">{evidence.letters.map((l: any) => <li key={l.id}>{l.letter_type} · {l.status} · {l.subject}</li>)}</ul>
                </section>
                <section>
                  <h4 className="font-display uppercase mb-1">Linked ticket</h4>
                  {evidence.linked_ticket ? <pre className="text-xs bg-muted/40 p-2 border-2 border-foreground">{JSON.stringify(evidence.linked_ticket, null, 2)}</pre> : <p className="text-xs text-muted-foreground">None</p>}
                </section>
                <section>
                  <h4 className="font-display uppercase mb-1">Communication threads ({evidence.communication_threads.length})</h4>
                  <ul className="text-xs">{evidence.communication_threads.map((t: any) => <li key={t.id}>{t.channel} · {t.status} · {t.subject}</li>)}</ul>
                </section>
                <section>
                  <h4 className="font-display uppercase mb-1">Evidence links</h4>
                  <ul className="text-xs">{evidence.evidence_links.map((x: any) => <li key={x.id}>{JSON.stringify(x)}</li>)}</ul>
                </section>
                <p className="text-[11px] text-muted-foreground">Read-only summary. PDF export will be added in a later phase.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};