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

type QuoteReq = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  site_count: number;
  services: string[];
  requirements: Record<string, any>;
  sla_preference: string;
  message: string | null;
  status: string;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewing: "bg-amber-100 text-amber-800",
  quoted: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-gray-100 text-gray-700",
};

export const AdminBusinessQuoteRequests = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<QuoteReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<QuoteReq | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_quote_requests" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows((data ?? []) as unknown as QuoteReq[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const loadNotes = async (id: string) => {
    const { data } = await supabase.from("business_quote_notes" as never).select("*").eq("quote_id", id).order("created_at", { ascending: false });
    setNotes((data ?? []) as any[]);
  };
  useEffect(() => { if (detail) loadNotes(detail.id); }, [detail]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("business_quote_requests" as never).update({ status } as never).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const addNote = async () => {
    if (!detail || !newNote.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("business_quote_notes" as never).insert({ quote_id: detail.id, body: newNote.trim(), author_id: u.user?.id } as never);
    if (error) return toast({ title: "Note failed", description: error.message, variant: "destructive" });
    setNewNote("");
    loadNotes(detail.id);
  };

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.company_name?.toLowerCase().includes(q) || r.contact_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
  }), [rows, statusFilter, search]);

  const exportCsv = () => {
    const headers = ["Company","Contact","Email","Phone","Sites","Services","SLA","Status","Received"];
    const lines = filtered.map((r) => [r.company_name, r.contact_name, r.email, r.phone ?? "", r.site_count, r.services.join("|"), r.sla_preference, r.status, r.created_at].map((v) => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `business-quote-requests-${format(new Date(), "yyyyMMdd-HHmm")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Business quote requests</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 w-64" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh list"><RefreshCw className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"} /></Button>
        </div>
      </div>

      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Sites</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No quote requests yet.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                <TableCell className="font-semibold">{r.company_name}</TableCell>
                <TableCell>
                  <div>{r.contact_name}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="text-xs">{r.services.slice(0,3).join(", ")}{r.services.length>3?`, +${r.services.length-3}`:""}</TableCell>
                <TableCell><Badge variant="outline">{r.sla_preference}</Badge></TableCell>
                <TableCell className="text-sm">{r.site_count}</TableCell>
                <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
                <TableCell><Badge className={statusStyles[r.status] ?? ""}>{r.status}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewing">Reviewing</SelectItem>
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
          <DialogHeader><DialogTitle>{detail?.company_name}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Contact</div>{detail.contact_name} — <a className="underline" href={`mailto:${detail.email}`}>{detail.email}</a>{detail.phone && ` · ${detail.phone}`}</div>
                <div><div className="text-xs text-muted-foreground">Sites / SLA</div>{detail.site_count} site(s) · {detail.sla_preference}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Services</div>
                <div className="flex flex-wrap gap-1">{detail.services.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Requirements</div>
                <pre className="bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detail.requirements ?? {}, null, 2)}</pre>
              </div>
              {detail.message && <div><div className="text-xs text-muted-foreground mb-1">Message</div><p className="text-sm whitespace-pre-wrap">{detail.message}</p></div>}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="flex gap-2">
                  <Textarea rows={2} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add an internal note…" />
                  <Button onClick={addNote}>Add</Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {notes.map((n: any) => (
                    <li key={n.id} className="text-sm border-l-4 border-primary pl-3">
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

export default AdminBusinessQuoteRequests;