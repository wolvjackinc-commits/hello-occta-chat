import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Mail } from "lucide-react";
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
  monthly_price_incl_vat: number | null;
  business_monthly_ex_vat: number | null;
  business_monthly_incl_vat: number | null;
  expires_at: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted",
  sent: "bg-accent",
  viewed: "bg-warning",
  accepted: "bg-primary",
  rejected: "bg-destructive",
  expired: "bg-muted",
  converted: "bg-primary",
};

export function QuotesTab({ userId }: { userId: string }) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:quotes", source_module: "dashboard" });
    (async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id,quote_number,plan_name,service_type,plan_type,customer_type,status,monthly_price_incl_vat,business_monthly_ex_vat,business_monthly_incl_vat,expires_at,created_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      setQuotes((data as QuoteRow[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading quotes…</div>;
  if (quotes.length === 0) {
    return <EmptyState icon={<FileText className="w-8 h-8" />} title="No quotes yet" message="Request a quote to see it appear here." />;
  }

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
        const isBusiness = q.customer_type === "business";
        const expired = q.expires_at && new Date(q.expires_at) < new Date();
        return (
          <div key={q.id} className="border-4 border-foreground bg-background p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-display uppercase">{q.plan_name || "Quote"}</h4>
                <Badge className={`${statusColors[q.status] || "bg-muted"} border-2 border-foreground capitalize`}>{q.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {q.quote_number ? `${q.quote_number} · ` : ""}
                {q.service_type} · {q.plan_type}
                {q.expires_at && ` · ${expired ? "Expired" : "Expires"} ${format(new Date(q.expires_at), "dd MMM yyyy")}`}
              </p>
            </div>
            <div className="text-right">
              {isBusiness ? (
                <>
                  <p className="font-display text-lg">£{Number(q.business_monthly_ex_vat || 0).toFixed(2)} <span className="text-xs">ex VAT</span></p>
                  <p className="text-xs text-muted-foreground">£{Number(q.business_monthly_incl_vat || 0).toFixed(2)} incl VAT / mo</p>
                </>
              ) : (
                <p className="font-display text-lg">£{Number(q.monthly_price_incl_vat || 0).toFixed(2)}<span className="text-xs">/mo</span></p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                <Mail className="w-3 h-3" />
                Contact OCCTA to resend the secure link
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}