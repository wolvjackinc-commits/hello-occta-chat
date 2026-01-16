import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, formatDistanceToNow } from "date-fns";
import { fetchRecentAuditLogs } from "@/lib/audit";
import { ScrollArea } from "@/components/ui/scroll-area";

const kpiCardClass = "rounded-lg border-2 border-foreground bg-card p-4";

export const AdminOverview = () => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data: kpis } = useQuery({
    queryKey: ["admin-overview-kpis"],
    queryFn: async () => {
      const [profiles, openTickets, pendingGuest, installsToday, installsWeek, urgentTickets, activeServices, overdueInvoices, activeMandates] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("support_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"]),
          supabase
            .from("guest_orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("installation_bookings")
            .select("id", { count: "exact", head: true })
            .gte("created_at", format(today, "yyyy-MM-dd"))
            .lte("created_at", format(today, "yyyy-MM-dd") + "T23:59:59"),
          supabase
            .from("installation_bookings")
            .select("id", { count: "exact", head: true })
            .gte("created_at", format(weekStart, "yyyy-MM-dd"))
            .lte("created_at", format(weekEnd, "yyyy-MM-dd") + "T23:59:59"),
          supabase
            .from("support_tickets")
            .select("id", { count: "exact", head: true })
            .eq("priority", "urgent")
            .neq("status", "closed"),
          supabase
            .from("services")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("status", "overdue"),
          supabase
            .from("dd_mandates")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

      return {
        customers: profiles.count || 0,
        openTickets: openTickets.count || 0,
        pendingGuestOrders: pendingGuest.count || 0,
        installsToday: installsToday.count || 0,
        installsWeek: installsWeek.count || 0,
        urgentItems: urgentTickets.count || 0,
        activeServices: activeServices.count || 0,
        overdueInvoices: overdueInvoices.count || 0,
        activeMandates: activeMandates.count || 0,
      };
    },
  });

  const { data: workQueues } = useQuery({
    queryKey: ["admin-overview-queues"],
    queryFn: async () => {
      const [pendingOrders, slaTickets, guestVerify] = await Promise.all([
        supabase
          .from("orders")
          .select("id, user_id, service_type, status, created_at")
          .in("status", ["pending", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("support_tickets")
          .select("id, subject, priority, created_at")
          .eq("status", "open")
          .order("created_at", { ascending: true })
          .limit(5),
        supabase
          .from("guest_orders")
          .select("id, order_number, full_name, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        pendingOrders: pendingOrders.data || [],
        slaTickets: slaTickets.data || [],
        guestVerify: guestVerify.data || [],
      };
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["admin-overview-audit-logs"],
    queryFn: () => fetchRecentAuditLogs(10),
  });

  const formatAuditAction = (action: string, entity: string) => {
    const actionLabels: Record<string, string> = {
      create: "Created",
      update: "Updated",
      delete: "Deleted",
      suspend: "Suspended",
      resume: "Resumed",
      cancel: "Cancelled",
      activate: "Activated",
      reply: "Replied to",
      close: "Closed",
      reopen: "Reopened",
      mark_paid: "Marked paid",
      void: "Voided",
    };
    return `${actionLabels[action] || action} ${entity.replace("_", " ")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Operations overview</h1>
        <p className="text-muted-foreground">Daily health checks and work queues for the admin team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Total customers</div>
          <div className="text-3xl font-display">{kpis?.customers ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Active services</div>
          <div className="text-3xl font-display">{kpis?.activeServices ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Open tickets</div>
          <div className="text-3xl font-display">{kpis?.openTickets ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Overdue invoices</div>
          <div className="text-3xl font-display">{kpis?.overdueInvoices ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Active DD mandates</div>
          <div className="text-3xl font-display">{kpis?.activeMandates ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Pending guest orders</div>
          <div className="text-3xl font-display">{kpis?.pendingGuestOrders ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Installations today</div>
          <div className="text-3xl font-display">{kpis?.installsToday ?? "—"}</div>
        </div>
        <div className={kpiCardClass}>
          <div className="text-xs uppercase text-muted-foreground">Urgent tickets</div>
          <div className="text-3xl font-display">{kpis?.urgentItems ?? "—"}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="border-2 border-foreground p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Pending activations</h2>
            <Badge variant="outline">Queue</Badge>
          </div>
          <div className="space-y-3">
            {workQueues?.pendingOrders.map((order) => (
              <div key={order.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{order.service_type} order</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
            {!workQueues?.pendingOrders.length && (
              <p className="text-sm text-muted-foreground">No pending activations.</p>
            )}
          </div>
        </Card>

        <Card className="border-2 border-foreground p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Open tickets</h2>
            <Badge variant="outline">Urgent</Badge>
          </div>
          <div className="space-y-3">
            {workQueues?.slaTickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate("/admin/tickets")}
              >
                <div className="text-sm font-medium truncate">{ticket.subject}</div>
                <div className="text-xs text-muted-foreground">{ticket.priority} priority</div>
              </div>
            ))}
            {!workQueues?.slaTickets.length && (
              <p className="text-sm text-muted-foreground">No open tickets.</p>
            )}
          </div>
        </Card>

        <Card className="border-2 border-foreground p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Guest orders</h2>
            <Badge variant="outline">Verification</Badge>
          </div>
          <div className="space-y-3">
            {workQueues?.guestVerify.map((order) => (
              <div key={order.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{order.full_name}</div>
                <div className="text-xs text-muted-foreground">Order {order.order_number}</div>
              </div>
            ))}
            {!workQueues?.guestVerify.length && (
              <p className="text-sm text-muted-foreground">No guest orders waiting.</p>
            )}
          </div>
        </Card>

        <Card className="border-2 border-foreground p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Recent activity</h2>
            <Badge variant="outline">Audit</Badge>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {auditLogs?.map((log: any) => (
                <div key={log.id} className="rounded-md border border-border p-2">
                  <div className="text-xs font-medium">{formatAuditAction(log.action, log.entity)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
              {(!auditLogs || auditLogs.length === 0) && (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};
