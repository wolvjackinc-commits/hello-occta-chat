import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Wifi, AlertTriangle } from "lucide-react";
import { EmptyState } from "./EmptyState";

type Service = {
  id: string;
  service_type: string;
  plan_name: string | null;
  status: string;
  activation_date: string | null;
  price_monthly: number | null;
  supplier_reference: string | null;
};

export function ServicesTab({ userId }: { userId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("services")
        .select("id,service_type,plan_name,status,activation_date,price_monthly,supplier_reference")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setServices((data as Service[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (services.length === 0) {
    return <EmptyState icon={<Wifi className="w-8 h-8" />} title="No active services" message="Your services will appear here after activation." />;
  }

  return (
    <div className="space-y-3">
      {services.map((s) => {
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
                  {s.supplier_reference && ` · Ref ${s.supplier_reference}`}
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
          </div>
        );
      })}
    </div>
  );
}