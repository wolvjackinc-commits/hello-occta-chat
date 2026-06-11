import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Clock, Info } from "lucide-react";
import { format } from "date-fns";
import { deriveMilestones, nextStepCopy, type JourneySafeInputs, type Milestone } from "@/lib/journey/milestones";

/**
 * Customer-safe journey timeline. Queries only the narrow whitelisted
 * columns required by the milestone deriver. RLS on each source table
 * already enforces self-only access; this component never reads supplier,
 * margin, admin, webhook payload, or token-hash fields.
 */
export function CustomerJourneyTimeline({ userId, userEmail }: { userId: string; userEmail: string | null }) {
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const email = userEmail?.toLowerCase() ?? null;
      const qrFilter = email
        ? `customer_id.eq.${userId},email.eq.${email}`
        : `customer_id.eq.${userId}`;

      const [qrRes, qRes, csRes, caRes, prRes] = await Promise.all([
        supabase.from("quote_requests").select("status,created_at").or(qrFilter).order("created_at", { ascending: false }).limit(1),
        supabase.from("quotes").select("status,created_at").eq("customer_id", userId).order("created_at", { ascending: false }).limit(1),
        supabase.from("contract_summaries").select("issued_at").eq("customer_id", userId).order("issued_at", { ascending: false }).limit(1),
        supabase.from("contract_acceptances").select("accepted_at").eq("customer_id", userId).order("accepted_at", { ascending: false }).limit(1),
        supabase.from("payment_requests").select("status,webhook_verified,paid_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      ]);

      if (cancelled) return;

      const inputs: JourneySafeInputs = {
        quoteRequest: (qrRes.data?.[0] as any) ?? null,
        quote: (qRes.data?.[0] as any) ?? null,
        contractSummary: (csRes.data?.[0] as any) ?? null,
        contractAccepted: (caRes.data?.[0] as any) ?? null,
        paymentRequest: (prRes.data?.[0] as any) ?? null,
        readinessStatus: null,
        hasDraftOrderPack: false,
      };

      const ms = deriveMilestones(inputs);
      setMilestones(ms);
      setHasAny(ms.some((m) => m.state !== "upcoming"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, userEmail]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading timeline…</div>;

  const next = nextStepCopy(milestones);

  return (
    <div className="border-4 border-foreground bg-background p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <h3 className="font-display uppercase text-lg">Your order journey</h3>
      </div>

      {!hasAny && (
        <div className="mb-4 p-3 border-2 border-dashed border-foreground/30 flex gap-2 text-sm">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Once you start a quote, your journey will appear here.</span>
        </div>
      )}

      <ol className="space-y-3">
        {milestones.map((m) => (
          <li key={m.key} className="flex items-start gap-3">
            {m.state === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            ) : m.state === "current" ? (
              <Clock className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${m.state === "upcoming" ? "text-muted-foreground" : ""}`}>
                {m.label}
              </p>
              <p className={`text-xs ${m.state === "upcoming" ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                {m.description}
              </p>
              {m.at && m.state === "done" && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                  {format(new Date(m.at), "dd MMM yyyy")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 p-3 border-2 border-foreground bg-muted/30 text-sm">
        <span className="font-display uppercase text-xs block mb-1">Next step</span>
        <span>{next}</span>
      </div>
    </div>
  );
}

export default CustomerJourneyTimeline;