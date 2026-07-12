import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { LifeBuoy, MessageCircle, Plus, Search, ChevronRight, Bell, CheckCheck } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";
import { RaiseTicketDialog } from "@/components/app/RaiseTicketDialog";
import { TicketDetailDialog } from "@/components/dashboard/TicketDetailDialog";
import {
  getReadMap,
  isTicketUnread,
  markAllTicketsRead,
  markTicketRead,
  TICKETS_READ_EVENT,
} from "@/lib/ticketRead";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at?: string | null;
  description?: string | null;
  category?: string | null;
};

const priorityStyles: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground border-foreground",
  high: "bg-warning text-foreground border-foreground",
  normal: "bg-secondary text-foreground border-foreground",
  medium: "bg-secondary text-foreground border-foreground",
  low: "bg-muted text-muted-foreground border-foreground",
};

const STATUS_FILTER_KEY = "occta:tickets:status-filter";
const VALID_TICKET_STATUS = new Set(["all", "open", "awaiting", "in_progress"]);

export function SupportTab({ tickets, userId }: { tickets: Ticket[]; userId?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const statusFilter = (() => {
    const url = searchParams.get("ticketStatus");
    if (url && VALID_TICKET_STATUS.has(url)) return url;
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(STATUS_FILTER_KEY);
    return stored && VALID_TICKET_STATUS.has(stored) ? stored : "all";
  })();
  const setStatusFilter = (v: string) => {
    try { window.localStorage.setItem(STATUS_FILTER_KEY, v); } catch {}
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("ticketStatus");
    else next.set("ticketStatus", v);
    setSearchParams(next, { replace: true });
  };
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [readVersion, setReadVersion] = useState(0);
  useEffect(() => {
    const bump = () => setReadVersion((v) => v + 1);
    window.addEventListener(TICKETS_READ_EVENT, bump);
    return () => window.removeEventListener(TICKETS_READ_EVENT, bump);
  }, []);
  const readMap = useMemo(() => (userId ? getReadMap(userId) : {}), [userId, readVersion, tickets]);
  const isUnread = (t: Ticket) => (userId ? isTicketUnread(userId, t, readMap) : false);
  const unreadCount = useMemo(
    () => (userId ? tickets.filter((t) => isTicketUnread(userId, t, readMap)).length : 0),
    [tickets, readMap, userId]
  );
  const q = search.trim().toLowerCase();

  const { open, closed } = useMemo(() => {
    const filt = (t: Ticket) => {
      if (q && !t.subject.toLowerCase().includes(q)) return false;
      if (statusFilter === "awaiting" && t.status !== "waiting_customer") return false;
      if (statusFilter === "in_progress" && t.status !== "in_progress") return false;
      if (statusFilter === "open" && !(t.status === "open" || t.status === "in_progress" || t.status === "waiting_customer" || t.status === "waiting_occta")) return false;
      return true;
    };
    const sortByActivity = (a: Ticket, b: Ticket) => {
      const ta = new Date(a.updated_at || a.created_at).getTime();
      const tb = new Date(b.updated_at || b.created_at).getTime();
      return tb - ta;
    };
    return {
      open: tickets
        .filter(t => (t.status === "open" || t.status === "in_progress" || t.status === "waiting_customer" || t.status === "waiting_occta") && filt(t))
        .sort(sortByActivity),
      closed: tickets
        .filter(t => (t.status === "resolved" || t.status === "closed") && filt(t) && statusFilter !== "awaiting" && statusFilter !== "open" && statusFilter !== "in_progress")
        .sort(sortByActivity),
    };
  }, [tickets, q, statusFilter]);

  const onChat = () => {
    logClientEvent({ event_type: "support_cta_click", title: "open_ai_chat", source_module: "dashboard" });
    window.dispatchEvent(new Event("open-ai-chat"));
  };

  const openTicket = (t: Ticket) => {
    logClientEvent({ event_type: "support_cta_click", title: "ticket.open", source_module: "dashboard" });
    if (userId) markTicketRead(userId, t);
    setSelectedTicket(t);
    setDetailOpen(true);
  };

  const markAllRead = () => {
    if (!userId) return;
    markAllTicketsRead(userId, tickets);
  };

  const awaitingReplyCount = tickets.filter(t => t.status === "waiting_customer").length;

  return (
    <div className="space-y-6">
      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 border-4 border-foreground bg-background">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Open</p>
          <p className="font-display text-2xl">{tickets.filter(t => t.status === "open" || t.status === "in_progress").length}</p>
        </div>
        <div className="p-3 border-4 border-foreground bg-background">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Resolved</p>
          <p className="font-display text-2xl">{tickets.filter(t => t.status === "resolved").length}</p>
        </div>
        <div className="p-3 border-4 border-foreground bg-background">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="font-display text-2xl">{tickets.length}</p>
        </div>
      </div>

      {awaitingReplyCount > 0 && (
        <div className="p-3 border-4 border-warning bg-warning/10 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <p className="text-sm">
            <strong>{awaitingReplyCount}</strong> ticket{awaitingReplyCount === 1 ? " needs" : "s need"} your reply — tap to open and respond.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="hero"
          onClick={() => {
            logClientEvent({ event_type: "support_cta_click", title: "raise_ticket_inline", source_module: "dashboard" });
            setRaiseOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Raise a ticket
        </Button>
        <Button variant="outline" className="border-4 border-foreground" onClick={onChat}>
          <MessageCircle className="w-4 h-4 mr-1" /> Chat with OCCTA AI
        </Button>
        <Link to="/support">
          <Button variant="outline" className="border-2 border-foreground">Full support centre</Button>
        </Link>
        {unreadCount > 0 && (
          <Button variant="outline" className="border-2 border-foreground" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all as read ({unreadCount})
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Need a human? Mention "agent" in chat and we'll escalate.</p>

      {tickets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets by subject…"
              className="pl-9 border-2 border-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-2 border-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tickets</SelectItem>
              <SelectItem value="open">Open only</SelectItem>
              <SelectItem value="awaiting">Awaiting my reply</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <section>
        <h3 className="font-display uppercase mb-3">My open tickets</h3>
        {open.length === 0 ? <EmptyState icon={<LifeBuoy className="w-8 h-8" />} title="No open tickets" /> : (
          <div className="space-y-2">
            {open.map(t => {
              const lastActivity = t.updated_at || t.created_at;
              const needsReply = t.status === "waiting_customer";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t)}
                  className={`w-full text-left p-3 border-4 bg-background flex items-center justify-between gap-3 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_hsl(var(--foreground))] ${
                    needsReply ? "border-warning" : "border-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm truncate">{t.subject}</p>
                      {needsReply && (
                        <Badge className="border-2 border-foreground bg-warning text-foreground text-[10px]">Awaiting you</Badge>
                      )}
                      {isUnread(t) && (
                        <Badge className="border-2 border-foreground bg-primary text-primary-foreground text-[10px]">New</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })} · opened {format(new Date(t.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {t.priority && (
                      <Badge className={`border-2 capitalize text-xs ${priorityStyles[t.priority] || priorityStyles.normal}`}>
                        {t.priority}
                      </Badge>
                    )}
                    <Badge className="border-2 border-foreground capitalize">{t.status.replace(/_/g, " ")}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3 className="font-display uppercase mb-3">Recently closed</h3>
          <div className="space-y-2">
            {closed.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTicket(t)}
                className="w-full text-left p-3 border-2 border-foreground bg-background flex items-center justify-between gap-3 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd MMM yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{t.status}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <RaiseTicketDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        onSubmitted={() => {
          // Give the dashboard a nudge to refresh its ticket list on next mount.
          window.dispatchEvent(new Event("dashboard-refresh-tickets"));
        }}
      />

      <TicketDetailDialog
        ticket={selectedTicket as any}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) {
            // Refresh tickets when the detail dialog closes so status/last-reply times reflect any activity.
            window.dispatchEvent(new Event("dashboard-refresh-tickets"));
          }
        }}
      />
    </div>
  );
}