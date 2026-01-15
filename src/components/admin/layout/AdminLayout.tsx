import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutGrid,
  Mail,
  Shield,
  Settings,
  Ticket,
  Users,
  Wrench,
  Search,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { label: "Overview", to: "/admin/overview", icon: LayoutGrid },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Orders", to: "/admin/orders", icon: ClipboardList },
  { label: "Tickets", to: "/admin/tickets", icon: Ticket },
  { label: "Billing", to: "/admin/billing", icon: BadgeDollarSign },
  { label: "Services", to: "/admin/services", icon: Wrench },
  { label: "Payments & DD", to: "/admin/payments-dd", icon: Activity },
  { label: "Installations", to: "/admin/installations", icon: CalendarDays },
  { label: "Plans", to: "/admin/plans", icon: FileText },
  { label: "Compliance", to: "/admin/compliance", icon: Shield },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

type SearchResult = {
  id: string;
  type: "customer" | "order" | "service" | "guest_order";
  label: string;
  description?: string | null;
  href: string;
};

type QuickActionType =
  | "invoice"
  | "ticket"
  | "note"
  | "suspend"
  | "installation"
  | "email"
  | null;

export const AdminLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAction, setActiveAction] = useState<QuickActionType>(null);
  const [actionPayload, setActionPayload] = useState({
    userId: "",
    subject: "",
    message: "",
    invoiceNumber: "",
    orderId: "",
    amount: "",
    serviceId: "",
    slotId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderNumber: "",
  });

  const searchEnabled = searchTerm.trim().length >= 2;

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["admin-search", searchTerm],
    enabled: searchEnabled,
    queryFn: async () => {
      const term = searchTerm.trim();
      const [profiles, guestOrders, services, orders] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, account_number")
          .or(
            `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,account_number.ilike.%${term}%`
          )
          .limit(10),
        supabase
          .from("guest_orders")
          .select("id, order_number, full_name, email")
          .ilike("order_number", `%${term}%`)
          .limit(5),
        supabase
          .from("services")
          .select("id, user_id, service_type, identifiers, status")
          .or(
            `identifiers->>landline_number.ilike.%${term}%,identifiers->>msisdn.ilike.%${term}%,identifiers->>iccid.ilike.%${term}%,identifiers->>broadband_ref.ilike.%${term}%,identifiers->>account_number.ilike.%${term}%`
          )
          .limit(5),
        supabase
          .from("orders")
          .select("id, user_id, plan_name")
          .ilike("id", `%${term}%`)
          .limit(5),
      ]);

      const results: SearchResult[] = [];

      profiles.data?.forEach((profile) => {
        results.push({
          id: profile.id,
          type: "customer",
          label: profile.full_name || profile.email || "Customer",
          description: profile.account_number || profile.email || profile.phone,
          href: `/admin/customers/${profile.id}`,
        });
      });

      guestOrders.data?.forEach((order) => {
        results.push({
          id: order.id,
          type: "guest_order",
          label: `Guest Order ${order.order_number}`,
          description: order.full_name || order.email,
          href: `/admin/orders?guest=${order.id}`,
        });
      });

      services.data?.forEach((service) => {
        const identifiers = service.identifiers as Record<string, string> | null;
        results.push({
          id: service.id,
          type: "service",
          label: `${service.service_type} service`,
          description: identifiers?.landline_number || identifiers?.msisdn || identifiers?.iccid || service.status,
          href: `/admin/services?service=${service.id}`,
        });
      });

      orders.data?.forEach((order) => {
        results.push({
          id: order.id,
          type: "order",
          label: `Order ${order.id.slice(0, 8)}`,
          description: order.plan_name,
          href: `/admin/orders?order=${order.id}`,
        });
      });

      return results;
    },
  });

  const actionTitle = useMemo(() => {
    switch (activeAction) {
      case "invoice":
        return "Create invoice";
      case "ticket":
        return "Create ticket";
      case "note":
        return "Add customer note";
      case "suspend":
        return "Suspend service";
      case "installation":
        return "Book installation";
      case "email":
        return "Send email";
      default:
        return "";
    }
  }, [activeAction]);

  const handleActionSubmit = async () => {
    try {
      if (activeAction === "invoice") {
        const totals = {
          subtotal: Number(actionPayload.amount || 0),
          vat: 0,
          total: Number(actionPayload.amount || 0),
        };
        const { error } = await supabase.from("invoices").insert({
          invoice_number: actionPayload.invoiceNumber,
          user_id: actionPayload.userId,
          order_id: actionPayload.orderId || null,
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
          status: "draft",
          totals,
        });
        if (error) throw error;
      }

      if (activeAction === "ticket") {
        const { error } = await supabase.from("support_tickets").insert({
          user_id: actionPayload.userId,
          subject: actionPayload.subject,
          description: actionPayload.message,
          status: "open",
          priority: "medium",
        });
        if (error) throw error;
      }

      if (activeAction === "note") {
        const { data: authData } = await supabase.auth.getUser();
        const { error } = await supabase.from("customer_notes").insert({
          user_id: actionPayload.userId,
          note: actionPayload.message,
          visibility: "internal",
          created_by: authData?.user?.id,
        });
        if (error) throw error;
      }

      if (activeAction === "suspend") {
        const { error } = await supabase
          .from("services")
          .update({ status: "suspended" })
          .eq("id", actionPayload.serviceId);
        if (error) throw error;
      }

      if (activeAction === "installation") {
        const { error } = await supabase.from("installation_bookings").insert({
          customer_name: actionPayload.customerName,
          customer_email: actionPayload.customerEmail,
          customer_phone: actionPayload.customerPhone,
          order_id: actionPayload.orderId,
          order_type: "admin",
          slot_id: actionPayload.slotId,
          status: "booked",
        });
        if (error) throw error;
      }

      if (activeAction === "email") {
        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            type: "order_message",
            to: actionPayload.customerEmail,
            data: {
              full_name: actionPayload.customerName || "Customer",
              order_number: actionPayload.orderNumber,
              message: actionPayload.message,
            },
          },
        });
        if (error) throw error;
      }

      toast({ title: "Action completed" });
      setActiveAction(null);
      setActionPayload({
        userId: "",
        subject: "",
        message: "",
        invoiceNumber: "",
        orderId: "",
        amount: "",
        serviceId: "",
        slotId: "",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        orderNumber: "",
      });
    } catch (error) {
      toast({
        title: "Action failed",
        description: "Please check the form details and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="min-h-screen w-64 border-r border-border bg-muted/20 p-6">
          <div className="mb-8 flex items-center gap-2">
            <Badge className="rounded-full px-3 py-1 text-xs uppercase">Admin</Badge>
            <span className="font-display text-lg">Operations Console</span>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition ${
                      isActive
                        ? "border-foreground bg-secondary text-foreground"
                        : "text-muted-foreground hover:border-foreground/40 hover:bg-secondary/60"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-xl">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search customers, orders, landline numbers"
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {isSearching && <Zap className="h-4 w-4 animate-pulse text-muted-foreground" />}
                </div>
                {searchEnabled && searchResults.length > 0 && (
                  <Card className="absolute left-0 right-0 mt-2 max-h-80 overflow-auto border-2 border-foreground bg-background p-2 shadow-xl">
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          className="flex w-full items-start justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm hover:border-foreground hover:bg-secondary/60"
                          onClick={() => navigate(result.href)}
                        >
                          <div>
                            <div className="font-medium">{result.label}</div>
                            {result.description && (
                              <div className="text-xs text-muted-foreground">{result.description}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {result.type.replace("_", " ")}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setActiveAction("invoice")}>
                  Create invoice
                </Button>
                <Button variant="outline" onClick={() => setActiveAction("ticket")}>
                  Create ticket
                </Button>
                <Button variant="outline" onClick={() => setActiveAction("note")}>
                  Add note
                </Button>
                <Button variant="outline" onClick={() => setActiveAction("suspend")}>
                  Suspend service
                </Button>
                <Button variant="outline" onClick={() => setActiveAction("installation")}>
                  Book installation
                </Button>
                <Button variant="outline" onClick={() => setActiveAction("email")}>
                  Send email
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <Dialog open={!!activeAction} onOpenChange={() => setActiveAction(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Mail className="h-5 w-5" />
              {actionTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(activeAction === "invoice" || activeAction === "ticket" || activeAction === "note") && (
              <Input
                placeholder="Customer user ID"
                value={actionPayload.userId}
                onChange={(event) =>
                  setActionPayload((prev) => ({ ...prev, userId: event.target.value }))
                }
              />
            )}
            {activeAction === "invoice" && (
              <>
                <Input
                  placeholder="Invoice number"
                  value={actionPayload.invoiceNumber}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, invoiceNumber: event.target.value }))
                  }
                />
                <Input
                  placeholder="Order ID (optional)"
                  value={actionPayload.orderId}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, orderId: event.target.value }))
                  }
                />
                <Input
                  placeholder="Total amount"
                  type="number"
                  value={actionPayload.amount}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, amount: event.target.value }))
                  }
                />
              </>
            )}
            {activeAction === "ticket" && (
              <>
                <Input
                  placeholder="Subject"
                  value={actionPayload.subject}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, subject: event.target.value }))
                  }
                />
                <Textarea
                  placeholder="Issue description"
                  value={actionPayload.message}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, message: event.target.value }))
                  }
                />
              </>
            )}
            {activeAction === "note" && (
              <Textarea
                placeholder="Internal note"
                value={actionPayload.message}
                onChange={(event) =>
                  setActionPayload((prev) => ({ ...prev, message: event.target.value }))
                }
              />
            )}
            {activeAction === "suspend" && (
              <Input
                placeholder="Service ID"
                value={actionPayload.serviceId}
                onChange={(event) =>
                  setActionPayload((prev) => ({ ...prev, serviceId: event.target.value }))
                }
              />
            )}
            {activeAction === "installation" && (
              <>
                <Input
                  placeholder="Slot ID"
                  value={actionPayload.slotId}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, slotId: event.target.value }))
                  }
                />
                <Input
                  placeholder="Order ID"
                  value={actionPayload.orderId}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, orderId: event.target.value }))
                  }
                />
                <Input
                  placeholder="Customer name"
                  value={actionPayload.customerName}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, customerName: event.target.value }))
                  }
                />
                <Input
                  placeholder="Customer email"
                  value={actionPayload.customerEmail}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, customerEmail: event.target.value }))
                  }
                />
                <Input
                  placeholder="Customer phone"
                  value={actionPayload.customerPhone}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, customerPhone: event.target.value }))
                  }
                />
              </>
            )}
            {activeAction === "email" && (
              <>
                <Input
                  placeholder="Recipient name"
                  value={actionPayload.customerName}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, customerName: event.target.value }))
                  }
                />
                <Input
                  placeholder="Recipient email"
                  value={actionPayload.customerEmail}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, customerEmail: event.target.value }))
                  }
                />
                <Input
                  placeholder="Order number"
                  value={actionPayload.orderNumber}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, orderNumber: event.target.value }))
                  }
                />
                <Textarea
                  placeholder="Message"
                  value={actionPayload.message}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, message: event.target.value }))
                  }
                />
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Cancel
              </Button>
              <Button onClick={handleActionSubmit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
