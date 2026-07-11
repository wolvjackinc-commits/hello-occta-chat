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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { logAudit } from "@/lib/audit";
import { CheckSquare, Square, Loader2, UserPlus, ExternalLink, StickyNote, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  IncludeArchivedToggle,
  isArchivedLike,
} from "@/components/admin/primitives";

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
  const navigate = useNavigate();
  const [selectedGuestOrder, setSelectedGuestOrder] = useState<GuestOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [promotingId, setPromotingId] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedGuestOrders, setSelectedGuestOrders] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);

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

  const handlePromoteToCustomer = async (order: GuestOrder) => {
    setPromotingId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("promote-guest-to-customer", {
        body: { guest_order_id: order.id },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't activate customer",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Customer activated",
        description: `Account ${(data as any)?.account_number ?? ""} ready. Welcome email sent.`,
      });
      await refetch();
      const acct = (data as any)?.account_number;
      if (acct) navigate(`/admin/customers/${acct}`);
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setPromotingId(null);
    }
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
  const visibleOrders = useMemo(
    () => (includeArchived ? orders : orders.filter((o) => !isArchivedLike(o.status))),
    [orders, includeArchived],
  );
  const visibleGuestOrders = useMemo(
    () => (includeArchived ? guestOrders : guestOrders.filter((o: any) => !isArchivedLike(o?.status))),
    [guestOrders, includeArchived],
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description="Manage orders, transitions, and admin notes."
        actions={
          <IncludeArchivedToggle
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
          />
        }
      />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="guest">Guest orders</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {/* Bulk Actions Bar */}
          {visibleOrders.length > 0 && (
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

          {visibleOrders.length === 0 ? (
            <AdminEmptyState
              icon={<Package className="h-6 w-6" />}
              title="No orders found"
              message={
                includeArchived
                  ? "There are no orders in the system yet."
                  : "No active orders. Enable ‘Include archived/test’ to see cancelled orders."
              }
            />
          ) : (
            <Card className="border-2 border-foreground p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-display uppercase">Order</TableHead>
                    <TableHead className="font-display uppercase">Plan</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Created</TableHead>
                    <TableHead className="font-display uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOrders.map((order) => (
                    <TableRow key={order.id} className="border-b border-foreground/10">
                      <TableCell className="w-8">
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium capitalize">{order.service_type}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {order.id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.plan_name}</TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value: OrderStatus) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
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
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(order.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => setNoteOrder(order)}
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                          Note
                          {order.admin_notes && (
                            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guest" className="space-y-4">
          {/* Bulk Actions Bar for Guest Orders */}
          {visibleGuestOrders.length > 0 && (
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

          {visibleGuestOrders.map((order) => (
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {order.user_id ? (
                        <Badge variant="outline" className="border-2 border-foreground text-[10px]">Linked customer</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-2 border-foreground text-[10px]">No customer account</Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">{order.email}</span>
                    </div>
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
                  {!order.user_id ? (
                    <Button
                      variant="hero"
                      onClick={() => handlePromoteToCustomer(order)}
                      disabled={promotingId === order.id}
                      className="gap-2"
                      title="Activates customer account and sends welcome email"
                    >
                      {promotingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Activate customer
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="border-2 border-foreground gap-2"
                      onClick={async () => {
                        const { data: p } = await supabase.from("profiles").select("account_number").eq("id", order.user_id).maybeSingle();
                        if (p?.account_number) navigate(`/admin/customers/${p.account_number}`);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" /> Open Customer 360
                    </Button>
                  )}
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
          {visibleGuestOrders.length === 0 && (
            <AdminEmptyState
              icon={<Package className="h-6 w-6" />}
              title="No guest orders found"
              message={
                includeArchived
                  ? "There are no guest orders yet."
                  : "No active guest orders. Enable ‘Include archived/test’ to see cancelled orders."
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <AdminDrawer
        open={!!noteOrder}
        onOpenChange={(o) => !o && setNoteOrder(null)}
        title="Admin note"
        description={
          noteOrder ? `${noteOrder.service_type} · ${noteOrder.plan_name}` : ""
        }
      >
        {noteOrder && (
          <div className="space-y-3">
            <Textarea
              placeholder="Admin note (internal only)"
              value={notes[noteOrder.id] ?? noteOrder.admin_notes ?? ""}
              onChange={(event) =>
                setNotes((prev) => ({ ...prev, [noteOrder.id]: event.target.value }))
              }
              className="min-h-[160px] border-2 border-foreground"
            />
            <Button
              className="border-2 border-foreground"
              onClick={async () => {
                await handleSaveNote(noteOrder.id);
                setNoteOrder(null);
              }}
            >
              Save note
            </Button>
          </div>
        )}
      </AdminDrawer>

      <OrderDetailDialog
        order={selectedGuestOrder}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={() => refetch()}
      />
    </div>
  );
};
