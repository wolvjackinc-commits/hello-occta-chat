import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "./EmptyState";
import { Package } from "lucide-react";

type Step = { key: string; label: string; at: string | null };

export function OrdersTimelineTab({ userId, userEmail }: { userId: string; userEmail: string | null }) {
  const [timeline, setTimeline] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    (async () => {
      const [qr, qq, cs, ord, inv, rcpt] = await Promise.all([
        supabase.from("quote_requests").select("created_at,status").or(`customer_id.eq.${userId}${userEmail ? `,email.eq.${userEmail.toLowerCase()}` : ""}`).order("created_at", { ascending: false }).limit(1),
        supabase.from("quotes").select("created_at,status").eq("customer_id", userId).order("created_at", { ascending: false }).limit(1),
        supabase.from("contract_summaries").select("issued_at,accepted_at").eq("customer_id", userId).order("issued_at", { ascending: false }).limit(1),
        supabase.from("orders").select("created_at,status,installation_date").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
        supabase.from("invoices").select("issue_date,status").eq("user_id", userId).order("issue_date", { ascending: false }).limit(1),
        supabase.from("receipts").select("paid_at").eq("user_id", userId).order("paid_at", { ascending: false }).limit(1),
      ]);
      const qrRow: any = qr.data?.[0]; const qqRow: any = qq.data?.[0]; const csRow: any = cs.data?.[0];
      const ordRow: any = ord.data?.[0]; const invRow: any = inv.data?.[0]; const rcptRow: any = rcpt.data?.[0];
      const steps: Step[] = [
        { key: "qr", label: "Quote requested", at: qrRow?.created_at ?? null },
        { key: "qs", label: "Quote sent", at: qqRow?.status && qqRow.status !== "draft" ? qqRow.created_at : null },
        { key: "ci", label: "Contract Summary issued", at: csRow?.issued_at ?? null },
        { key: "ca", label: "Contract Summary accepted", at: csRow?.accepted_at ?? null },
        { key: "ip", label: "Payment pending", at: invRow?.status && invRow.status !== "paid" ? invRow.issue_date : null },
        { key: "pc", label: "Payment confirmed", at: rcptRow?.paid_at ?? null },
        { key: "sc", label: "Supplier check", at: ordRow?.created_at ?? null },
        { key: "in", label: "Installation / switching", at: ordRow?.installation_date ?? null },
        { key: "rd", label: "Router dispatch", at: null },
        { key: "sl", label: "Service live", at: ordRow?.status === "active" ? ordRow?.created_at : null },
      ];
      setTimeline(steps);
      setHasAny(steps.some(s => s.at));
      setLoading(false);
    })();
  }, [userId, userEmail]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading timeline…</div>;
  if (!hasAny) {
    return <EmptyState icon={<Package className="w-8 h-8" />} title="No orders yet" message="Once you start a quote your order timeline will appear here." />;
  }

  return (
    <div className="border-4 border-foreground bg-background p-6">
      <h3 className="font-display uppercase text-lg mb-4">Latest order journey</h3>
      <ol className="space-y-3">
        {timeline.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            {s.at ? <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className={`font-medium ${s.at ? "" : "text-muted-foreground"}`}>{s.label}</p>
              {s.at && <p className="text-xs text-muted-foreground">{format(new Date(s.at), "dd MMM yyyy")}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}