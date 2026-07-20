import { useEffect, useState, useRef } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Paperclip, PlusCircle, Ticket, X, Download, Clock } from "lucide-react";

type BizTicket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  ticket_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  actor_type: string;
  created_at: string;
  metadata: any;
};

const BUCKET = "business-ticket-attachments";

const statusColor = (s: string) =>
  ({ open: "bg-blue-100 text-blue-800", in_progress: "bg-amber-100 text-amber-800", waiting_customer: "bg-purple-100 text-purple-800", resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-700" } as Record<string, string>)[s] ?? "bg-gray-100";

const BusinessSupport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<BizTicket[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ subject: "", category: "broadband", priority: "medium", description: "" });
  const [activityFor, setActivityFor] = useState<BizTicket | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const openActivity = async (t: BizTicket) => {
    setActivityFor(t);
    setActivityLoading(true);
    const { data } = await supabase
      .from("business_ticket_activity" as any)
      .select("*")
      .eq("ticket_id", t.id)
      .order("created_at", { ascending: false });
    setActivity(((data ?? []) as unknown) as Activity[]);
    setActivityLoading(false);
  };

  const exportCsv = () => {
    const rows = [
      ["Ticket ID", "Subject", "Status", "Priority", "Category", "Created", "Last update"],
      ...tickets.map((t) => [t.id, t.subject, t.status, t.priority, t.category ?? "", t.created_at, t.updated_at]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (!u) { setLoading(false); return; }
      const { data: rows } = await supabase
        .from("support_tickets")
        .select("id,subject,description,status,priority,category,created_at,updated_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      setTickets((rows ?? []) as BizTicket[]);
      setLoading(false);
    });
  }, []);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const chosen = Array.from(e.target.files).filter((f) => f.size <= 10 * 1024 * 1024);
    if (chosen.length !== e.target.files.length) toast({ title: "Some files were skipped (max 10MB each)", variant: "destructive" });
    setAttachments((a) => [...a, ...chosen].slice(0, 5));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return navigate("/auth?next=/business/support");
    if (form.subject.trim().length < 5 || form.description.trim().length < 20) {
      toast({ title: "Add a bit more detail (5+ char subject, 20+ char description)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: form.subject.trim(),
        description: form.description.trim(),
        status: "open",
        priority: form.priority as any,
        category: form.category,
      })
      .select("id")
      .single();
    if (error || !t) {
      setSubmitting(false);
      toast({ title: "Failed to raise ticket", description: error?.message, variant: "destructive" });
      return;
    }
    // Upload attachments (best-effort)
    for (const file of attachments) {
      const key = `${user.id}/${t.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, { contentType: file.type });
      if (upErr) console.warn("attach failed", upErr.message);
    }
    setSubmitting(false);
    toast({ title: "Ticket raised", description: "Our team will respond shortly." });
    setOpen(false);
    setForm({ subject: "", category: "broadband", priority: "medium", description: "" });
    setAttachments([]);
    const { data: rows } = await supabase
      .from("support_tickets")
      .select("id,subject,description,status,priority,category,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTickets((rows ?? []) as BizTicket[]);
  };

  return (
    <Layout>
      <SEO title="Business Support" description="Raise a business support ticket and track updates." canonical="/business/support" />
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl mb-2">Business support</h1>
            <p className="text-muted-foreground">Raise tickets, attach evidence, and track status. UK-based support, 4-hour fix target on Enhanced SLA.</p>
          </div>
          <Button variant="hero" size="lg" onClick={() => user ? setOpen(true) : navigate("/auth?next=/business/support")}>
            <PlusCircle className="w-4 h-4 mr-2" /> Raise a ticket
          </Button>
        </div>

        {user && tickets.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" /> Export CSV ({tickets.length})
            </Button>
          </div>
        )}

        {!user && !loading && (
          <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal text-center">
            <p className="mb-4">Sign in to view and raise business tickets.</p>
            <Link to="/auth?next=/business/support"><Button variant="hero">Sign in</Button></Link>
          </div>
        )}

        {user && loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

        {user && !loading && tickets.length === 0 && (
          <div className="border-4 border-foreground bg-secondary p-10 shadow-brutal text-center">
            <Ticket className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-display text-lg mb-2">No tickets yet</p>
            <p className="text-muted-foreground mb-4">Nothing broken? Nice. If something changes, we're here.</p>
            <Button variant="outline" onClick={() => setOpen(true)}><PlusCircle className="w-4 h-4 mr-2" /> Raise a ticket</Button>
          </div>
        )}

        {user && tickets.length > 0 && (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="border-4 border-foreground bg-background p-4 shadow-brutal flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={statusColor(t.status)}>{t.status.replace("_"," ")}</Badge>
                    <Badge variant="outline">{t.priority}</Badge>
                    {t.category && <Badge variant="outline">{t.category}</Badge>}
                  </div>
                  <div className="font-display text-lg truncate">{t.subject}</div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap space-y-1">
                  <div>Raised {format(new Date(t.created_at), "dd MMM")}</div>
                  <div>Updated {format(new Date(t.updated_at), "dd MMM HH:mm")}</div>
                  <Button size="sm" variant="outline" onClick={() => openActivity(t)}>
                    <Clock className="w-3 h-3 mr-1" /> Activity
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Raise a business ticket</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input required minLength={5} maxLength={100} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Broadband slow at Camden HQ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broadband">Broadband</SelectItem>
                      <SelectItem value="voice">Voice / VoIP</SelectItem>
                      <SelectItem value="sim">SIM</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent — site down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Describe the issue</Label>
                <Textarea rows={5} required minLength={20} maxLength={2000} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What happened, when, what you've tried, sites affected…" />
              </div>
              <div>
                <Label>Attachments (optional)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                    <Paperclip className="w-4 h-4 mr-1" /> Add files
                  </Button>
                  <input ref={fileInput} type="file" multiple hidden onChange={onFiles} accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.log,.csv" />
                  <span className="text-xs text-muted-foreground">Max 5 files · 10MB each</span>
                </div>
                {attachments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {attachments.map((f, i) => (
                      <li key={i} className="flex items-center justify-between border-2 border-foreground/20 p-1.5">
                        <span className="truncate">{f.name}</span>
                        <button type="button" onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}>
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : "Submit ticket"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!activityFor} onOpenChange={(v) => { if (!v) setActivityFor(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Ticket activity</DialogTitle></DialogHeader>
            {activityFor && <p className="text-sm text-muted-foreground -mt-2 mb-2">{activityFor.subject}</p>}
            {activityLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              <ol className="space-y-3 max-h-[60vh] overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id} className="border-l-4 border-primary pl-3 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm capitalize">{a.event_type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                    </div>
                    {(a.from_value || a.to_value) && (
                      <p className="text-sm">
                        {a.from_value ? <span className="text-muted-foreground line-through mr-2">{a.from_value.replace(/_/g," ")}</span> : null}
                        {a.to_value ? <span>{a.to_value.replace(/_/g," ")}</span> : null}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">by {a.actor_type}</p>
                  </li>
                ))}
              </ol>
            )}
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
};

export default BusinessSupport;