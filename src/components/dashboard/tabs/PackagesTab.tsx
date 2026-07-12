import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Package,
  PhoneCall,
  Smartphone,
  Wifi,
  Zap,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

type Service = {
  id: string;
  service_type: string;
  plan_name: string | null;
  status: string;
  activation_date: string | null;
  price_monthly: number | null;
  contract_type: string | null;
  minimum_term_end_date: string | null;
  notice_period_days: number | null;
};

const CATEGORIES = [
  {
    key: "broadband",
    label: "Broadband",
    icon: Wifi,
    match: (t: string) => t.includes("broadband") || t.includes("fttp") || t.includes("fttc") || t.includes("sogea"),
    changeHref: "/broadband?change=1",
    addHref: "/broadband",
    addLabel: "Add broadband",
  },
  {
    key: "sim",
    label: "Mobile / SIM",
    icon: Smartphone,
    match: (t: string) => t.includes("sim") || t.includes("mobile"),
    changeHref: "/sim",
    addHref: "/sim",
    addLabel: "Add SIM",
  },
  {
    key: "landline",
    label: "Home Phone",
    icon: PhoneCall,
    match: (t: string) => t.includes("voice") || t.includes("landline") || t.includes("phone"),
    changeHref: "/landline",
    addHref: "/landline",
    addLabel: "Add home phone",
  },
];

export function PackagesTab({ userId }: { userId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customer_services" as any)
        .select(
          "id, service_type, plan_name, status, activation_date, price_monthly, contract_type, minimum_term_end_date, notice_period_days"
        )
        .order("created_at", { ascending: false });
      setServices(((data as unknown) as Service[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const liveStatuses = new Set(["live", "active"]);
  const live = services.filter((s) => liveStatuses.has((s.status || "").toLowerCase()));
  const totalMonthly = live.reduce((s, x) => s + Number(x.price_monthly || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 border-4 border-foreground bg-background">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Active packages</p>
          <p className="font-display text-2xl">{live.length}</p>
        </div>
        <div className="p-4 border-4 border-foreground bg-background">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">Monthly total</p>
          <p className="font-display text-2xl">£{totalMonthly.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">incl. VAT where applicable</p>
        </div>
        <div className="p-4 border-4 border-foreground bg-background col-span-2 md:col-span-2">
          <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">Explore</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/broadband">
              <Button size="sm" variant="outline" className="border-2 border-foreground">Broadband plans</Button>
            </Link>
            <Link to="/sim">
              <Button size="sm" variant="outline" className="border-2 border-foreground">SIM plans</Button>
            </Link>
            <Link to="/landline">
              <Button size="sm" variant="outline" className="border-2 border-foreground">Home phone</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const items = live.filter((s) => cat.match((s.service_type || "").toLowerCase()));
        return (
          <section key={cat.key}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display uppercase flex items-center gap-2">
                <Icon className="w-4 h-4" /> {cat.label}
              </h3>
              {items.length > 0 && (
                <Link to={cat.addHref}>
                  <Button size="sm" variant="outline" className="border-2 border-foreground">
                    <Package className="w-4 h-4 mr-1" /> Add another
                  </Button>
                </Link>
              )}
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={<Icon className="w-8 h-8" />}
                title={`No ${cat.label.toLowerCase()} yet`}
                message="Browse plans to add one to your account — no long tie-ins, cancel with notice."
                action={
                  <Link to={cat.addHref}>
                    <Button variant="hero" size="sm">{cat.addLabel}</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {items.map((s) => {
                  const contract = s.contract_type || (s.plan_name || "").toLowerCase().includes("saver") ? "Contract Saver" : "Flex";
                  const inMinTerm =
                    s.minimum_term_end_date && new Date(s.minimum_term_end_date) > new Date();
                  return (
                    <div key={s.id} className="p-4 border-4 border-foreground bg-background">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-display uppercase">{s.plan_name || s.service_type}</h4>
                          <p className="text-xs text-muted-foreground capitalize">
                            {s.service_type} · {contract}
                            {s.activation_date && ` · Active ${format(new Date(s.activation_date), "dd MMM yyyy")}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg">£{Number(s.price_monthly || 0).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">per month</p>
                        </div>
                      </div>

                      {(inMinTerm || s.notice_period_days) && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {inMinTerm && (
                            <div className="p-2 border-2 border-warning bg-warning/10 flex items-start gap-2">
                              <ShieldAlert className="w-4 h-4 mt-0.5" />
                              <span>
                                Minimum term ends {format(new Date(s.minimum_term_end_date!), "dd MMM yyyy")}.
                                Downgrades may attract early-termination fees.
                              </span>
                            </div>
                          )}
                          {s.notice_period_days ? (
                            <div className="p-2 border-2 border-foreground/30 bg-muted/40 flex items-start gap-2">
                              <RefreshCw className="w-4 h-4 mt-0.5" />
                              <span>{s.notice_period_days}-day notice period applies to changes and cancellations.</span>
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Link to={cat.changeHref} className="w-full">
                          <Button variant="hero" className="w-full justify-between">
                            <span className="flex items-center gap-2">
                              <Zap className="w-4 h-4" /> Upgrade or switch plan
                            </span>
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link to="/support" className="w-full">
                          <Button variant="outline" className="w-full justify-between border-2 border-foreground">
                            <span>Change something else</span>
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <div className="p-3 border-2 border-dashed border-foreground/30 bg-background text-xs text-muted-foreground">
        <Badge className="border-2 border-foreground bg-secondary text-foreground mr-2">Fair change</Badge>
        Upgrades apply from your next billing date. Downgrades and cancellations respect any minimum term and notice period on your contract.
      </div>
    </div>
  );
}

export default PackagesTab;