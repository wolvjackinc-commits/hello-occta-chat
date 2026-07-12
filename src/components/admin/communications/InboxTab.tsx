import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Inbox as InboxIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Thread = {
  id: string;
  subject: string;
  channel: string;
  status: string;
  customer_id: string | null;
  related_ticket_id: string | null;
  related_complaint_id: string | null;
  related_quote_id: string | null;
  related_order_id: string | null;
  related_invoice_id: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  direction: string;
  channel: string;
  sender_type: string;
  subject: string | null;
  body: string;
  created_at: string;
};

export function InboxTab() {
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLink, setFilterLink] = useState("all");
  const [search, setSearch] = useState("");
  const [openThread, setOpenThread] = useState<Thread | null>(null);

  const { data: threads } = useQuery({
    queryKey: ["admin-comm-threads"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("communication_threads")
        .select("id, subject, channel, status, customer_id, related_ticket_id, related_complaint_id, related_quote_id, related_order_id, related_invoice_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Thread[];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-comm-messages", openThread?.id],
    enabled: !!openThread,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("communication_messages")
        .select("id, direction, channel, sender_type, subject, body, created_at")
        .eq("thread_id", openThread!.id)
        .order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
  });

  const channels = useMemo(() => {
    const s = new Set<string>();
    threads?.forEach(t => s.add(t.channel));
    return Array.from(s);
  }, [threads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (threads ?? []).filter(t => {
      if (filterChannel !== "all" && t.channel !== filterChannel) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterLink === "ticket" && !t.related_ticket_id) return false;
      if (filterLink === "complaint" && !t.related_complaint_id) return false;
      if (filterLink === "order" && !t.related_order_id) return false;
      if (filterLink === "invoice" && !t.related_invoice_id) return false;
      if (q && !t.subject.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [threads, filterChannel, filterStatus, filterLink, search]);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-foreground p-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 border-2 border-foreground" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-36 border-2 border-foreground"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 border-2 border-foreground"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLink} onValueChange={setFilterLink}>
          <SelectTrigger className="w-40 border-2 border-foreground"><SelectValue placeholder="Linked to" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any link</SelectItem>
            <SelectItem value="ticket">Linked to ticket</SelectItem>
            <SelectItem value="complaint">Linked to complaint</SelectItem>
            <SelectItem value="order">Linked to order</SelectItem>
            <SelectItem value="invoice">Linked to invoice</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={<InboxIcon className="h-8 w-8" />}
            title="No threads match"
            message="Try clearing filters or searching a different subject. Threads appear here when customers reply to tickets, complaints, or invoices."
          />
        ) : (
          <Card className="border-2 border-foreground overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-foreground bg-muted/40">
                  <TableHead className="w-[45%]">Subject</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Linked to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const links: string[] = [];
                  if (t.related_ticket_id) links.push("ticket");
                  if (t.related_complaint_id) links.push("complaint");
                  if (t.related_order_id) links.push("order");
                  if (t.related_invoice_id) links.push("invoice");
                  if (t.related_quote_id) links.push("quote");
                  return (
                    <TableRow
                      key={t.id}
                      onClick={() => setOpenThread(t)}
                      className="cursor-pointer hover:bg-muted/30 border-b border-foreground/10"
                    >
                      <TableCell className="font-medium truncate max-w-[420px]">
                        {t.subject || <span className="text-muted-foreground italic">(no subject)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-2 border-foreground capitalize">
                          {t.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {links.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {links.map((l) => (
                              <Badge key={l} variant="outline" className="text-[10px] capitalize">
                                {l}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={!!openThread} onOpenChange={(o) => !o && setOpenThread(null)}>
        <DialogContent className="border-4 border-foreground max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{openThread?.subject}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-2">
            {messages?.map(m => (
              <div key={m.id} className={`p-3 border-2 ${m.direction === "internal" ? "border-warning bg-warning/10" : "border-foreground bg-background"}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1 text-xs">
                  <Badge variant="outline" className="border-2 border-foreground">{m.direction}</Badge>
                  <span className="text-muted-foreground">{m.sender_type} · {m.channel}</span>
                  {m.direction === "internal" && (
                    <span className="flex items-center gap-1 text-warning"><Lock className="w-3 h-3" /> Internal — not visible to customer</span>
                  )}
                  <span className="ml-auto text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.subject && <p className="font-medium text-sm">{m.subject}</p>}
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </div>
            ))}
            {(!messages || messages.length === 0) && <p className="text-sm text-muted-foreground">No messages.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground border-t pt-2">Replies and internal notes are managed inside the linked ticket or complaint.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}