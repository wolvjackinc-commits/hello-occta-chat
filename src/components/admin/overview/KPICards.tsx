import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { KPICardsSkeleton } from "./QueueSkeleton";
import { subDays, format } from "date-fns";
import { 
  FileText, 
  Wrench, 
  Ticket, 
  AlertCircle, 
  CreditCard,
  Receipt,
  Truck,
  Percent,
  TrendingDown,
} from "lucide-react";

export const KPICards = () => {
  const navigate = useNavigate();
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["admin-overview-kpis-v2"],
    queryFn: async () => {
      const [
        outstandingInvoices,
        activeServices,
        openTickets,
        failedPayments,
        pendingDD,
        vatActive,
        suppliersActive,
        productsActive,
        pricingActive,
        marginAmber,
        marginRed,
        settings,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("total", { count: "exact" })
          .in("status", ["sent", "overdue"]),
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("payment_attempts")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("attempted_at", sevenDaysAgo),
        supabase
          .from("dd_mandates")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "submitted"]),
        (supabase as any).rpc("is_vat_active"),
        (supabase as any).from("supplier_profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
        (supabase as any).from("supplier_products").select("id", { count: "exact", head: true }).eq("active", true),
        (supabase as any).from("pricing_rules").select("id", { count: "exact", head: true }).eq("active", true),
        (supabase as any).from("quote_margin_checks").select("id", { count: "exact", head: true }).eq("status", "amber"),
        (supabase as any).from("quote_margin_checks").select("id", { count: "exact", head: true }).eq("status", "red"),
        (supabase as any).from("platform_settings").select("api_mode, sim_checkout_mode").eq("singleton", true).maybeSingle(),
      ]);

      const totalOutstanding = outstandingInvoices.data?.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0
      ) || 0;

      return {
        outstandingTotal: totalOutstanding,
        outstandingCount: outstandingInvoices.count || 0,
        activeServices: activeServices.count || 0,
        openTickets: openTickets.count || 0,
        failedPayments: failedPayments.count || 0,
        pendingDD: pendingDD.count || 0,
        vatActive: vatActive?.data === true,
        suppliersActive: suppliersActive.count || 0,
        productsActive: productsActive.count || 0,
        pricingActive: pricingActive.count || 0,
        marginAmber: marginAmber.count || 0,
        marginRed: marginRed.count || 0,
        apiMode: settings.data?.api_mode ?? "manual",
        simMode: settings.data?.sim_checkout_mode ?? "quote",
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return <KPICardsSkeleton />;
  }

  const cards = [
    {
      label: "Outstanding Invoices",
      value: `£${(kpis?.outstandingTotal || 0).toFixed(2)}`,
      subValue: `${kpis?.outstandingCount || 0} invoices`,
      icon: FileText,
      onClick: () => navigate("/admin/billing?status=sent,overdue"),
      color: "text-amber-600",
    },
    {
      label: "Active Services",
      value: kpis?.activeServices || 0,
      icon: Wrench,
      onClick: () => navigate("/admin/services?status=active"),
      color: "text-green-600",
    },
    {
      label: "Open Tickets",
      value: kpis?.openTickets || 0,
      icon: Ticket,
      onClick: () => navigate("/admin/tickets?status=open"),
      color: "text-blue-600",
    },
    {
      label: "Failed Payments (7d)",
      value: kpis?.failedPayments || 0,
      icon: AlertCircle,
      onClick: () => navigate("/admin/payments-dd?tab=attempts"),
      color: kpis?.failedPayments ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "DD Pending",
      value: kpis?.pendingDD || 0,
      icon: CreditCard,
      onClick: () => navigate("/admin/payments-dd?tab=mandates"),
      color: kpis?.pendingDD ? "text-amber-600" : "text-muted-foreground",
    },
    {
      label: "VAT Settings",
      value: kpis?.vatActive ? "Active" : "Incomplete",
      icon: Receipt,
      onClick: () => navigate("/admin/vat-settings"),
      color: kpis?.vatActive ? "text-green-600" : "text-destructive",
    },
    {
      label: "Suppliers Active",
      value: kpis?.suppliersActive || 0,
      subValue: `${kpis?.productsActive || 0} products`,
      icon: Truck,
      onClick: () => navigate("/admin/suppliers"),
      color: "text-muted-foreground",
    },
    {
      label: "Pricing Rules Active",
      value: kpis?.pricingActive || 0,
      icon: Percent,
      onClick: () => navigate("/admin/pricing-rules"),
      color: "text-muted-foreground",
    },
    {
      label: "Low-Margin Quotes",
      value: kpis?.marginAmber || 0,
      subValue: `${kpis?.marginRed || 0} blocked (red)`,
      icon: TrendingDown,
      onClick: () => navigate("/admin/quotes"),
      color: kpis?.marginRed ? "text-destructive" : "text-amber-600",
    },
    {
      label: "API / SIM mode",
      value: `${kpis?.apiMode ?? "manual"} / ${kpis?.simMode ?? "quote"}`,
      icon: AlertCircle,
      onClick: () => navigate("/admin/vat-settings"),
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="cursor-pointer border-2 border-foreground p-4 transition-all hover:-translate-y-0.5 hover:shadow-brutal"
          onClick={card.onClick}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                {card.label}
              </div>
              <div className="text-2xl font-display">{card.value}</div>
              {card.subValue && (
                <div className="text-xs text-muted-foreground">{card.subValue}</div>
              )}
            </div>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
        </Card>
      ))}
    </div>
  );
};
