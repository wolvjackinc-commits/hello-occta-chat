import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Wifi,
  Smartphone,
  PhoneCall,
  LogOut,
  Loader2,
  Package,
  ChevronRight,
  Settings,
  HelpCircle,
  FileText,
  User as UserIcon,
  Bell,
  Shield,
  CreditCard,
  Landmark,
  MessageSquare,
  Download,
  Gift,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { readCache, writeCache } from "@/lib/offlineCache";
import { useRealtimeSync, useReconnectSync } from "@/hooks/useRealtimeSync";
import { InvoicesTab } from "@/components/dashboard/tabs/InvoicesTab";
import { PaymentsTab } from "@/components/dashboard/tabs/PaymentsTab";
import { ServicesTab } from "@/components/dashboard/tabs/ServicesTab";
import { PackagesTab } from "@/components/dashboard/tabs/PackagesTab";
import { QuotesTab } from "@/components/dashboard/tabs/QuotesTab";
import { QuoteRequestsTab } from "@/components/dashboard/tabs/QuoteRequestsTab";
import { ContractSummariesTab } from "@/components/dashboard/tabs/ContractSummariesTab";
import { SupportTab } from "@/components/dashboard/tabs/SupportTab";
import { ChatHistoryTab } from "@/components/dashboard/tabs/ChatHistoryTab";
import { ComplaintsTab } from "@/components/dashboard/tabs/ComplaintsTab";
import { VulnerableSupportTab } from "@/components/dashboard/tabs/VulnerableSupportTab";
import { DocumentsTab } from "@/components/dashboard/tabs/DocumentsTab";
import { AccountSettingsTab } from "@/components/dashboard/tabs/AccountSettingsTab";
import { OrdersTimelineTab } from "@/components/dashboard/tabs/OrdersTimelineTab";
import { DirectDebitOverview } from "@/components/dashboard/DirectDebitOverview";
import { RewardsTab } from "@/components/dashboard/tabs/RewardsTab";
import { generateInvoicePdf } from "@/lib/generateInvoicePdf";
import { format, isValid, parseISO } from "date-fns";
import type { QuoteCounts } from "@/lib/dashboard/quoteCounts";
import { EMPTY_QUOTE_COUNTS } from "@/lib/dashboard/quoteCounts";

type Order = {
  id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  created_at: string;
  postcode?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_number?: string | null;
  postcode?: string | null;
};

type OverviewInvoice = {
  id: string;
  invoice_number: string | null;
  total: number | string | null;
  status: string | null;
  due_date: string | null;
  issue_date: string | null;
};

type ContractSummary = {
  id: string;
  cs_number: string | null;
  status: string | null;
  plan_name: string | null;
  monthly_price_incl_vat: number | null;
  created_at: string | null;
};

type AppTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at?: string | null;
  category?: string | null;
};

export type AppDashboardProps = {
  /** Authenticated user, resolved once by the parent Dashboard page. */
  user: User;
  /** Canonical `get_my_customer_overview()` payload (source of truth). */
  overview: any | null;
  profile: Profile | null;
  tickets: AppTicket[];
  quoteCounts?: QuoteCounts;
  isDataLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
};

const serviceIcons: Record<string, typeof Wifi> = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-warning/20 text-warning", label: "Pending" },
  confirmed: { color: "bg-accent/20 text-accent", label: "Confirmed" },
  active: { color: "bg-success/20 text-success", label: "Active" },
  cancelled: { color: "bg-destructive/20 text-destructive", label: "Cancelled" },
};

const REWARDS_ENABLED = (import.meta as any).env?.VITE_FEATURE_REWARDS === "true";

const UNPAID_STATUS = new Set(["draft", "sent", "overdue", "unpaid", "partially_paid"]);

/** UK date, never "Invalid Date" / NaN. */
export function formatUkDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" && value.includes("T") ? parseISO(value) : new Date(String(value));
  return isValid(d) ? format(d, "dd MMM yyyy") : null;
}

/** UK currency, never NaN. */
export function formatGbp(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

const AppDashboard = ({
  user,
  overview,
  profile,
  tickets,
  quoteCounts = EMPTY_QUOTE_COUNTS,
  isDataLoading = false,
  loadError = null,
  onRetry,
  onSignOut,
}: AppDashboardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const userId = user.id;

  // Cached state is strictly user-scoped and only hydrated once the
  // authenticated user is known, so nothing can leak across accounts.
  const [orders, setOrders] = useState<Order[]>([]);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingContract, setDownloadingContract] = useState(false);

  const fetchSupplementary = useCallback(async (uid: string) => {
    try {
      const cachedOrders = readCache<Order[]>(uid, "dashboard.orders");
      const cachedContract = readCache<ContractSummary>(uid, "dashboard.contract");
      if (cachedOrders) setOrders(cachedOrders);
      if (cachedContract) setContract(cachedContract);

      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      const [ordersResult, contractResult] = await Promise.all([
        supabase.from("customer_orders" as any).select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase
          .from("customer_contract_summaries" as any)
          .select("id, cs_number, status, plan_name, monthly_price_incl_vat, created_at, is_information_update")
          .eq("customer_id", uid)
          .eq("is_information_update", false)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (ordersResult.data) {
        setOrders(ordersResult.data as any);
        writeCache(uid, "dashboard.orders", ordersResult.data);
      }
      if (!contractResult.error) {
        const cs = (contractResult.data as any[] | null)?.[0] ?? null;
        setContract(cs);
        writeCache(uid, "dashboard.contract", cs);
      }
    } catch (error) {
      logError("AppDashboard.fetchSupplementary", error);
    }
  }, []);

  useEffect(() => {
    // Reset any previous account's rows before hydrating this user's data.
    setOrders([]);
    setContract(null);
    void fetchSupplementary(userId);
  }, [userId, fetchSupplementary]);

  const refreshAll = useCallback(() => {
    void fetchSupplementary(userId);
    onRetry?.();
  }, [fetchSupplementary, userId, onRetry]);

  // Realtime: orders/invoices/profile changes for this user only.
  useRealtimeSync(
    `app-dashboard-${userId}`,
    [
      { table: "orders", filter: `user_id=eq.${userId}` },
      { table: "invoices", filter: `user_id=eq.${userId}` },
      { table: "profiles", filter: `id=eq.${userId}` },
    ],
    refreshAll,
    true,
  );

  useReconnectSync(refreshAll, true);

  const invoices: OverviewInvoice[] = useMemo(
    () => (Array.isArray(overview?.invoices) ? (overview.invoices as OverviewInvoice[]) : []),
    [overview],
  );
  const unpaidInvoices = useMemo(
    () =>
      invoices
        .filter((i) => UNPAID_STATUS.has(String(i.status ?? "").toLowerCase()))
        .sort((a, b) => new Date(a.due_date ?? a.issue_date ?? 0).getTime() - new Date(b.due_date ?? b.issue_date ?? 0).getTime()),
    [invoices],
  );
  const paidInvoices = useMemo(
    () => invoices.filter((i) => String(i.status ?? "").toLowerCase() === "paid").slice(0, 3),
    [invoices],
  );
  const outstandingTotal = unpaidInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const latestInvoice = unpaidInvoices[0] ?? null;

  const canonicalService = overview?.service ?? null;
  const canonicalOrder = overview?.order ?? null;
  const directDebit = overview?.direct_debit ?? null;
  const accountNumber = overview?.account_number ?? profile?.account_number ?? null;

  const proxyActiveOrders = orders.filter((o) => o.status === "active" || o.status === "confirmed");
  const serviceIsActive = String(canonicalService?.status ?? "") === "active";
  const activeServiceCount = serviceIsActive ? Math.max(1, proxyActiveOrders.length) : proxyActiveOrders.length;
  const monthlyTotal = serviceIsActive
    ? Number(canonicalService?.monthly_price ?? 0) || proxyActiveOrders.reduce((s, o) => s + Number(o.plan_price ?? 0), 0)
    : proxyActiveOrders.reduce((s, o) => s + Number(o.plan_price ?? 0), 0);

  const openTicketCount = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting_customer" || t.status === "waiting_occta",
  ).length;

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const [invRes, linesRes, profileRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
        supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
        supabase.from("customer_profile" as any).select("*").eq("id", userId).maybeSingle(),
      ]);
      if (invRes.error || !invRes.data) throw invRes.error ?? new Error("invoice_missing");
      const inv: any = invRes.data;
      const p: any = profileRes.data ?? {};
      const lines = (linesRes.data as any[]) ?? [];
      generateInvoicePdf({
        invoiceNumber: inv.invoice_number,
        customerName: p.full_name || "Customer",
        customerEmail: p.email || "",
        accountNumber: p.account_number || "",
        postcode: p.postcode || "",
        issueDate: inv.issue_date,
        dueDate: inv.due_date ?? undefined,
        status: inv.status,
        lines: lines.map((l) => ({
          description: l.description ?? "",
          qty: Number(l.qty ?? 1),
          unit_price: Number(l.unit_price ?? 0),
          line_total: Number(l.line_total ?? 0),
          vat_rate: l.vat_rate != null ? Number(l.vat_rate) : undefined,
        })),
        subtotal: Number(inv.subtotal ?? 0),
        vatTotal: Number(inv.vat_total ?? 0),
        total: Number(inv.total ?? 0),
        notes: inv.notes ?? undefined,
        vatEnabled: inv.vat_enabled !== false,
        vatRate: inv.vat_rate != null ? Number(inv.vat_rate) : 20,
      });
      toast({ title: "Invoice downloaded" });
    } catch (e) {
      logError("AppDashboard.handleDownloadInvoice", e);
      toast({ title: "Couldn't download invoice", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadContract = async (csId: string) => {
    setDownloadingContract(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", {
        body: { contract_summary_id: csId },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      const url = (data as any)?.signed_url;
      if (!url) throw new Error("no_signed_url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      logError("AppDashboard.handleDownloadContract", e);
      toast({ title: "Couldn't open contract PDF", variant: "destructive" });
    } finally {
      setDownloadingContract(false);
    }
  };

  const userName = profile?.full_name || user.email?.split("@")[0] || "Customer";
  const userInitials = userName.slice(0, 2).toUpperCase();

  // `tab` is absent on the account home. Anything unknown also lands here so a
  // stale or mistyped deep link can never render a blank screen.
  const requestedSection = searchParams.get("tab");

  const sectionTitle: Record<string, string> = {
    orders: "All Orders",
    services: "My Services",
    packages: "My Packages",
    quotes: "Quotes",
    quoteRequests: "Quote Requests",
    cs: "Contract Details",
    invoices: "Invoices & Payments",
    billing: "Invoices & Payments",
    payments: "Payments & Receipts",
    dd: "Direct Debit",
    documents: "Documents",
    tickets: "Support Tickets",
    support: "Support Tickets",
    chat: "Chat History",
    complaints: "Complaints",
    vuln: "Extra Support",
    account: "Account Details",
    notifications: "Notifications",
    privacy: "Privacy",
    settings: "Settings",
    ...(REWARDS_ENABLED ? { rewards: "Rewards" } : {}),
  };

  const activeSection = requestedSection && sectionTitle[requestedSection] ? requestedSection : "home";

  const menuItems = [
    { icon: CreditCard, label: "Invoices & Payments", description: "Bills, receipts and Pay Now", link: "/dashboard?tab=invoices", badge: unpaidInvoices.length || undefined },
    { icon: ReceiptIcon, label: "Payments & Receipts", description: "Payment history and receipts", link: "/dashboard?tab=payments" },
    { icon: Landmark, label: "Direct Debit", description: "Your payment mandate", link: "/dashboard?tab=dd" },
    { icon: FileText, label: "Contract details", description: "Your signed contract summary", link: "/dashboard?tab=cs" },
    { icon: Wifi, label: "My services", description: "Active broadband, SIM & phone", link: "/dashboard?tab=services" },
    { icon: Package, label: "All Orders", description: "Track orders and activation", link: "/dashboard?tab=orders", badge: orders.length || undefined },
    { icon: FileText, label: "Quotes", description: "Quotes ready to accept", link: "/dashboard?tab=quotes", badge: quoteCounts.openQuotes || undefined },
    { icon: MessageSquare, label: "Quote requests", description: "Requests we're working on", link: "/dashboard?tab=quoteRequests", badge: quoteCounts.openRequests || undefined },
    { icon: HelpCircle, label: "Support tickets", description: "Raised tickets & replies", link: "/dashboard?tab=tickets", badge: openTicketCount || undefined },
    { icon: MessageSquare, label: "Complaints", description: "Raise or track a complaint", link: "/dashboard?tab=complaints" },
    { icon: FileText, label: "Documents", description: "Downloads and paperwork", link: "/dashboard?tab=documents" },
    ...(REWARDS_ENABLED
      ? [{ icon: Gift, label: "Rewards", description: "Points and referrals", link: "/dashboard?tab=rewards" }]
      : []),
    { icon: UserIcon, label: "Account details", description: "Name, contact and address", link: "/dashboard?tab=account" },
    { icon: Bell, label: "Notifications", description: "Manage alerts", link: "/dashboard?tab=notifications" },
    { icon: Shield, label: "Privacy", description: "Policies and your data", link: "/dashboard?tab=privacy" },
    { icon: Settings, label: "Settings", description: "App preferences", link: "/dashboard?tab=settings" },
  ] as Array<{ icon: typeof Wifi; label: string; description: string; link: string; badge?: number }>;

  const errorBanner = loadError ? (
    <div role="alert" className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 mb-4">
      <p className="text-sm">{loadError}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={onRetry} disabled={isDataLoading}>
          Retry
        </Button>
      )}
    </div>
  ) : null;

  const sectionBody = () => {
    switch (activeSection) {
      case "invoices":
      case "billing":
        return <InvoicesTab userId={userId} />;
      case "payments":
        return <PaymentsTab userId={userId} />;
      case "dd":
        return <DirectDebitOverview userId={userId} />;
      case "services":
        return <ServicesTab userId={userId} />;
      case "packages":
        return <PackagesTab userId={userId} />;
      case "quotes":
        return <QuotesTab userId={userId} />;
      case "quoteRequests":
        return <QuoteRequestsTab userId={userId} />;
      case "cs":
        return <ContractSummariesTab userId={userId} />;
      case "orders":
        return <OrdersTimelineTab userId={userId} userEmail={user.email ?? null} />;
      case "documents":
        return <DocumentsTab userId={userId} />;
      case "chat":
        return <ChatHistoryTab userId={userId} />;
      case "complaints":
        return <ComplaintsTab />;
      case "vuln":
        return <VulnerableSupportTab userId={userId} />;
      case "rewards":
        return <RewardsTab />;
      case "account":
        return (
          <AccountSettingsTab
            profile={(profile as any) ?? { id: userId, full_name: null, email: user.email ?? null }}
          />
        );
      case "support":
      case "tickets":
        return (
          <>
            <SupportTab tickets={tickets as any} userId={userId} />
            <div className="mt-3">
              <Link to="/support">
                <Button variant="outline" className="w-full rounded-xl">Full support centre</Button>
              </Link>
            </div>
          </>
        );
      case "notifications":
        return (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium">Service alerts</p>
                <p className="text-sm text-muted-foreground">Billing, orders and support updates</p>
              </div>
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={async () => {
                if (!("Notification" in window)) {
                  toast({ title: "Unavailable", description: "Notifications are not supported on this device" });
                  return;
                }
                const permission = await Notification.requestPermission();
                toast({ title: permission === "granted" ? "Notifications enabled" : "Notifications not enabled" });
              }}
            >
              Manage Notifications
            </Button>
          </div>
        );
      case "privacy":
        return (
          <div className="-m-3">
            {[{ label: "Privacy Policy", to: "/privacy" }, { label: "Cookie Policy", to: "/cookies" }, { label: "Terms of Service", to: "/terms" }].map((item, index) => (
              <Link key={item.to} to={item.to} className={`flex items-center gap-4 p-4 ${index !== 2 ? "border-b border-border" : ""}`}>
                <Shield className="w-5 h-5 text-accent" />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        );
      case "settings":
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="font-medium break-words">{user.email}</p>
            </div>
            <Link to="/broadband" className="block">
              <Button variant="outline" className="w-full rounded-xl h-12"><Wifi className="w-4 h-4 mr-2" />Add Broadband</Button>
            </Link>
            <Button
              variant="outline"
              className="w-full rounded-xl h-12 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={onSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (activeSection !== "home") {
    return (
      <div className="min-h-screen bg-muted/30 pb-8">
        <div className="bg-accent px-4 pt-4 pb-8 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 rounded-full bg-background/15 text-accent-foreground flex items-center justify-center shrink-0"
              aria-label="Back to account"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h2 className="font-bold text-lg text-accent-foreground truncate">{sectionTitle[activeSection]}</h2>
          </div>
        </div>

        <div className="px-4 -mt-4">
          {errorBanner}
          <div className="bg-background rounded-2xl p-3 shadow-sm overflow-x-hidden">{sectionBody()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-accent px-4 pt-4 pb-8 rounded-b-3xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background rounded-2xl p-4"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{userName}</h2>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              {profile?.phone && <p className="text-sm text-muted-foreground truncate">{profile.phone}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Account{" "}
                <span className="font-mono">
                  {accountNumber ?? (isDataLoading ? "—" : "Not assigned yet")}
                </span>
              </p>
            </div>
            <Link
              to="/dashboard?tab=account"
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"
              aria-label="Account details"
            >
              <UserIcon className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>

          <div className="bg-muted/50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {activeServiceCount > 0
                  ? `${activeServiceCount} active service${activeServiceCount !== 1 ? "s" : ""}`
                  : canonicalOrder
                    ? `Order ${String(canonicalOrder.lifecycle_status ?? "in progress").replace(/_/g, " ")}`
                    : "No active services yet"}
              </span>
              {monthlyTotal > 0 && <span className="font-bold text-lg">{formatGbp(monthlyTotal)}/mo</span>}
            </div>
            {canonicalService?.next_billing_date && (
              <p className="text-xs text-muted-foreground">
                Next bill {formatUkDate(canonicalService.next_billing_date) ?? "—"}
              </p>
            )}
            {directDebit?.status && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Landmark className="w-3 h-3" />
                Direct Debit: {String(directDebit.status).replace(/_/g, " ")}
                {directDebit.masked_account_last4 ? ` ••••${directDebit.masked_account_last4}` : ""}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <div className="px-4 -mt-4">
        {errorBanner}

        {/* Outstanding balance / Pay now */}
        {latestInvoice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4 border-2 border-warning/40"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Outstanding</p>
                  <p className="font-bold truncate">{latestInvoice.invoice_number || latestInvoice.id.slice(0, 8)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg">{formatGbp(outstandingTotal)}</p>
                {formatUkDate(latestInvoice.due_date) && (
                  <p className="text-xs text-muted-foreground">Due {formatUkDate(latestInvoice.due_date)}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Link to={`/pay-invoice?id=${latestInvoice.id}`} className="flex-1">
                <Button className="w-full rounded-xl">Pay now</Button>
              </Link>
              <Button
                variant="outline"
                className="rounded-xl shrink-0"
                onClick={() => handleDownloadInvoice(latestInvoice.id)}
                disabled={downloadingId === latestInvoice.id}
                aria-label="Download invoice"
              >
                {downloadingId === latestInvoice.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
              <Link to="/dashboard?tab=invoices" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl">All invoices</Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Tickets awaiting the customer */}
        {openTicketCount > 0 && (
          <Link to="/dashboard?tab=tickets" className="block mb-4">
            <div className="bg-background rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {openTicketCount} open support ticket{openTicketCount !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground truncate">Tap to read replies and respond</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          </Link>
        )}

        {/* Recent paid invoices */}
        {paidInvoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Recent paid invoices</h3>
              <Link to="/dashboard?tab=invoices" className="text-sm text-accent font-medium">View all</Link>
            </div>
            <div className="space-y-2">
              {paidInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{inv.invoice_number || inv.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{formatUkDate(inv.issue_date) ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-sm">{formatGbp(inv.total)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 w-9 p-0"
                      onClick={() => handleDownloadInvoice(inv.id)}
                      disabled={downloadingId === inv.id}
                      aria-label={`Download invoice ${inv.invoice_number ?? ""}`}
                    >
                      {downloadingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contract summary shortcut */}
        {contract && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Your contract</p>
                  <p className="font-medium truncate">{contract.plan_name || contract.cs_number || "Contract summary"}</p>
                  {contract.monthly_price_incl_vat != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatGbp(contract.monthly_price_incl_vat)}/mo · {contract.status ?? "active"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-9 w-9 p-0"
                  onClick={() => handleDownloadContract(contract.id)}
                  disabled={downloadingContract}
                  aria-label="Download contract PDF"
                >
                  {downloadingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </Button>
                <Link to="/dashboard?tab=cs" aria-label="View contract">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Canonical service / order state */}
        {(canonicalService || canonicalOrder) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{serviceIsActive ? "Your service" : "Your order"}</h3>
              <Link to={serviceIsActive ? "/dashboard?tab=services" : "/dashboard?tab=orders"} className="text-sm text-accent font-medium">
                View
              </Link>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                {(() => {
                  const Icon = serviceIcons[String((canonicalService ?? canonicalOrder)?.service_type ?? "broadband")] ?? Wifi;
                  return <Icon className="w-6 h-6 text-accent" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {(canonicalService ?? canonicalOrder)?.plan_name ?? "OCCTA service"}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground capitalize">
                    {String((canonicalService ?? canonicalOrder)?.service_type ?? "broadband")}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      serviceIsActive ? statusConfig.active.color : statusConfig.pending.color
                    }`}
                  >
                    {serviceIsActive
                      ? "Active"
                      : String(canonicalOrder?.lifecycle_status ?? "In progress").replace(/_/g, " ")}
                  </span>
                </div>
                {!serviceIsActive && formatUkDate(canonicalOrder?.preferred_start_date) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expected live {formatUkDate(canonicalOrder?.preferred_start_date)}
                  </p>
                )}
                {serviceIsActive && formatUkDate(canonicalService?.activation_date) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Live since {formatUkDate(canonicalService?.activation_date)}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold">{formatGbp((canonicalService ?? canonicalOrder)?.monthly_price)}</p>
                <p className="text-xs text-muted-foreground">/month</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Nothing yet */}
        {!isDataLoading && !canonicalService && !canonicalOrder && orders.length === 0 && (
          <div className="bg-background rounded-2xl p-4 shadow-sm mb-4">
            <p className="font-medium mb-1">No services yet</p>
            <p className="text-sm text-muted-foreground mb-3">
              Check your postcode and get a quote — it takes under a minute.
            </p>
            <Link to="/broadband"><Button className="w-full rounded-xl">Check availability</Button></Link>
          </div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-4"
        >
          <Link to="/broadband" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <Wifi className="w-6 h-6 text-accent" />
            </div>
            <span className="text-xs font-medium">Add Broadband</span>
          </Link>
          <Link to="/sim-plans" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-medium">Add SIM</span>
          </Link>
          <Link to="/support" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-2">
              <HelpCircle className="w-6 h-6 text-success" />
            </div>
            <span className="text-xs font-medium">Get Help</span>
          </Link>
        </motion.div>

        {/* Menu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-background rounded-2xl shadow-sm mb-4 overflow-hidden"
        >
          {menuItems.map((item, index) => (
            <Link
              key={item.label}
              to={item.link}
              className={`flex items-center gap-4 p-4 ${index !== menuItems.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.label}</p>
                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
              </div>
              {item.badge ? (
                <span className="px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded-full font-medium shrink-0">
                  {item.badge}
                </span>
              ) : null}
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default AppDashboard;
