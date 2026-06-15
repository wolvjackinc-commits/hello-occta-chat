import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, ShieldCheck } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type QuoteRow = {
  id: string;
  quote_number: string | null;
  plan_name: string | null;
  service_type: string | null;
  plan_type: string | null;
  customer_type: string | null;
  status: string;
  monthly_net: number | null;
  monthly_gross: number | null;
  total_due_today_gross: number | null;
  contract_length_months: number | null;
  expires_at: string | null;
  approved_at: string | null;
  created_at: string;
  quote_request_reference: string | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted",
  sent: "bg-accent",
  viewed: "bg-warning",
  approved: "bg-primary text-primary-foreground",
  accepted: "bg-primary",
  expired: "bg-muted",
};

const statusLabel: Record<string, string> = {
  approved: "Final quote ready",
  sent: "Quote sent",
  viewed: "Quote viewed",
  accepted: "Quote accepted",
  expired: "Expired",
};

export function QuotesTab({ userId }: { userId: string }) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:quotes", source_module: "dashboard" });
    (async () => {
      // Customer-safe RPC — never reads the raw quotes table from the client.
      const { data } = await (supabase as any).rpc("get_customer_quotes");
      setQuotes((data as QuoteRow[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading quotes…</div>;
  if (quotes.length === 0) {
    return <EmptyState icon={<FileText className="w-8 h-8" />} title="Quote under review" message="A real person is reviewing your details. We'll email you when your final quote is ready — usually within one working day." />;
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-foreground/20 bg-muted/40 p-3 text-xs flex gap-2 items-start">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          <strong>No payment has been taken.</strong> A Contract Summary will be provided before you can order — nothing is final until you accept it.
        </span>
      </div>
      {quotes.map((q) => {
        const isBusiness = q.customer_type === "business";
        const expired = q.expires_at && new Date(q.expires_at) < new Date();
        const label = statusLabel[q.status] ?? q.status;
        return (
          <div key={q.id} className="border-4 border-foreground bg-background p-4 flex flex-col md:flex-row md:items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-display uppercase">{q.plan_name || "Quote"}</h4>
                <Badge className={`${statusColors[q.status] || "bg-muted"} border-2 border-foreground`}>{label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {q.quote_number ? `${q.quote_number} · ` : ""}
                {q.plan_type === "flex" ? "Flex 30" : (q.contract_length_months ? `Price Lock ${q.contract_length_months}` : q.plan_type)}
                {q.expires_at && ` · ${expired ? "Expired" : "Valid until"} ${format(new Date(q.expires_at), "dd MMM yyyy")}`}
              </p>
              {Number(q.total_due_today_gross || 0) > 0 && (
                <p className="text-xs mt-1">Estimated first bill: <strong>£{Number(q.total_due_today_gross).toFixed(2)}</strong> (incl. VAT)</p>
              )}
            </div>
            <div className="text-right">
              {isBusiness ? (
                <>
                  <p className="font-display text-lg">£{Number(q.monthly_net || 0).toFixed(2)} <span className="text-xs">ex VAT</span></p>
                  <p className="text-xs text-muted-foreground">£{Number(q.monthly_gross || 0).toFixed(2)} incl VAT / mo</p>
                </>
              ) : (
                <p className="font-display text-lg">£{Number(q.monthly_gross || 0).toFixed(2)}<span className="text-xs">/mo (incl. VAT)</span></p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">Contract Summary will follow</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}