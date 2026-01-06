import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Save,
  Loader2,
  Wifi,
  Smartphone,
  PhoneCall,
  AlertCircle,
} from "lucide-react";

type Order = {
  id: string;
  user_id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  postcode: string;
  created_at: string;
};

type GuestOrder = {
  id: string;
  order_number: string;
  user_id: string | null;
  service_type: string;
  plan_name: string;
  plan_price: number;
  status: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

interface UserPackagesDialogProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const serviceIcons = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const statusColors: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  confirmed: "bg-accent text-accent-foreground",
  processing: "bg-accent text-accent-foreground",
  dispatched: "bg-secondary text-secondary-foreground",
  installed: "bg-primary/80 text-primary-foreground",
  active: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

export function UserPackagesDialog({ profile, open, onOpenChange, onUpdate }: UserPackagesDialogProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ plan_name: string; plan_price: string; status: string }>({ plan_name: "", plan_price: "", status: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile && open) {
      fetchOrders();
    }
  }, [profile, open]);

  const fetchOrders = async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const [ordersResult, guestOrdersResult] = await Promise.all([
        supabase.from("orders").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("guest_orders").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
      ]);

      if (ordersResult.data) setOrders(ordersResult.data as Order[]);
      if (guestOrdersResult.data) setGuestOrders(guestOrdersResult.data);
    } catch (error) {
      logError("UserPackagesDialog.fetchOrders", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = (order: Order | GuestOrder, type: 'order' | 'guest') => {
    setEditingOrder(`${type}-${order.id}`);
    setEditValues({
      plan_name: order.plan_name,
      plan_price: order.plan_price.toString(),
      status: order.status,
    });
  };

  const handleSaveOrder = async (orderId: string, type: 'order' | 'guest') => {
    setIsSaving(true);
    try {
      const table = type === 'order' ? 'orders' : 'guest_orders';
      const { error } = await supabase
        .from(table)
        .update({
          plan_name: editValues.plan_name,
          plan_price: parseFloat(editValues.plan_price),
          status: editValues.status,
        })
        .eq("id", orderId);

      if (error) throw error;

      toast({ title: "Package updated successfully" });
      setEditingOrder(null);
      fetchOrders();
      onUpdate();
    } catch (error) {
      logError("UserPackagesDialog.handleSaveOrder", error);
      toast({ title: "Failed to update package", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  const allOrders = [
    ...orders.map(o => ({ ...o, type: 'order' as const })),
    ...guestOrders.map(o => ({ ...o, type: 'guest' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <Package className="w-6 h-6" />
            PACKAGES: {profile.full_name || profile.email}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : allOrders.length > 0 ? (
            <div className="space-y-4 pr-4">
              {allOrders.map((order) => {
                const Icon = serviceIcons[order.service_type as keyof typeof serviceIcons] || Package;
                const isEditing = editingOrder === `${order.type}-${order.id}`;

                return (
                  <div
                    key={`${order.type}-${order.id}`}
                    className="p-4 border-4 border-foreground bg-card"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-grow space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <Badge className={`uppercase ${statusColors[order.status]}`}>
                              {order.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(order.created_at), "dd MMM yyyy")}
                            </span>
                          </div>
                          {!isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-2 border-foreground"
                              onClick={() => handleEditOrder(order, order.type)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs uppercase">Plan Name</Label>
                              <Input
                                value={editValues.plan_name}
                                onChange={(e) => setEditValues({ ...editValues, plan_name: e.target.value })}
                                className="border-2 border-foreground"
                              />
                            </div>
                            <div>
                              <Label className="text-xs uppercase">Price (£/mo)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editValues.plan_price}
                                onChange={(e) => setEditValues({ ...editValues, plan_price: e.target.value })}
                                className="border-2 border-foreground"
                              />
                            </div>
                            <div>
                              <Label className="text-xs uppercase">Status</Label>
                              <Select value={editValues.status} onValueChange={(v) => setEditValues({ ...editValues, status: v })}>
                                <SelectTrigger className="border-2 border-foreground">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {order.type === 'order' ? (
                                    <>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="confirmed">Confirmed</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </>
                                  ) : (
                                    <>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="processing">Processing</SelectItem>
                                      <SelectItem value="dispatched">Dispatched</SelectItem>
                                      <SelectItem value="installed">Installed</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3 flex gap-2">
                              <Button
                                variant="hero"
                                size="sm"
                                onClick={() => handleSaveOrder(order.id, order.type)}
                                disabled={isSaving}
                              >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-2 border-foreground"
                                onClick={() => setEditingOrder(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-display text-lg">{order.plan_name}</p>
                              <p className="text-sm text-muted-foreground capitalize">{order.service_type}</p>
                            </div>
                            <p className="font-display text-xl">£{order.plan_price}/mo</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-display text-lg">NO PACKAGES</p>
              <p className="text-muted-foreground">This user has no orders.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
