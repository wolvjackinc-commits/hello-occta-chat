import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, CreditCard, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  deriveStageFromPayment,
  fulfilmentHint,
  fulfilmentLabel,
  type CustomerFulfilmentStage,
} from "@/lib/journey/fulfilmentStatus";

type PRSnapshot = {
  id: string;
  status: string;
  webhook_verified: boolean | null;
  paid_at: string | null;
  payment_token: string | null;
};

const TONE: Record<CustomerFulfilmentStage, { border: string; bg: string; text: string }> = {
  payment_pending: { border: "border-warning", bg: "bg-warning/10", text: "text-warning-foreground" },
  payment_confirming: { border: "border-accent", bg: "bg-accent/10", text: "text-accent-foreground" },
  payment_received: { border: "border-primary", bg: "bg-primary/10", text: "text-foreground" },
  preparing_setup: { border: "border-primary", bg: "bg-primary/10", text: "text-foreground" },
  installation_arranged: { border: "border-primary", bg: "bg-primary/5", text: "text-foreground" },
  activation_in_progress: { border: "border-primary", bg: "bg-primary/5", text: "text-foreground" },
  service_active: { border: "border-primary", bg: "bg-primary/10", text: "text-foreground" },
  cancelled: { border: "border-destructive", bg: "bg-destructive/10", text: "text-destructive" },
};

function Icon({ stage }: { stage: CustomerFulfilmentStage }) {
  if (stage === "payment_pending") return <CreditCard className="w-5 h-5" />;
  if (stage === "payment_confirming") return <Clock className="w-5 h-5 animate-pulse" />;
  return <CheckCircle2 className="w-5 h-5" />;
}

export function PaidStateBanner({ userId }: { userId: string }) {
  const [pr, setPr] = useState<PRSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("id,status,webhook_verified,paid_at,payment_token")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setPr((data?.[0] as PRSnapshot) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading || !pr) return null;

  const stage = deriveStageFromPayment(pr);
  if (!stage) return null;

  const tone = TONE[stage];

  return (
    <div className={`mb-6 border-4 border-foreground ${tone.bg} p-5`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 flex-shrink-0 border-4 ${tone.border} bg-background flex items-center justify-center ${tone.text}`}>
          <Icon stage={stage} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display uppercase text-sm tracking-wider">{fulfilmentLabel(stage)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{fulfilmentHint(stage)}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {stage === "payment_pending" && pr.payment_token && (
              <a href={`/pay?token=${encodeURIComponent(pr.payment_token)}`}>
                <Button size="sm" variant="hero">
                  <CreditCard className="w-4 h-4 mr-1" /> Complete payment
                </Button>
              </a>
            )}
            <Link to="/support">
              <Button size="sm" variant="outline" className="border-2 border-foreground">
                <LifeBuoy className="w-4 h-4 mr-1" /> Need help?
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaidStateBanner;