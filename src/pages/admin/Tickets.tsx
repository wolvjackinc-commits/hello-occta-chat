import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TicketReplyDialog } from "@/components/admin/TicketReplyDialog";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusOptions = ["open", "in_progress", "resolved", "closed"] as const;
type TicketStatus = typeof statusOptions[number];

export const AdminTickets = () => {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, user_id, subject, description, status, priority, category, created_at")
        .order("created_at", { ascending: false });

      const userIds = tickets?.map((ticket) => ticket.user_id) ?? [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      return { tickets: tickets ?? [], profiles: profiles ?? [] };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    data?.profiles.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [data?.profiles]);

  const handleStatusChange = async (ticketId: string, status: TicketStatus, ticketSubject?: string) => {
    const ticket = data?.tickets.find(t => t.id === ticketId);
    const previousStatus = ticket?.status;
    
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }

    // Log audit
    await logAudit({
      action: status === 'closed' ? 'close' : 'update',
      entity: 'support_ticket',
      entityId: ticketId,
      metadata: {
        previousStatus,
        newStatus: status,
        subject: ticketSubject,
      },
    });

    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Ticket inbox</h1>
        <p className="text-muted-foreground">Respond quickly to issues and manage replies.</p>
      </div>

      <div className="grid gap-4">
        {data?.tickets.map((ticket) => (
          <Card key={ticket.id} className="border-2 border-foreground p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{ticket.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {profileMap.get(ticket.user_id)?.full_name || "Customer"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </div>
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
                <Button
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setSelectedProfile(profileMap.get(ticket.user_id));
                    setDialogOpen(true);
                  }}
                >
                  Reply
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {(!data?.tickets || data.tickets.length === 0) && (
          <Card className="border-2 border-foreground p-8 text-center">
            <p className="text-muted-foreground">No tickets found.</p>
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
    </div>
  );
};
