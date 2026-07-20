import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Filter } from "lucide-react";
import { format } from "date-fns";

const EVENT_TYPES = [
  "status_change",
  "priority_change",
  "assignment",
  "message",
  "attachment_uploaded",
  "attachment_access",
] as const;

type Row = {
  id: string;
  ticket_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
  metadata: any;
  ticket_subject?: string;
  ticket_assigned_to?: string | null;
  actor_name?: string | null;
};

export const AdminBusinessActivityLog = () => {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const search = params.get("q") ?? "";
  const eventType = params.get("event") ?? "all";
  const assignee = params.get("assignee") ?? "all";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v && v !== "all") next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("business_ticket_activity" as any)
        .select("id,ticket_id,event_type,from_value,to_value,actor_type,actor_id,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(500);
      if (eventType !== "all") query = query.eq("event_type", eventType);
      if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
      if (to) query = query.lte("created_at", `${to}T23:59:59Z`);

      const { data } = await query;
      const acts = ((data ?? []) as any[]) as Row[];

      const ticketIds = Array.from(new Set(acts.map((a) => a.ticket_id)));
      const actorIds = Array.from(new Set(acts.map((a) => a.actor_id).filter(Boolean))) as string[];

      const [ticketsRes, profilesRes] = await Promise.all([
        ticketIds.length
          ? supabase.from("support_tickets").select("id,subject,assigned_to").in("id", ticketIds)
          : Promise.resolve({ data: [] as any[] }),
        actorIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const tMap = new Map((ticketsRes.data ?? []).map((t: any) => [t.id, t]));
      const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

      let enriched = acts.map((a) => {
        const t = tMap.get(a.ticket_id);
        const p = a.actor_id ? pMap.get(a.actor_id) : null;
        return {
          ...a,
          ticket_subject: t?.subject,
          ticket_assigned_to: t?.assigned_to ?? null,
          actor_name: p?.full_name || p?.email || null,
        };
      });

      if (assignee !== "all") {
        enriched = enriched.filter((r) =>
          assignee === "unassigned" ? !r.ticket_assigned_to : r.ticket_assigned_to === assignee,
        );
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        enriched = enriched.filter(
          (r) =>
            r.ticket_id.toLowerCase().includes(q) ||
            (r.ticket_subject ?? "").toLowerCase().includes(q),
        );
      }

      setRows(enriched);
      setLoading(false);
    })();
  }, [search, eventType, assignee, from, to]);

  const assignees = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.ticket_assigned_to).filter(Boolean))) as string[];
    return ids;
  }, [rows]);

  const exportCsv = () => {
    const header = ["When", "Ticket", "Subject", "Event", "From", "To", "Actor", "Metadata"];
    const body = rows.map((r) => [
      r.created_at,
      r.ticket_id,
      r.ticket_subject ?? "",
      r.event_type,
      r.from_value ?? "",
      r.to_value ?? "",
      r.actor_name ?? r.actor_type,
      JSON.stringify(r.metadata ?? {}),
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-ticket-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase">Business ticket activity</h1>
          <p className="text-muted-foreground text-sm">Filter, search, and export the audit trail.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Export CSV ({rows.length})
        </Button>
      </div>

      <div className="border-4 border-foreground p-3 bg-secondary flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4" />
        <Input
          placeholder="Search ticket ID or subject"
          value={search}
          onChange={(e) => setParam("q", e.target.value)}
          className="max-w-xs"
        />
        <Select value={eventType} onValueChange={(v) => setParam("event", v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v) => setParam("assignee", v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {assignees.map((id) => <SelectItem key={id} value={id}>{id.slice(0, 8)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="w-40" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading activity
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No activity matches your filters.</p>
      ) : (
        <div className="border-4 border-foreground bg-background overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left uppercase text-xs">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Ticket</th>
                <th className="p-2">Event</th>
                <th className="p-2">Change</th>
                <th className="p-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t-2 border-foreground/10 align-top">
                  <td className="p-2 whitespace-nowrap text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</td>
                  <td className="p-2 max-w-xs">
                    <div className="font-display text-xs truncate">{r.ticket_subject ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{r.ticket_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-2"><Badge variant="outline">{r.event_type.replace(/_/g, " ")}</Badge></td>
                  <td className="p-2 text-xs">
                    {r.from_value && <span className="line-through text-muted-foreground mr-1">{r.from_value}</span>}
                    {r.to_value ?? (r.metadata?.file_name ?? r.metadata?.preview ?? "—")}
                  </td>
                  <td className="p-2 text-xs">{r.actor_name ?? r.actor_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminBusinessActivityLog;