import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TicketReplyDialog } from "@/components/admin/TicketReplyDialog";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, AlertTriangle, Shield, Lock, FileWarning } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusOptions = ["open", "in_progress", "resolved", "closed"] as const;
type TicketStatus = typeof statusOptions[number];

function slaBadge(t: { status: string; resolution_due_at: string | null; first_response_due_at: string | null }) {
  if (t.status === "resolved" || t.status === "closed") return null;
  const due = t.resolution_due_at ?? t.first_response_due_at;
  if (!due) return null;
  const d = new Date(due);
  if (isPast(d)) return <Badge className="bg-destructive text-destructive-foreground border-2 border-foreground">SLA overdue</Badge>;
  const hrs = differenceInHours(d, new Date());
  if (hrs <= 12) return <Badge className="bg-warning text-warning-foreground border-2 border-foreground">Due soon</Badge>;
  return <Badge variant="outline" className="border-2 border-foreground">On track</Badge>;
}

export const AdminTickets = () => {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterVulnerable, setFilterVulnerable] = useState<boolean>(false);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [noteTicket, setNoteTicket] = useState<any | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [complaintTicket, setComplaintTicket] = useState<any | null>(null);
  const [complaintSummary, setComplaintSummary] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("service");
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, user_id, subject, description, status, priority, category, assigned_to, created_at, vulnerable_customer_flag, first_response_due_at, resolution_due_at, related_order_id, related_invoice_id, related_quote_id, related_service_id")
        .order("created_at", { ascending: false });

      const userIds = tickets?.map((ticket) => ticket.user_id) ?? [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      // Get admin users for assignment dropdown
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      const adminIds = adminRoles?.map((r) => r.user_id) ?? [];
      let adminProfiles: { id: string; full_name: string | null; email: string | null }[] = [];
      if (adminIds.length > 0) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", adminIds);
        adminProfiles = admins ?? [];
      }

      return { tickets: tickets ?? [], profiles: profiles ?? [], adminProfiles };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    data?.profiles.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [data?.profiles]);

  const adminProfileMap = useMemo(() => {
    const map = new Map<string, { full_name: string | null; email: string | null }>();
    data?.adminProfiles?.forEach((p) => map.set(p.id, p));
    return map;
  }, [data?.adminProfiles]);

  const handleStatusChange = async (ticketId: string, status: TicketStatus, ticketSubject?: string) => {
    const ticket = data?.tickets.find(t => t.id === ticketId);
    const previousStatus = ticket?.status;
    
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }

    await logAudit({
      action: status === 'closed' ? 'close' : 'update',
      entity: 'support_ticket',
      entityId: ticketId,
      metadata: { previousStatus, newStatus: status, subject: ticketSubject },
    });

    refetch();
  };

  const handleAssign = async (ticketId: string, assignedTo: string | null) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ assigned_to: assignedTo })
      .eq("id", ticketId);

    if (error) {
      toast({ title: "Failed to assign ticket", variant: "destructive" });
      return;
    }

    const assigneeName = assignedTo ? (adminProfileMap.get(assignedTo)?.full_name || "Admin") : "Unassigned";
    await logAudit({
      action: "update",
      entity: "support_ticket",
      entityId: ticketId,
      metadata: { assigned_to: assigneeName },
    });

    toast({ title: assignedTo ? `Assigned to ${assigneeName}` : "Unassigned" });
    refetch();
  };

  const addInternalNote = async () => {
    if (!noteTicket || !noteBody.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ticket_internal_notes").insert({
      ticket_id: noteTicket.id,
      body: noteBody.trim().slice(0, 4000),
    });
    setBusy(false);
    if (error) { toast({ title: "Couldn't save note", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action: "create", entity: "ticket_internal_note", entityId: noteTicket.id, metadata: { subject: noteTicket.subject } });
    setNoteBody(""); setNoteTicket(null);
    toast({ title: "Internal note saved" });
  };

  const createComplaintFromTicket = async () => {
    if (!complaintTicket || complaintSummary.trim().length < 5) return;
    setBusy(true);
    const profile = profileMap.get(complaintTicket.user_id);
    const { data: c, error } = await (supabase as any).from("complaints").insert({
      customer_id: complaintTicket.user_id,
      complaint_reference: "",
      category: complaintCategory,
      summary: complaintSummary.trim().slice(0, 4000),
      linked_ticket_id: complaintTicket.id,
      contact_email: profile?.email ?? null,
      status: "open",
      priority: "normal",
    }).select("id, complaint_reference").single();
    if (!error && c) {
      await (supabase as any).from("complaint_events").insert({
        complaint_id: c.id,
        event_type: "created_from_ticket",
        title: `Complaint created from ticket "${complaintTicket.subject}"`,
        actor_type: "staff",
        visibility: "internal",
        details: { ticket_id: complaintTicket.id },
      });
      await logAudit({ action: "create", entity: "complaint", entityId: c.id, metadata: { from_ticket: complaintTicket.id, reference: c.complaint_reference } });
      toast({ title: `Complaint ${c.complaint_reference} opened` });
      setComplaintTicket(null); setComplaintSummary("");
    } else {
      toast({ title: "Couldn't create complaint", description: error?.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const categories = useMemo(() => {
    const s = new Set<string>();
    data?.tickets.forEach(t => t.category && s.add(t.category));
    return Array.from(s).sort();
  }, [data?.tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.tickets ?? []).filter(t => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterVulnerable && !t.vulnerable_customer_flag) return false;
      if (filterAssignee === "unassigned" && t.assigned_to) return false;
      if (filterAssignee !== "all" && filterAssignee !== "unassigned" && t.assigned_to !== filterAssignee) return false;
      if (q) {
        const p = profileMap.get(t.user_id);
        const hay = `${t.subject} ${t.description ?? ""} ${p?.full_name ?? ""} ${p?.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data?.tickets, filterStatus, filterCategory, filterPriority, filterVulnerable, filterAssignee, search, profileMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Support inbox</h1>
        <p className="text-muted-foreground">Respond quickly to issues and manage replies.</p>
      </div>

      <Card className="border-2 border-foreground p-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search subject, customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 border-2 border-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 border-2 border-foreground"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["open","in_progress","waiting_customer","waiting_occta","resolved","closed"].map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 border-2 border-foreground"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["low","normal","medium","high","urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 border-2 border-foreground"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40 border-2 border-foreground"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any assignee</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {data?.adminProfiles?.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email?.split("@")[0] || "Admin"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant={filterVulnerable ? "default" : "outline"} onClick={() => setFilterVulnerable(v => !v)} className="border-2 border-foreground">
          <Shield className="w-3 h-3 mr-1" /> Vulnerable only
        </Button>
      </Card>

      <div className="grid gap-4">
        {filtered.map((ticket) => (
          <Card key={ticket.id} className="border-2 border-foreground p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {ticket.subject}
                  {ticket.vulnerable_customer_flag && (
                    <Badge className="bg-warning text-warning-foreground border-2 border-foreground">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Vulnerable
                    </Badge>
                  )}
                  {slaBadge(ticket as any)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {profileMap.get(ticket.user_id)?.full_name || "Customer"}
                  {profileMap.get(ticket.user_id)?.email ? ` · ${profileMap.get(ticket.user_id)?.email}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                  {ticket.category && ` · ${ticket.category.replace(/_/g," ")}`}
                </div>
                {(ticket.related_order_id || ticket.related_invoice_id || ticket.related_quote_id || ticket.related_service_id) && (
                  <div className="text-[11px] text-muted-foreground mt-1 flex gap-2 flex-wrap">
                    {ticket.related_order_id && <span>Order {String(ticket.related_order_id).slice(0,8)}</span>}
                    {ticket.related_invoice_id && <span>Invoice {String(ticket.related_invoice_id).slice(0,8)}</span>}
                    {ticket.related_quote_id && <span>Quote {String(ticket.related_quote_id).slice(0,8)}</span>}
                    {ticket.related_service_id && <span>Service {String(ticket.related_service_id).slice(0,8)}</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ticket.priority}</Badge>
                <Select 
                  value={ticket.status} 
                  onValueChange={(value: TicketStatus) => handleStatusChange(ticket.id, value, ticket.subject)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={ticket.assigned_to || "unassigned"} 
                  onValueChange={(value) => handleAssign(ticket.id, value === "unassigned" ? null : value)}
                >
                  <SelectTrigger className="w-40">
                    <UserCircle className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {data?.adminProfiles?.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name || admin.email?.split("@")[0] || "Admin"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setSelectedProfile(profileMap.get(ticket.user_id));
                    setDialogOpen(true);
                  }}
                >
                  Reply
                </Button>
                <Button variant="outline" size="sm" className="border-2 border-foreground" onClick={() => { setNoteTicket(ticket); setNoteBody(""); }}>
                  <Lock className="w-3 h-3 mr-1" /> Internal note
                </Button>
                <Button variant="outline" size="sm" className="border-2 border-foreground" onClick={() => { setComplaintTicket(ticket); setComplaintSummary(`Escalated from ticket: ${ticket.subject}`); setComplaintCategory(ticket.category || "service"); }}>
                  <FileWarning className="w-3 h-3 mr-1" /> Create complaint
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="border-2 border-foreground p-8 text-center">
            <p className="text-muted-foreground">No tickets match these filters.</p>
          </Card>
        )}
      </div>

      <TicketReplyDialog
        ticket={selectedTicket}
        profile={selectedProfile}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={() => refetch()}
      />

      <Dialog open={!!noteTicket} onOpenChange={(o) => !o && setNoteTicket(null)}>
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle>Internal note — not visible to customer</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Use for handover context only. Never paste card, bank, password or token data.</p>
          <Textarea rows={5} maxLength={4000} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className="border-2 border-foreground" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTicket(null)} className="border-2 border-foreground">Cancel</Button>
            <Button onClick={addInternalNote} disabled={busy || noteBody.trim().length < 1}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!complaintTicket} onOpenChange={(o) => !o && setComplaintTicket(null)}>
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle>Open a formal complaint from this ticket</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">A new complaint will be created and linked to the ticket. The customer will see it in their dashboard.</p>
          <Select value={complaintCategory} onValueChange={setComplaintCategory}>
            <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["service","billing","installation","sales","vulnerable","other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea rows={5} maxLength={4000} value={complaintSummary} onChange={(e) => setComplaintSummary(e.target.value)} className="border-2 border-foreground" placeholder="Short summary of the complaint" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintTicket(null)} className="border-2 border-foreground">Cancel</Button>
            <Button onClick={createComplaintFromTicket} disabled={busy || complaintSummary.trim().length < 5}>Create complaint</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
