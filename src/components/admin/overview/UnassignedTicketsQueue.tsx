import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, UserCheck, UserX } from "lucide-react";

const PAGE_SIZE = 10;

type UnassignedTicket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  profile?: {
    account_number: string | null;
  } | null;
};

const UnassignedTicketsQueueContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["unassigned-tickets-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: tickets, error, count } = await supabase
        .from("support_tickets")
        .select("id, user_id, subject, status, priority, created_at", { count: "exact" })
        .is("assigned_to", null)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set((tickets || []).map((t) => t.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, account_number")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const enrichedTickets: UnassignedTicket[] = (tickets || []).map((ticket) => ({
        ...ticket,
        profile: profileMap.get(ticket.user_id) || null,
      }));

      return { tickets: enrichedTickets, total: count || 0 };
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("support_tickets")
        .update({ assigned_to: session.session.user.id })
        .eq("id", ticketId);

      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "support_ticket",
        entityId: ticketId,
        metadata: { action: "assigned_to_self", source: "overview_queue" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unassigned-tickets-queue"] });
      toast({ title: "Ticket assigned to you" });
    },
    onError: (error) => {
      toast({
        title: "Failed to assign ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const tickets = data?.tickets || [];

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-amber-600" />
          <h2 className="font-display text-lg">Unassigned Tickets</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/tickets?assigned=none")}
        >
          View all
        </Button>
      </div>

      {tickets.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          All tickets are assigned.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket ID</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Age</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-xs">
                  {ticket.id.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">
                    {ticket.profile?.account_number || "—"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {ticket.subject}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      ticket.priority === "urgent"
                        ? "destructive"
                        : ticket.priority === "high"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {ticket.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(ticket.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`/admin/tickets?id=${ticket.id}`)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Ticket
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => assignTicketMutation.mutate(ticket.id)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Assign to me
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};

export const UnassignedTicketsQueue = () => (
  <QueueErrorBoundary queueName="Unassigned Tickets">
    <UnassignedTicketsQueueContent />
  </QueueErrorBoundary>
);
