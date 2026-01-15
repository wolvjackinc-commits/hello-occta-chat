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
import { useToast } from "@/hooks/use-toast";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";

const orderStatuses = ["pending", "confirmed", "active", "cancelled"] as const;
type OrderStatus = typeof orderStatuses[number];

const guestStatuses = ["pending", "processing", "dispatched", "installed", "active", "cancelled"] as const;

type GuestOrder = any;

type Order = {
  id: string;
  service_type: string;
  plan_name: string;
  status: OrderStatus;
  admin_notes?: string | null;
};

export const AdminOrders = () => {
  const { toast } = useToast();
  const [selectedGuestOrder, setSelectedGuestOrder] = useState<GuestOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [orders, guestOrders] = await Promise.all([
        supabase.from("orders").select("id, service_type, plan_name, status, notes").order("created_at", { ascending: false }),
        supabase.from("guest_orders").select("*").order("created_at", { ascending: false }),
      ]);

      return {
        orders: (orders.data || []).map((order) => ({
          ...order,
          admin_notes: order.notes ?? null,
        })) as Order[],
        guestOrders: guestOrders.data || [],
      };
    },
  });

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    toast({ title: "Order updated" });
    refetch();
  };

  const handleGuestStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("guest_orders").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
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
          {orders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{order.service_type} · {order.plan_name}</div>
                  <div className="text-xs text-muted-foreground">{order.id}</div>
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
              <div className="mt-3 space-y-2">
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
          {guestOrders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{order.full_name}</div>
                  <div className="text-xs text-muted-foreground">Order {order.order_number}</div>
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
