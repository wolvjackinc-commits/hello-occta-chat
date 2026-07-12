import { Link } from "react-router-dom";
import {
  Wifi,
  FileText,
  Package,
  Receipt,
  LifeBuoy,
  Gift,
  AlertTriangle,
  MessageCircle,
  Sparkles,
  CreditCard,
  ArrowUpRight,
  Plus,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

type Props = {
  activeServices: number;
  pendingQuotes: number;
  latestOrderStatus: string | null;
  unpaidInvoices: number;
  unpaidTotal: number;
  openTickets: number;
  nextDueDate?: string | null;
  nextDueInvoiceId?: string | null;
};

function Card({ icon: Icon, label, value, empty, href, accent }: any) {
  const content = (
    <div
      className={`p-4 border-4 border-foreground bg-background h-full transition-all ${
        href ? "hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_hsl(var(--foreground))]" : ""
      } ${accent ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase font-display tracking-wider">{label}</span>
      </div>
      <p className="font-display text-2xl">{value ?? empty}</p>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

function QuickAction({ icon: Icon, label, href, onClick, variant = "outline" }: any) {
  const inner = (
    <Button
      variant={variant}
      className={`w-full justify-between border-2 border-foreground ${variant === "outline" ? "bg-background" : ""}`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 font-display uppercase text-xs">
        <Icon className="w-4 h-4" /> {label}
      </span>
      <ArrowUpRight className="w-4 h-4" />
    </Button>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

export function OverviewTab(p: Props) {
  const isEmpty =
    !p.activeServices && !p.pendingQuotes && !p.latestOrderStatus && !p.unpaidInvoices && !p.openTickets;

  const hasUnpaid = p.unpaidInvoices > 0;
  const nextDue = p.nextDueDate ? new Date(p.nextDueDate) : null;
  const overdue = nextDue ? nextDue < new Date() : false;

  return (
    <div className="space-y-4">
      {isEmpty && (
        <div className="p-6 border-4 border-foreground bg-background">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-1 text-primary" />
            <div className="flex-1">
              <h3 className="font-display uppercase text-lg mb-1">Let's get you started</h3>
              <p className="text-sm text-muted-foreground mb-3">
                You don't have any active services yet. Request a quick quote — no payment, no pressure.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/build-plan?availability=fallback"><Button variant="hero" size="sm">Request a quote</Button></Link>
                <Link to="/support"><Button variant="outline" size="sm" className="border-2 border-foreground"><LifeBuoy className="w-4 h-4 mr-1" /> Need help?</Button></Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!isEmpty && (
        <div>
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">Quick actions</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {hasUnpaid ? (
              <QuickAction
                icon={CreditCard}
                label="Pay outstanding"
                href={p.nextDueInvoiceId ? `/pay-invoice?id=${p.nextDueInvoiceId}` : "/dashboard?tab=invoices"}
                variant="hero"
              />
            ) : (
              <QuickAction icon={Plus} label="Add a service" href="/build-plan?availability=fallback" variant="hero" />
            )}
            <QuickAction icon={Receipt} label="View invoices" href="/dashboard?tab=invoices" />
            <QuickAction icon={LifeBuoy} label="Open support" href="/support" />
            <QuickAction
              icon={MessageCircle}
              label="Chat"
              onClick={() => window.dispatchEvent(new Event("open-ai-chat"))}
            />
          </div>
        </div>
      )}

      {/* Next-due callout */}
      {hasUnpaid && (
        <div
          className={`p-4 border-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            overdue ? "border-destructive bg-destructive/10" : "border-warning bg-warning/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-display uppercase text-sm">
                {overdue ? "Payment overdue" : "Next payment"}
              </p>
              <p className="text-xs text-muted-foreground">
                £{p.unpaidTotal.toFixed(2)} across {p.unpaidInvoices} invoice{p.unpaidInvoices === 1 ? "" : "s"}
                {nextDue ? ` · due ${format(nextDue, "dd MMM yyyy")}` : ""}
              </p>
            </div>
          </div>
          <Link to={p.nextDueInvoiceId ? `/pay-invoice?id=${p.nextDueInvoiceId}` : "/dashboard?tab=invoices"}>
            <Button variant="hero" size="sm">
              <CreditCard className="w-4 h-4 mr-1" /> Pay now
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={Wifi} label="Active services" value={p.activeServices || null} empty="None yet" />
        <Card icon={FileText} label="Open quotes" value={p.pendingQuotes || null} empty="No open quotes" href="/dashboard?tab=quotes" />
        <Card icon={Package} label="Latest order" value={p.latestOrderStatus} empty="No orders" href="/dashboard?tab=orders" />
        <Card icon={Receipt} label="Unpaid" value={p.unpaidInvoices ? `£${p.unpaidTotal.toFixed(2)} (${p.unpaidInvoices})` : null} empty="No unpaid invoices" href="/dashboard?tab=invoices" accent={hasUnpaid} />
        <Card icon={LifeBuoy} label="Open tickets" value={p.openTickets || null} empty="No open tickets" href="/dashboard?tab=tickets" />
        <Card icon={Gift} label="Rewards" value={null} empty="Coming soon" />
      </div>

      <div className="p-4 border-4 border-foreground bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <LifeBuoy className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-display uppercase text-sm">Need help?</p>
            <p className="text-xs text-muted-foreground">Contact OCCTA support — real humans, no scripts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/support"><Button size="sm" variant="hero">Contact support</Button></Link>
          <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => window.dispatchEvent(new Event("open-ai-chat"))}>
            <MessageCircle className="w-4 h-4 mr-1" /> Chat
          </Button>
        </div>
      </div>

      <div className="p-4 border-2 border-dashed border-foreground/30 bg-background text-sm flex gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5" />
        <span>Important: Digital Voice does not work during a power cut unless backup is fitted. Please tell us if you need extra support.</span>
      </div>
    </div>
  );
}