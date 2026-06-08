import { Link } from "react-router-dom";
import { Wifi, FileText, Package, Receipt, LifeBuoy, Gift, AlertTriangle } from "lucide-react";

type Props = {
  activeServices: number;
  pendingQuotes: number;
  latestOrderStatus: string | null;
  unpaidInvoices: number;
  unpaidTotal: number;
  openTickets: number;
};

function Card({ icon: Icon, label, value, empty, href }: any) {
  const content = (
    <div className="p-4 border-4 border-foreground bg-background h-full">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground"><Icon className="w-4 h-4" /><span className="text-xs uppercase font-display">{label}</span></div>
      <p className="font-display text-2xl">{value ?? empty}</p>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

export function OverviewTab(p: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={Wifi} label="Active services" value={p.activeServices || null} empty="None yet" />
        <Card icon={FileText} label="Open quotes" value={p.pendingQuotes || null} empty="No open quotes" />
        <Card icon={Package} label="Latest order" value={p.latestOrderStatus} empty="No orders" />
        <Card icon={Receipt} label="Unpaid" value={p.unpaidInvoices ? `£${p.unpaidTotal.toFixed(2)} (${p.unpaidInvoices})` : null} empty="No unpaid invoices" />
        <Card icon={LifeBuoy} label="Open tickets" value={p.openTickets || null} empty="No open tickets" />
        <Card icon={Gift} label="Rewards" value={null} empty="Coming soon" />
      </div>
      <div className="p-4 border-2 border-dashed border-foreground/30 bg-background text-sm flex gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5" />
        <span>Important: Digital Voice does not work during a power cut unless backup is fitted. Please tell us if you need extra support.</span>
      </div>
    </div>
  );
}