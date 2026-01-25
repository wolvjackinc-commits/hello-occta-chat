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
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, UserCheck, PlayCircle, Package } from "lucide-react";

const PAGE_SIZE = 10;

type Order = {
  id: string;
  user_id: string;
  service_type: string;
  status: string;
  plan_name: string;
  created_at: string;
  admin_notes: string | null;
  profile?: {
    full_name: string | null;
    account_number: string | null;
  } | null;
};

const NewOrdersQueueContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["new-orders-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: orders, error, count } = await supabase
        .from("orders")
        .select("id, user_id, service_type, status, plan_name, created_at, admin_notes", { count: "exact" })
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles for all orders
      const userIds = [...new Set((orders || []).map((o) => o.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, account_number")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const enrichedOrders: Order[] = (orders || []).map((order) => ({
        ...order,
        profile: profileMap.get(order.user_id) || null,
      }));

      return { orders: enrichedOrders, total: count || 0 };
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status?: string; notes?: string }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.admin_notes = notes;

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "service",
        entityId: orderId,
        metadata: { updates, source: "overview_queue" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-orders-queue"] });
      toast({ title: "Order updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const orders = data?.orders || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h2 className="font-display text-lg">New Orders</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/orders")}>
          View all
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No pending orders at this time.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    {order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {order.profile?.account_number || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{order.profile?.full_name || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{order.service_type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={order.status === "pending" ? "secondary" : "default"}
                    >
                      {order.status}
                    </Badge>
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
                          onClick={() => navigate(`/admin/orders?id=${order.id}`)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Order
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateOrderMutation.mutate({
                              orderId: order.id,
                              notes: `Assigned to admin at ${new Date().toISOString()}`,
                            })
                          }
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Assign to me
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateOrderMutation.mutate({
                              orderId: order.id,
                              status: "confirmed",
                            })
                          }
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Mark as confirmed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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

export const NewOrdersQueue = () => (
  <QueueErrorBoundary queueName="New Orders">
    <NewOrdersQueueContent />
  </QueueErrorBoundary>
);
