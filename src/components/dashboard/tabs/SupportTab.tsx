import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow } from "date-fns";
import { LifeBuoy, MessageCircle, Plus, Search } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type Ticket = { id: string; subject: string; status: string; priority: string; created_at: string };

const priorityStyles: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground border-foreground",
  high: "bg-warning text-foreground border-foreground",
  normal: "bg-secondary text-foreground border-foreground",
  medium: "bg-secondary text-foreground border-foreground",
  low: "bg-muted text-muted-foreground border-foreground",
};

export function SupportTab({ tickets }: { tickets: Ticket[] }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const { open, closed } = useMemo(() => {
    const filt = (t: Ticket) => !q || t.subject.toLowerCase().includes(q);
    return {
      open: tickets.filter(t => (t.status === "open" || t.status === "in_progress") && filt(t)),
      closed: tickets.filter(t => (t.status === "resolved" || t.status === "closed") && filt(t)),
    };
  }, [tickets, q]);

  const onChat = () => {
    logClientEvent({ event_type: "support_cta_click", title: "open_ai_chat", source_module: "dashboard" });
    window.dispatchEvent(new Event("open-ai-chat"));
  };

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

      <div className="flex flex-wrap gap-3">
        <Link to="/support" onClick={() => logClientEvent({ event_type: "support_cta_click", title: "create_ticket", source_module: "dashboard" })}>
          <Button variant="hero"><Plus className="w-4 h-4 mr-1" /> Create support ticket</Button>
        </Link>
        <Button variant="outline" className="border-4 border-foreground" onClick={onChat}>
          <MessageCircle className="w-4 h-4 mr-1" /> Chat with OCCTA AI
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Need a human? Mention "agent" in chat and we'll escalate.</p>

      {tickets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by subject…"
            className="pl-9 border-2 border-foreground"
          />
        </div>
      )}

      <section>
        <h3 className="font-display uppercase mb-3">Open tickets</h3>
        {open.length === 0 ? <EmptyState icon={<LifeBuoy className="w-8 h-8" />} title="No open tickets" /> : (
          <div className="space-y-2">
            {open.map(t => (
              <Link
                key={t.id}
                to="/support"
                className="p-3 border-4 border-foreground bg-background flex items-center justify-between gap-3 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "dd MMM yyyy")} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {t.priority && (
                    <Badge className={`border-2 capitalize text-xs ${priorityStyles[t.priority] || priorityStyles.normal}`}>
                      {t.priority}
                    </Badge>
                  )}
                  <Badge className="border-2 border-foreground capitalize">{t.status.replace("_", " ")}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3 className="font-display uppercase mb-3">Closed tickets</h3>
          <div className="space-y-2">
            {closed.map(t => (
              <div key={t.id} className="p-3 border-2 border-foreground bg-background flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd MMM yyyy")}</p>
                </div>
                <Badge variant="outline" className="capitalize">{t.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}