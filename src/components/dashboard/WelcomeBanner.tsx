import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck, X, Wifi, Receipt, FileText, LifeBuoy, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReadyItem = {
  icon: any;
  label: string;
  value: string;
  href: string;
};

type Props = {
  name: string;
  accountNumber?: string | null;
  linkedRecords?: number;
  identityVerified?: boolean;
  activeServices: number;
  outstandingInvoices: number;
  outstandingTotal: number;
  documents: number;
  openTickets: number;
};

export function WelcomeBanner(p: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const items: ReadyItem[] = [
    {
      icon: Wifi,
      label: "Services",
      value: p.activeServices ? `${p.activeServices} active` : "Setup in progress",
      href: "/dashboard?tab=order-service",
    },
    {
      icon: Receipt,
      label: "Billing",
      value: p.outstandingInvoices
        ? `£${p.outstandingTotal.toFixed(2)} due`
        : "Nothing to pay",
      href: "/dashboard?tab=billing",
    },
    {
      icon: FileText,
      label: "Documents",
      value: p.documents ? `${p.documents} available` : "Being prepared",
      href: "/dashboard?tab=documents",
    },
    {
      icon: LifeBuoy,
      label: "Support",
      value: p.openTickets ? `${p.openTickets} open` : "All clear",
      href: "/dashboard?tab=support",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative mb-8 border-4 border-foreground bg-card shadow-[8px_8px_0_0_hsl(var(--foreground))]"
    >
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss welcome banner"
        className="absolute top-3 right-3 p-1 border-2 border-foreground bg-background hover:bg-secondary"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="bg-primary text-primary-foreground border-b-4 border-foreground px-6 py-5">
        <div className="flex items-start gap-3 pr-8">
          <BadgeCheck className="w-7 h-7 shrink-0 mt-0.5" />
          <div>
            <p className="font-display uppercase text-xs tracking-[0.2em] opacity-80">
              Account linked
            </p>
            <h2 className="text-display-sm font-display uppercase leading-tight">
              Welcome to OCCTA, {p.name}
            </h2>
            <p className="text-sm mt-1 opacity-90">
              {p.linkedRecords
                ? `We connected ${p.linkedRecords} record${p.linkedRecords === 1 ? "" : "s"} to your account. `
                : "Everything under your email is connected to this account. "}
              {p.accountNumber ? (
                <>
                  Account <span className="font-mono">{p.accountNumber}</span> is live.
                </>
              ) : (
                <>Your account is live.</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3">
          What's ready now
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <Link key={it.label} to={it.href} className="group">
              <div className="h-full p-3 border-2 border-foreground bg-background transition-all group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[5px_5px_0_0_hsl(var(--foreground))]">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <it.icon className="w-4 h-4" />
                  <span className="text-[11px] font-display uppercase tracking-wider">{it.label}</span>
                </div>
                <p className="font-display text-sm uppercase">{it.value}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t-2 border-foreground/20 pt-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            {p.identityVerified
              ? "Identity verified — full account access enabled."
              : "Verify your identity to unlock sensitive account actions."}
          </p>
          <Link to="/dashboard?tab=account">
            <Button size="sm" variant="outline" className="border-2 border-foreground">
              Account settings <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}