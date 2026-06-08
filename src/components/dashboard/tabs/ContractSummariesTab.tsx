import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileCheck2, Download, Lock } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type CSRow = {
  id: string;
  cs_number: string | null;
  plan_name: string;
  service_address: string | null;
  status: string;
  version: number;
  monthly_price_incl_vat: number | null;
  contract_length: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  pdf_url: string | null;
};

export function ContractSummariesTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CSRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:contract_summaries", source_module: "dashboard" });
    (async () => {
      const { data } = await supabase
        .from("contract_summaries")
        .select("id,cs_number,plan_name,service_address,status,version,monthly_price_incl_vat,contract_length,issued_at,accepted_at,pdf_url")
        .eq("customer_id", userId)
        .order("issued_at", { ascending: false });
      setRows((data as CSRow[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0) {
    return <EmptyState icon={<FileCheck2 className="w-8 h-8" />} title="No contract summaries" message="When a quote is sent, its Contract Summary will appear here." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border-4 border-foreground bg-background p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display uppercase">{r.plan_name}</h4>
              <Badge className="border-2 border-foreground capitalize">{r.status}</Badge>
              {r.status === "accepted" && (
                <Badge className="bg-primary border-2 border-foreground"><Lock className="w-3 h-3 mr-1" /> Locked</Badge>
              )}
              <span className="text-xs text-muted-foreground">v{r.version}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {r.cs_number ? `${r.cs_number} · ` : ""}
              {r.service_address}
              {r.issued_at && ` · Issued ${format(new Date(r.issued_at), "dd MMM yyyy")}`}
              {r.accepted_at && ` · Accepted ${format(new Date(r.accepted_at), "dd MMM yyyy")}`}
              {r.contract_length && ` · ${r.contract_length}`}
            </p>
          </div>
          <div className="text-right flex items-center gap-3">
            <p className="font-display text-lg">£{Number(r.monthly_price_incl_vat || 0).toFixed(2)}<span className="text-xs">/mo</span></p>
            {r.pdf_url ? (
              <a href={r.pdf_url} target="_blank" rel="noopener noreferrer"
                onClick={() => logClientEvent({ event_type: "contract_summary_view_from_dashboard", title: "cs.pdf.open", source_module: "dashboard" })}>
                <Button size="sm" variant="outline" className="border-2 border-foreground"><Download className="w-4 h-4 mr-1" /> PDF</Button>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Contact OCCTA to resend</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}