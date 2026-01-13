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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  Save,
  StickyNote,
} from "lucide-react";

type GuestOrder = {
  id: string;
  order_number: string;
  service_type: string;
  plan_name: string;
  plan_price: number;
  full_name: string;
  email: string;
  phone: string;
  postcode: string;
  city: string;
  address_line1: string;
  address_line2?: string | null;
  current_provider: string | null;
  user_id: string | null;
  linked_at: string | null;
  created_at: string;
  status: string;
  admin_notes?: string | null;
  in_contract?: boolean;
  preferred_switch_date?: string | null;
  selected_addons?: any;
  additional_notes?: string | null;
  gdpr_consent?: boolean;
  marketing_consent?: boolean;
};

type OrderMessage = {
  id: string;
  order_id: string;
  order_type: string;
  sender_id: string;
  sender_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type GuestOrderStatus = 'pending' | 'processing' | 'dispatched' | 'installed' | 'active' | 'cancelled';

const statusOptions: GuestOrderStatus[] = ['pending', 'processing', 'dispatched', 'installed', 'active', 'cancelled'];

const statusColors: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-accent text-accent-foreground",
  dispatched: "bg-secondary text-secondary-foreground",
  installed: "bg-primary/80 text-primary-foreground",
  active: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

interface OrderDetailDialogProps {
  order: GuestOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updatedOrder: GuestOrder) => void;
}

export function OrderDetailDialog({ order, open, onOpenChange, onUpdate }: OrderDetailDialogProps) {
  const { toast } = useToast();
  const [editedOrder, setEditedOrder] = useState<GuestOrder | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (order) {
      setEditedOrder({ ...order });
      setAdminNotes(order.admin_notes || "");
      fetchMessages();
    }
  }, [order]);

  const fetchMessages = async () => {
    if (!order) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", order.id)
        .eq("order_type", "guest_order")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      logError("OrderDetailDialog.fetchMessages", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleFieldChange = (field: keyof GuestOrder, value: string) => {
    if (editedOrder) {
      setEditedOrder({ ...editedOrder, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!editedOrder || !order) return;
    setIsSaving(true);

    const statusChanged = order.status !== editedOrder.status;
    const previousStatus = order.status;

    try {
      const { error } = await supabase
        .from("guest_orders")
        .update({
          full_name: editedOrder.full_name,
          email: editedOrder.email,
          phone: editedOrder.phone,
          address_line1: editedOrder.address_line1,
          address_line2: editedOrder.address_line2,
          city: editedOrder.city,
          postcode: editedOrder.postcode,
          plan_name: editedOrder.plan_name,
          plan_price: editedOrder.plan_price,
          status: editedOrder.status,
          admin_notes: adminNotes,
        })
        .eq("id", editedOrder.id);

      if (error) throw error;

      // Send status update email if status changed
      if (statusChanged && editedOrder.email) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-email", {
            body: {
              type: "status_update",
              to: editedOrder.email,
              data: {
                full_name: editedOrder.full_name,
                order_number: editedOrder.order_number,
                status: editedOrder.status,
                plan_name: editedOrder.plan_name,
                service_type: editedOrder.service_type,
              },
            },
          });
          if (emailError) throw emailError;
          toast({ 
            title: "Order updated successfully",
            description: `Status changed from ${previousStatus} to ${editedOrder.status}. Customer notified via email.`
          });
        } catch (emailError) {
          logError("OrderDetailDialog.sendStatusEmail", emailError);
          toast({ 
            title: "Order updated, but email failed",
            description: "The order was updated but we couldn't send the notification email.",
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Order updated successfully" });
      }

      onUpdate({ ...editedOrder, admin_notes: adminNotes });
    } catch (error) {
      logError("OrderDetailDialog.handleSave", error);
      toast({ title: "Failed to update order", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!editedOrder || !newMessage.trim()) return;
    setIsSendingMessage(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { error: insertError } = await supabase
        .from("order_messages")
        .insert({
          order_id: editedOrder.id,
          order_type: "guest_order",
          sender_id: user.id,
          sender_type: "admin",
          message: newMessage.trim(),
        });

      if (insertError) throw insertError;

      // Send email notification to customer
      if (editedOrder.email) {
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            type: "order_message",
            to: editedOrder.email,
            data: {
              full_name: editedOrder.full_name,
              order_number: editedOrder.order_number,
              message: newMessage.trim(),
            },
          },
        });
        if (emailError) throw emailError;
      }

      toast({ title: "Message sent to customer" });
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      logError("OrderDetailDialog.handleSendMessage", error);
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!editedOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <Package className="w-6 h-6" />
            ORDER #{editedOrder.order_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3 border-4 border-foreground bg-background">
            <TabsTrigger value="details" className="font-display uppercase data-[state=active]:bg-foreground data-[state=active]:text-background">
              <FileText className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="notes" className="font-display uppercase data-[state=active]:bg-foreground data-[state=active]:text-background">
              <StickyNote className="w-4 h-4 mr-2" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="messages" className="font-display uppercase data-[state=active]:bg-foreground data-[state=active]:text-background">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages ({messages.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="details" className="space-y-6 pr-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                <Label className="font-display uppercase w-24">Status</Label>
                <Select
                  value={editedOrder.status}
                  onValueChange={(value) => handleFieldChange("status", value)}
                >
                  <SelectTrigger className={`w-40 border-2 border-foreground ${statusColors[editedOrder.status]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status} className="uppercase">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="ml-auto uppercase">
                  {editedOrder.service_type}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <User className="w-5 h-5" /> CUSTOMER INFORMATION
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-display uppercase text-sm">Full Name</Label>
                    <Input
                      value={editedOrder.full_name}
                      onChange={(e) => handleFieldChange("full_name", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Email</Label>
                    <Input
                      value={editedOrder.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Phone</Label>
                    <Input
                      value={editedOrder.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Current Provider</Label>
                    <Input
                      value={editedOrder.current_provider || ""}
                      disabled
                      className="mt-1 border-2 border-foreground bg-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> ADDRESS
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label className="font-display uppercase text-sm">Address Line 1</Label>
                    <Input
                      value={editedOrder.address_line1}
                      onChange={(e) => handleFieldChange("address_line1", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="font-display uppercase text-sm">Address Line 2</Label>
                    <Input
                      value={editedOrder.address_line2 || ""}
                      onChange={(e) => handleFieldChange("address_line2", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">City</Label>
                    <Input
                      value={editedOrder.city}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Postcode</Label>
                    <Input
                      value={editedOrder.postcode}
                      onChange={(e) => handleFieldChange("postcode", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Plan Info */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <Package className="w-5 h-5" /> PLAN DETAILS
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-display uppercase text-sm">Plan Name</Label>
                    <Input
                      value={editedOrder.plan_name}
                      onChange={(e) => handleFieldChange("plan_name", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Price (£/mo)</Label>
                    <Input
                      type="number"
                      value={editedOrder.plan_price}
                      onChange={(e) => handleFieldChange("plan_price", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                </div>
                {editedOrder.selected_addons && Array.isArray(editedOrder.selected_addons) && editedOrder.selected_addons.length > 0 && (
                  <div>
                    <Label className="font-display uppercase text-sm">Add-ons</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editedOrder.selected_addons.map((addon: any, i: number) => (
                        <Badge key={i} variant="outline" className="border-2 border-foreground">
                          {addon.name} - £{addon.price}/mo
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="border-4 border-foreground p-4 bg-secondary">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-display">{format(new Date(editedOrder.created_at), "dd MMM yyyy HH:mm")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GDPR Consent:</span>
                    <p className="font-display">{editedOrder.gdpr_consent ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Marketing:</span>
                    <p className="font-display">{editedOrder.marketing_consent ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 pr-4">
              <div>
                <Label className="font-display uppercase">Internal Admin Notes</Label>
                <p className="text-sm text-muted-foreground mb-2">These notes are only visible to admins.</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this order..."
                  className="min-h-[200px] border-4 border-foreground"
                />
              </div>
              {editedOrder.additional_notes && (
                <div className="border-4 border-foreground p-4 bg-secondary">
                  <Label className="font-display uppercase">Customer Notes</Label>
                  <p className="mt-2">{editedOrder.additional_notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-4 pr-4">
              <div className="border-4 border-foreground p-4 min-h-[300px] max-h-[400px] overflow-y-auto bg-secondary/50">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 border-2 border-foreground ${
                          msg.sender_type === "admin"
                            ? "bg-primary text-primary-foreground ml-8"
                            : "bg-card mr-8"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs mb-1 opacity-70">
                          <span className="uppercase font-display">{msg.sender_type}</span>
                          <span>•</span>
                          <span>{format(new Date(msg.created_at), "dd MMM HH:mm")}</span>
                        </div>
                        <p>{msg.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Send a message to contact the customer.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message to send to the customer..."
                  className="border-4 border-foreground"
                  rows={2}
                />
                <Button
                  variant="hero"
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !newMessage.trim()}
                  className="px-6"
                >
                  {isSendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Customer will receive an email notification with your message.
              </p>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t-4 border-foreground">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-4 border-foreground">
            Cancel
          </Button>
          <Button variant="hero" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
