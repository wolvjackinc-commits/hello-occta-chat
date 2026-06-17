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
  MessageSquare,
  FileSignature,
  Inbox,
  Percent,
  Truck,
  TrendingUp,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  PackageCheck,
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

/**
 * Phase 5 — Admin navigation consolidated into exactly eight top-level
 * sections. No routes were deleted; pages that used to live at the top
 * level are now reachable through these groups. Bookmarked legacy URLs
 * continue to work because every route is still defined in App.tsx.
 */
type NavChild = { label: string; to: string };
type NavSection = { label: string; icon: typeof LayoutGrid; to?: string; children?: NavChild[] };

// Feature flags for sections that are not part of production today.
// Toggle by setting VITE_FEATURE_REWARDS / VITE_FEATURE_REFERRALS /
// VITE_FEATURE_CAMPAIGNS to "true". Default = hidden.
const env = (import.meta as any).env ?? {};
const FEATURE_REWARDS    = String(env.VITE_FEATURE_REWARDS ?? "")    === "true";
const FEATURE_REFERRALS  = String(env.VITE_FEATURE_REFERRALS ?? "")  === "true";
const FEATURE_CAMPAIGNS  = String(env.VITE_FEATURE_CAMPAIGNS ?? "")  === "true";

const navSections: NavSection[] = [
  { label: "Overview", icon: LayoutGrid, to: "/admin/overview" },
  {
    label: "Sales", icon: Inbox, children: [
      { label: "Quote Requests", to: "/admin/quote-requests" },
      { label: "Quotes",         to: "/admin/quotes" },
      ...(FEATURE_CAMPAIGNS ? [{ label: "Campaigns", to: "/admin/campaigns" }] : []),
    ],
  },
  { label: "Customers", icon: Users, to: "/admin/customers" },
  {
    label: "Orders", icon: ClipboardList, children: [
      { label: "All Orders",             to: "/admin/orders" },
      { label: "Manual Giacom Tracking", to: "/admin/manual-fulfilment" },
      { label: "Installations",          to: "/admin/installations" },
      { label: "Readiness",              to: "/admin/readiness" },
      { label: "Services",               to: "/admin/services" },
      { label: "Tasks",                  to: "/admin/tasks" },
    ],
  },
  {
    label: "Billing", icon: BadgeDollarSign, children: [
      { label: "Invoices",      to: "/admin/billing" },
      { label: "Payment Links", to: "/admin/payment-requests" },
      { label: "Direct Debit",  to: "/admin/payments-dd" },
    ],
  },
  {
    label: "Support", icon: Ticket, children: [
      { label: "Tickets",          to: "/admin/tickets" },
      { label: "Complaints",       to: "/admin/complaints" },
      { label: "Communications",   to: "/admin/communications" },
      { label: "Chat Transcripts", to: "/admin/chat-transcripts" },
      { label: "Knowledge Base",   to: "/admin/knowledge-base" },
    ],
  },
  {
    label: "Products & Pricing", icon: Percent, children: [
      { label: "Plans",             to: "/admin/plans" },
      { label: "Suppliers",         to: "/admin/suppliers" },
      { label: "Giacom Import",     to: "/admin/suppliers/giacom-import" },
      { label: "Pricing Rules",     to: "/admin/pricing-rules" },
      { label: "Margin Rules",      to: "/admin/margin-rules" },
      { label: "Fair Pricing",      to: "/admin/fair-pricing" },
      { label: "VAT",               to: "/admin/vat-settings" },
      { label: "Contract Benefits", to: "/admin/contract-benefits" },
      ...(FEATURE_REWARDS   ? [{ label: "Rewards",   to: "/admin/rewards" }]   : []),
      ...(FEATURE_REFERRALS ? [{ label: "Referrals", to: "/admin/referrals" }] : []),
    ],
  },
  {
    label: "Settings & Compliance", icon: Settings, children: [
      { label: "Settings",      to: "/admin/settings" },
      { label: "Compliance",    to: "/admin/compliance" },
      { label: "Audit Log",     to: "/admin/audit-log" },
      { label: "Launch Safety", to: "/admin/launch-safety" },
    ],
  },
];

type SearchResult = {
  id: string;
  type: "customer" | "order" | "guest_order" | "quote_request";
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
      const [profiles, quoteRequests, guestOrders, orders] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, account_number")
          .or(
            `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,account_number.ilike.%${term}%`
          )
          .limit(10),
        (supabase as any)
          .from("quote_requests")
          .select("id, reference, full_name, email, phone, postcode, status")
          .or(
            `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,postcode.ilike.%${term}%,reference.ilike.%${term}%`
          )
          .order("created_at", { ascending: false })
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

      quoteRequests.data?.forEach((request: any) => {
        results.push({
          id: request.id,
          type: "quote_request",
          label: `Quote Request ${request.reference || request.id.slice(0, 8)}`,
          description: [request.full_name, request.email, request.phone, request.postcode, request.status]
            .filter(Boolean)
            .join(" · "),
          href: `/admin/quote-requests?search=${encodeURIComponent(request.reference || request.email || request.phone || "")}`,
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
