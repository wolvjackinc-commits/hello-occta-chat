import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Lead = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  team_size: string | null;
  interest: string | null;
  message: string | null;
  source: string | null;
  status: string;
  created_at: string;
  sla_preference: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  secondary_contact_name: string | null;
  secondary_contact_email: string | null;
  site_address_line1: string | null;
  site_address_line2: string | null;
  site_city: string | null;
  site_postcode: string | null;
  assigned_to: string | null;
  internal_notes: string | null;
};

type Rep = { user_id: string; email: string | null; full_name: string | null };

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  qualified: "bg-indigo-100 text-indigo-800",
  quoted: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-gray-100 text-gray-700",
};

const BusinessLeads = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [reps, setReps] = useState<Rep[]>([]);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [leadRes, repRes] = await Promise.all([
      supabase.from("business_leads" as never).select("*").order("created_at", { ascending: false }).limit(500),
      // Admins list: user_roles joined to profiles
      supabase.from("user_roles").select("user_id, profiles:profiles!inner(email,full_name)").eq("role", "admin"),
    ]);
    if (leadRes.error) toast({ title: "Failed to load leads", description: leadRes.error.message, variant: "destructive" });
    else setLeads((leadRes.data ?? []) as unknown as Lead[]);
    if (!repRes.error && repRes.data) {
      setReps(repRes.data.map((r: any) => ({ user_id: r.user_id, email: r.profiles?.email ?? null, full_name: r.profiles?.full_name ?? null })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadNotes = async (leadId: string) => {
    const { data } = await supabase.from("business_lead_notes" as never).select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    setNotes((data ?? []) as any[]);
  };
  useEffect(() => { if (detail) loadNotes(detail.id); }, [detail]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("business_leads" as never).update({ status } as never).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const assignRep = async (id: string, assigned_to: string | null) => {
    const { error } = await supabase.from("business_leads" as never).update({ assigned_to } as never).eq("id", id);
    if (error) return toast({ title: "Assign failed", description: error.message, variant: "destructive" });
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, assigned_to } : l)));
  };

  const addNote = async () => {
    if (!detail || !newNote.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("business_lead_notes" as never).insert({ lead_id: detail.id, body: newNote.trim(), author_id: u.user?.id } as never);
    if (error) return toast({ title: "Note failed", description: error.message, variant: "destructive" });
    setNewNote("");
    loadNotes(detail.id);
  };

  const filtered = useMemo(() => leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (repFilter !== "all") {
      if (repFilter === "unassigned" && l.assigned_to) return false;
      if (repFilter !== "unassigned" && l.assigned_to !== repFilter) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      (l.postcode ?? l.site_postcode ?? "").toLowerCase().includes(q)
    );
  }), [leads, statusFilter, repFilter, search]);

  const repLabel = (id: string | null) => {
    if (!id) return "Unassigned";
    const r = reps.find((x) => x.user_id === id);
    return r?.full_name || r?.email || id.slice(0, 6);
  };

  const exportCsv = () => {
    const headers = ["Company","Contact","Email","Phone","Postcode","Team","Interest","SLA","Status","Assigned","Received"];
    const lines = filtered.map((l) => [l.company_name, l.contact_name, l.email, l.phone ?? "", l.postcode ?? l.site_postcode ?? "", l.team_size ?? "", l.interest ?? "", l.sla_preference ?? "standard", l.status, repLabel(l.assigned_to), l.created_at].map((v) => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `business-leads-${format(new Date(), "yyyyMMdd-HHmm")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Business leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {leads.length}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 w-64" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Rep" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {reps.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.full_name || r.email || r.user_id.slice(0,6)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"} /></Button>
        </div>
      </div>
      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No leads match.</TableCell></TableRow>
            )}
            {filtered.map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetail(l)}>
                <TableCell>
                  <div className="font-semibold">{l.company_name}</div>
                  <div className="text-xs text-muted-foreground">{l.site_postcode ?? l.postcode ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div>{l.contact_name}</div>
                  <div className="text-xs">
                    <a href={`mailto:${l.email}`} className="text-primary underline">{l.email}</a>
                    {l.phone && <span className="text-muted-foreground"> · {l.phone}</span>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{l.interest ?? "—"}</Badge></TableCell>
                <TableCell><Badge variant="outline">{l.sla_preference ?? "standard"}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={l.assigned_to ?? "unassigned"} onValueChange={(v) => assignRep(l.id, v === "unassigned" ? null : v)}>
                    <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {reps.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.full_name || r.email || r.user_id.slice(0,6)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">{format(new Date(l.created_at), "dd MMM HH:mm")}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.company_name} <Badge className={statusStyles[detail?.status ?? ""] ?? ""}>{detail?.status}</Badge>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Primary contact</div>{detail.contact_name} — <a className="underline" href={`mailto:${detail.email}`}>{detail.email}</a>{detail.phone && ` · ${detail.phone}`}</div>
                <div><div className="text-xs text-muted-foreground">Team / interest</div>{detail.team_size ?? "—"} · {detail.interest ?? "—"}</div>
              </div>
              {(detail.secondary_contact_name || detail.billing_contact_name) && (
                <div className="grid grid-cols-2 gap-3">
                  {detail.secondary_contact_name && <div><div className="text-xs text-muted-foreground">Secondary contact</div>{detail.secondary_contact_name} — {detail.secondary_contact_email ?? ""}</div>}
                  {detail.billing_contact_name && <div><div className="text-xs text-muted-foreground">Billing contact</div>{detail.billing_contact_name} — {detail.billing_contact_email ?? ""}</div>}
                </div>
              )}
              {(detail.site_address_line1 || detail.site_postcode || detail.postcode) && (
                <div>
                  <div className="text-xs text-muted-foreground">Site address</div>
                  {[detail.site_address_line1, detail.site_address_line2, detail.site_city, detail.site_postcode ?? detail.postcode].filter(Boolean).join(", ")}
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">SLA preference</div>
                <Badge variant="outline">{detail.sla_preference ?? "standard"}</Badge>
              </div>
              {detail.message && <div><div className="text-xs text-muted-foreground mb-1">Message</div><p className="whitespace-pre-wrap">{detail.message}</p></div>}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="flex gap-2">
                  <Textarea rows={2} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add an internal note…" />
                  <Button onClick={addNote}>Add</Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {notes.map((n: any) => (
                    <li key={n.id} className="border-l-4 border-primary pl-3">
                      <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM HH:mm")}</div>
                      <div className="whitespace-pre-wrap">{n.body}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessLeads;