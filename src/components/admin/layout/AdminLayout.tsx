import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Mail,
  Send,
  Shield,
  Settings,
  Ticket,
  Users,
  Wrench,
  Search,
  ScrollText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GlobalSearch, useGlobalSearch } from "@/components/admin/GlobalSearch";

const navItems = [
  { label: "Overview", to: "/admin/overview", icon: LayoutGrid },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Orders", to: "/admin/orders", icon: ClipboardList },
  { label: "Tickets", to: "/admin/tickets", icon: Ticket },
  { label: "Billing", to: "/admin/billing", icon: BadgeDollarSign },
  { label: "Services", to: "/admin/services", icon: Wrench },
  { label: "Payments & DD", to: "/admin/payments-dd", icon: Activity },
  { label: "Payment Requests", to: "/admin/payment-requests", icon: Mail },
  { label: "Communications", to: "/admin/communications", icon: Send },
  { label: "Installations", to: "/admin/installations", icon: CalendarDays },
  { label: "Plans", to: "/admin/plans", icon: FileText },
  { label: "Compliance", to: "/admin/compliance", icon: Shield },
  { label: "Audit Log", to: "/admin/audit-log", icon: ScrollText },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

type SearchResult = {
  id: string;
  type: "customer" | "order" | "guest_order";
  label: string;
  description?: string | null;
  href: string;
};

type QuickActionType =
  | "ticket"
  | "installation"
  | "email"
  | null;

const accountNumberPattern = /^OCC\d{8}$/;

export const AdminLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { open: globalSearchOpen, setOpen: setGlobalSearchOpen } = useGlobalSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAction, setActiveAction] = useState<QuickActionType>(null);
  const [actionPayload, setActionPayload] = useState({
    accountNumber: "",
    subject: "",
    message: "",
    orderId: "",
    slotId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderNumber: "",
  });
  const [matchedTicketCustomer, setMatchedTicketCustomer] = useState<{
    id: string;
    full_name: string | null;
    email: string | null;
    account_number: string | null;
  } | null>(null);
  const [isLookingUpTicketCustomer, setIsLookingUpTicketCustomer] = useState(false);

  const searchEnabled = searchTerm.trim().length >= 2;
  const normalizedSearchTerm = searchTerm.trim().toUpperCase();
  const isExactAccountNumber = accountNumberPattern.test(normalizedSearchTerm);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["admin-search", searchTerm],
    enabled: searchEnabled,
    queryFn: async () => {
      const term = searchTerm.trim();
      const [profiles, guestOrders, orders] = await Promise.all([
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

  useEffect(() => {
    if (!isExactAccountNumber) return;
    let isActive = true;
    const lookupCustomer = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("account_number", normalizedSearchTerm)
        .maybeSingle();
      if (!isActive || !data) return;
      navigate(`/admin/customers/${data.id}`);
      setSearchTerm("");
    };
    lookupCustomer();
    return () => {
      isActive = false;
    };
  }, [isExactAccountNumber, normalizedSearchTerm, navigate]);

  useEffect(() => {
    if (activeAction !== "ticket") {
      setMatchedTicketCustomer(null);
      setIsLookingUpTicketCustomer(false);
      return;
    }
    const normalizedAccountNumber = actionPayload.accountNumber.trim().toUpperCase();
    if (!normalizedAccountNumber) {
      setMatchedTicketCustomer(null);
      setIsLookingUpTicketCustomer(false);
      return;
    }
    if (!accountNumberPattern.test(normalizedAccountNumber)) {
      setMatchedTicketCustomer(null);
      setIsLookingUpTicketCustomer(false);
      return;
    }

    let isActive = true;
    setMatchedTicketCustomer(null);
    setIsLookingUpTicketCustomer(true);
    const timeoutId = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_number")
        .eq("account_number", normalizedAccountNumber)
        .maybeSingle();
      if (!isActive) return;
      if (error) {
        setMatchedTicketCustomer(null);
      } else {
        setMatchedTicketCustomer(data || null);
      }
      setIsLookingUpTicketCustomer(false);
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeAction, actionPayload.accountNumber]);

  const actionTitle = useMemo(() => {
    switch (activeAction) {
      case "ticket":
        return "Create ticket";
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
      if (activeAction === "ticket") {
        const normalizedAccountNumber = actionPayload.accountNumber.trim().toUpperCase();
        if (!accountNumberPattern.test(normalizedAccountNumber)) {
          toast({ title: "Enter a valid account number (OCC########).", variant: "destructive" });
          return;
        }
        const { data: customer, error: customerError } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_number")
          .eq("account_number", normalizedAccountNumber)
          .maybeSingle();
        if (customerError) throw customerError;
        if (!customer) {
          toast({
            title: `Customer not found for ${normalizedAccountNumber}`,
            variant: "destructive",
          });
          return;
        }
        const { error } = await supabase.from("support_tickets").insert({
          user_id: customer.id,
          subject: actionPayload.subject,
          description: actionPayload.message,
          status: "open",
          priority: "medium",
        });
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
        accountNumber: "",
        subject: "",
        message: "",
        orderId: "",
        slotId: "",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        orderNumber: "",
      });
      setMatchedTicketCustomer(null);
    } catch (error) {
      toast({
        title: "Action failed",
        description: "Please check the form details and try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Persistent Admin Top Bar */}
      <div className="border-b-4 border-foreground bg-muted/50 px-4 py-2">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Admin Console
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ExternalLink className="mr-2 h-4 w-4" />
                Website
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        <aside className="min-h-[calc(100vh-49px)] w-64 border-r border-border bg-muted/20 p-6">
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
                <Button
                  variant="outline"
                  onClick={() => setGlobalSearchOpen(true)}
                  className="w-full justify-start gap-2 border-2 border-foreground text-muted-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1 text-left">Search customers, orders...</span>
                  <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setActiveAction("ticket")}>
                  Create ticket
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
            {activeAction === "ticket" && (
              <>
                <Input
                  placeholder="Account number (OCC12345678)"
                  value={actionPayload.accountNumber}
                  onChange={(event) =>
                    setActionPayload((prev) => ({ ...prev, accountNumber: event.target.value }))
                  }
                />
                {matchedTicketCustomer && (
                  <p className="text-xs text-muted-foreground">
                    Customer: {matchedTicketCustomer.full_name || "Customer"}{" "}
                    {matchedTicketCustomer.email ? `· ${matchedTicketCustomer.email}` : ""}
                  </p>
                )}
                {!matchedTicketCustomer &&
                  accountNumberPattern.test(actionPayload.accountNumber.trim().toUpperCase()) &&
                  !isLookingUpTicketCustomer && (
                    <p className="text-xs text-muted-foreground">
                      No customer found for {actionPayload.accountNumber.trim().toUpperCase()}.
                    </p>
                  )}
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
              <Button onClick={handleActionSubmit}>Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Search (Ctrl+K) */}
      <GlobalSearch open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} />
    </div>
  );
};
