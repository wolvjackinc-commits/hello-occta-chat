import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LifeBuoy, MessageCircle, Plus } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type Ticket = { id: string; subject: string; status: string; priority: string; created_at: string };

export function SupportTab({ tickets }: { tickets: Ticket[] }) {
  const open = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const closed = tickets.filter(t => t.status === "resolved" || t.status === "closed");

  const onChat = () => {
    logClientEvent({ event_type: "support_cta_click", title: "open_ai_chat", source_module: "dashboard" });
    window.dispatchEvent(new Event("open-ai-chat"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link to="/support" onClick={() => logClientEvent({ event_type: "support_cta_click", title: "create_ticket", source_module: "dashboard" })}>
          <Button variant="hero"><Plus className="w-4 h-4 mr-1" /> Create support ticket</Button>
        </Link>
        <Button variant="outline" className="border-4 border-foreground" onClick={onChat}>
          <MessageCircle className="w-4 h-4 mr-1" /> Chat with OCCTA AI
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Need a human? Mention "agent" in chat and we'll escalate.</p>

      <section>
        <h3 className="font-display uppercase mb-3">Open tickets</h3>
        {open.length === 0 ? <EmptyState icon={<LifeBuoy className="w-8 h-8" />} title="No open tickets" /> : (
          <div className="space-y-2">
            {open.map(t => (
              <div key={t.id} className="p-3 border-4 border-foreground bg-background flex items-center justify-between">
                <div><p className="font-display text-sm">{t.subject}</p><p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd MMM yyyy")}</p></div>
                <Badge className="border-2 border-foreground capitalize">{t.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3 className="font-display uppercase mb-3">Closed tickets</h3>
          <div className="space-y-2">
            {closed.map(t => (
              <div key={t.id} className="p-3 border-2 border-foreground bg-background flex items-center justify-between">
                <p className="text-sm">{t.subject}</p>
                <Badge variant="outline" className="capitalize">{t.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}