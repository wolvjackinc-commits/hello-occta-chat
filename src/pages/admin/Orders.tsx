import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { logAudit } from "@/lib/audit";
import { CheckSquare, Square, Loader2 } from "lucide-react";

const orderStatuses = ["pending", "confirmed", "active", "cancelled"] as const;
type OrderStatus = (typeof orderStatuses)[number];

const guestStatuses = ["pending", "processing", "dispatched", "installed", "active", "cancelled"] as const;
type GuestStatus = (typeof guestStatuses)[number];

// Use any for GuestOrder to match OrderDetailDialog expectations
type GuestOrder = any;

type Order = {
  id: string;
  service_type: string;
  plan_name: string;
  status: OrderStatus;
  admin_notes?: string | null;
  created_at: string;
};

export const AdminOrders = () => {
  const { toast } = useToast();
  const [selectedGuestOrder, setSelectedGuestOrder] = useState<GuestOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedGuestOrders, setSelectedGuestOrders] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [orders, guestOrders] = await Promise.all([
        supabase.from("orders").select("id, service_type, plan_name, status, notes, created_at").order("created_at", { ascending: false }),
        supabase.from("guest_orders").select("*").order("created_at", { ascending: false }),
      ]);

      return {
        orders: (orders.data || []).map((order) => ({
          ...order,
          admin_notes: order.notes ?? null,
        })) as Order[],
        guestOrders: (guestOrders.data || []) as GuestOrder[],
      };
    },
  });

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    await logAudit({ action: "update", entity: "service", entityId: id, metadata: { status } });
    toast({ title: "Order updated" });
    refetch();
  };

  const handleGuestStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("guest_orders").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    await logAudit({ action: "update", entity: "service", entityId: id, metadata: { status, type: "guest_order" } });
    toast({ title: "Guest order updated" });
    refetch();
  };

  const handleSaveNote = async (orderId: string) => {
    const note = notes[orderId];
    const { error } = await supabase.from("orders").update({ notes: note }).eq("id", orderId);
    if (error) {
      toast({ title: "Failed to save note", variant: "destructive" });
      return;
    }
    toast({ title: "Note saved" });
    refetch();
  };

  // Bulk actions for orders
  const handleBulkStatusChange = async (status: OrderStatus) => {
    if (selectedOrders.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedOrders);
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .in("id", ids);
      
      if (error) throw error;
      
      // Log audit for each order
      for (const id of ids) {
        await logAudit({ action: "update", entity: "service", entityId: id, metadata: { status, bulk: true } });
      }
      
      toast({ title: `Updated ${ids.length} order(s) to ${status}` });
      setSelectedOrders(new Set());
      refetch();
    } catch (error) {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk actions for guest orders
  const handleBulkGuestStatusChange = async (status: GuestStatus) => {
    if (selectedGuestOrders.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedGuestOrders);
      const { error } = await supabase
        .from("guest_orders")
        .update({ status })
        .in("id", ids);
      
      if (error) throw error;
      
      // Log audit for each order
      for (const id of ids) {
        await logAudit({ action: "update", entity: "service", entityId: id, metadata: { status, type: "guest_order", bulk: true } });
      }
      
      toast({ title: `Updated ${ids.length} guest order(s) to ${status}` });
      setSelectedGuestOrders(new Set());
      refetch();
    } catch (error) {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Toggle selection helpers
  const toggleOrderSelection = (id: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOrders(newSet);
  };

  const toggleGuestOrderSelection = (id: string) => {
    const newSet = new Set(selectedGuestOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedGuestOrders(newSet);
  };

  const selectAllOrders = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.id)));
    }
  };

  const selectAllGuestOrders = () => {
    if (selectedGuestOrders.size === guestOrders.length) {
      setSelectedGuestOrders(new Set());
    } else {
      setSelectedGuestOrders(new Set(guestOrders.map((o) => o.id)));
    }
  };

  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const guestOrders = useMemo(() => data?.guestOrders ?? [], [data?.guestOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Orders</h1>
        <p className="text-muted-foreground">Manage orders, transitions, and admin notes.</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="guest">Guest orders</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {/* Bulk Actions Bar */}
          {orders.length > 0 && (
            <Card className="border-2 border-foreground p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllOrders}
                  className="border-2 border-foreground gap-2"
                >
                  {selectedOrders.size === orders.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selectedOrders.size === orders.length ? "Deselect All" : "Select All"}
                </Button>
                
                {selectedOrders.size > 0 && (
                  <>
                    <Badge variant="secondary" className="border-2 border-foreground">
                      {selectedOrders.size} selected
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Bulk update to:</span>
                      {orderStatuses.map((status) => (
                        <Button
                          key={status}
                          variant="outline"
                          size="sm"
                          onClick={() => handleBulkStatusChange(status)}
                          disabled={isBulkUpdating}
                          className="border-2 border-foreground capitalize"
                        >
                          {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : status}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {orders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedOrders.has(order.id)}
                    onCheckedChange={() => toggleOrderSelection(order.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{order.service_type} · {order.plan_name}</div>
                    <div className="text-xs text-muted-foreground">{order.id}</div>
                  </div>
                </div>
                <Select value={order.status} onValueChange={(value: OrderStatus) => handleStatusChange(order.id, value)}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 space-y-2 pl-7">
                <Textarea
                  placeholder="Admin note"
                  value={notes[order.id] ?? order.admin_notes ?? ""}
                  onChange={(event) =>
                    setNotes((prev) => ({ ...prev, [order.id]: event.target.value }))
                  }
                />
                <Button onClick={() => handleSaveNote(order.id)}>Save note</Button>
              </div>
            </Card>
          ))}
          {orders.length === 0 && (
            <Card className="border-2 border-foreground p-8 text-center">
              <p className="text-muted-foreground">No orders found.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guest" className="space-y-4">
          {/* Bulk Actions Bar for Guest Orders */}
          {guestOrders.length > 0 && (
            <Card className="border-2 border-foreground p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllGuestOrders}
                  className="border-2 border-foreground gap-2"
                >
                  {selectedGuestOrders.size === guestOrders.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selectedGuestOrders.size === guestOrders.length ? "Deselect All" : "Select All"}
                </Button>
                
                {selectedGuestOrders.size > 0 && (
                  <>
                    <Badge variant="secondary" className="border-2 border-foreground">
                      {selectedGuestOrders.size} selected
                    </Badge>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">Bulk update to:</span>
                      {guestStatuses.map((status) => (
                        <Button
                          key={status}
                          variant="outline"
                          size="sm"
                          onClick={() => handleBulkGuestStatusChange(status)}
                          disabled={isBulkUpdating}
                          className="border-2 border-foreground capitalize"
                        >
                          {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : status}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {guestOrders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedGuestOrders.has(order.id)}
                    onCheckedChange={() => toggleGuestOrderSelection(order.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{order.full_name}</div>
                    <div className="text-xs text-muted-foreground">Order {order.order_number}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Select value={order.status} onValueChange={(value) => handleGuestStatusChange(order.id, value)}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {guestStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedGuestOrder(order);
                      setDialogOpen(true);
                    }}
                  >
                    View detail
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {guestOrders.length === 0 && (
            <Card className="border-2 border-foreground p-8 text-center">
              <p className="text-muted-foreground">No guest orders found.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <OrderDetailDialog
        order={selectedGuestOrder}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={() => refetch()}
      />
    </div>
  );
};
