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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { differenceInHours } from "date-fns";
import { MoreHorizontal, ExternalLink, UserCheck, MessageSquare, Ticket, AlertTriangle } from "lucide-react";

const PAGE_SIZE = 10;

// SLA hours by priority
const SLA_HOURS: Record<string, number> = {
  urgent: 4,
  high: 12,
  medium: 24,
  low: 48,
};

type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to: string | null;
  profile?: {
    account_number: string | null;
  } | null;
};

const TicketsSLAQueueContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets-sla-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: tickets, error, count } = await supabase
        .from("support_tickets")
        .select("id, user_id, subject, status, priority, created_at, assigned_to", { count: "exact" })
        .neq("status", "closed")
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles for all tickets
      const userIds = [...new Set((tickets || []).map((t) => t.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, account_number")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      // Filter for tickets approaching SLA or overdue
      const now = new Date();
      const slaTickets = (tickets || [])
        .map((ticket) => ({
          ...ticket,
          profile: profileMap.get(ticket.user_id) || null,
        }))
        .filter((ticket) => {
          const createdAt = new Date(ticket.created_at);
          const slaHours = SLA_HOURS[ticket.priority] || 24;
          const hoursElapsed = differenceInHours(now, createdAt);
          const hoursRemaining = slaHours - hoursElapsed;
          return hoursRemaining <= 24;
        });

      return { tickets: slaTickets as SupportTicket[], total: count || 0 };
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
      queryClient.invalidateQueries({ queryKey: ["tickets-sla-queue"] });
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

  const getSLAStatus = (ticket: SupportTicket) => {
    const createdAt = new Date(ticket.created_at);
    const slaHours = SLA_HOURS[ticket.priority] || 24;
    const hoursElapsed = differenceInHours(new Date(), createdAt);
    const hoursRemaining = slaHours - hoursElapsed;

    if (hoursRemaining < 0) {
      return { label: `${Math.abs(hoursRemaining)}h overdue`, variant: "destructive" as const };
    }
    if (hoursRemaining <= 4) {
      return { label: `${hoursRemaining}h left`, variant: "destructive" as const };
    }
    return { label: `${hoursRemaining}h left`, variant: "secondary" as const };
  };

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const tickets = data?.tickets || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          <h2 className="font-display text-lg">Tickets SLA Queue</h2>
          <Badge variant="secondary">{tickets.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tickets")}>
          View all
        </Button>
      </div>

      {tickets.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No tickets approaching SLA breach.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>SLA Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const slaStatus = getSLAStatus(ticket);
                return (
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {slaStatus.label.includes("overdue") && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                        <Badge variant={slaStatus.variant}>{slaStatus.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ticket.assigned_to ? "Assigned" : "Unassigned"}
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
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/admin/tickets?id=${ticket.id}&action=note`)
                            }
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Add internal note
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
                  (p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        onClick={() => setPage(p)}
                        isActive={page === p}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </Card>
  );
};

export const TicketsSLAQueue = () => (
  <QueueErrorBoundary queueName="Tickets SLA">
    <TicketsSLAQueueContent />
  </QueueErrorBoundary>
);
