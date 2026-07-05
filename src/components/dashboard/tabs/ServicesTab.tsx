import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Wifi, AlertTriangle, Router, ArrowUpRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { CancellationRequestCard } from "@/components/dashboard/CancellationRequestCard";

type Service = {
  id: string;
  service_type: string;
  plan_name: string | null;
  status: string;
  activation_date: string | null;
  price_monthly: number | null;
};

export function ServicesTab({ userId }: { userId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Phase 7: customer-safe — never expose supplier_reference / supplier_*
      const { data } = await supabase
        .from("services")
        .select("id,service_type,plan_name,status,activation_date,price_monthly")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setServices((data as Service[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  // Phase 3: only surface services the admin has explicitly marked live/active.
  // Anything still being provisioned stays hidden behind a friendly notice.
  const liveStatuses = new Set(["live", "active"]);
  const liveServices = services.filter((s) => liveStatuses.has((s.status || "").toLowerCase()));
  const pendingCount = services.length - liveServices.length;

  if (liveServices.length === 0) {
    return (
      <EmptyState
        icon={<Wifi className="w-8 h-8" />}
        title={pendingCount > 0 ? "Service being prepared" : "No active services"}
        message={
          pendingCount > 0
            ? "Your service is being set up. It'll appear here as soon as our team marks it live — you'll get an email the moment it's ready."
            : "Your services will appear here after activation."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {liveServices.map((s) => {
        const hasVoice = (s.service_type || "").toLowerCase().includes("voice") || (s.service_type || "").toLowerCase().includes("landline");
        const contractType = (s.plan_name || "").toLowerCase().includes("saver") ? "Contract Saver" : "Flex";
        return (
          <div key={s.id} className="border-4 border-foreground bg-background p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="font-display uppercase">{s.plan_name || s.service_type}</h4>
                <p className="text-xs text-muted-foreground capitalize">
                  {s.service_type} · {contractType}
                  {s.activation_date && ` · Active ${format(new Date(s.activation_date), "dd MMM yyyy")}`}
                </p>
              </div>
              <Badge className="border-2 border-foreground capitalize">{s.status}</Badge>
            </div>
            {hasVoice && (
              <div className="mt-3 p-3 bg-warning/15 border-2 border-warning text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Digital Voice does not work during a power cut unless backup power is available. If you rely on your phone for emergency calls, medical equipment or telecare, please tell us.</span>
              </div>
            )}
            {(s.status === "active" || s.status === "live") && (
              <div className="mt-3">
                <CancellationRequestCard userId={userId} serviceId={s.id} />
              </div>
            )}
            {(s.status === "active" || s.status === "live") && (s.service_type || "").toLowerCase().includes("broadband") && (
              <Link
                to="/help/own-router-setup"
                className="mt-3 flex items-center gap-2 border-2 border-foreground bg-secondary p-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Router className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">
                  <strong className="font-display uppercase">Using your own router?</strong>{" "}
                  Step-by-step PPPoE setup guide. Use the username and password from your welcome email.
                </span>
              </Link>
            )}
            {(s.status === "active" || s.status === "live") && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link to="/broadband?change=1" className="w-full">
                  <Button variant="outline" className="w-full border-2 border-foreground justify-between">
                    <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Change or upgrade plan</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/support" className="w-full">
                  <Button variant="outline" className="w-full border-2 border-foreground justify-between">
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Report a fault</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}