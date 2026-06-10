import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Info } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type Row = {
  id: string;
  reference: string;
  postcode: string | null;
  service_interest: string | null;
  plan_preference: string | null;
  customer_type: string | null;
  status: string;
  message: string | null;
  source: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  assigned: "bg-accent text-accent-foreground",
  checking: "bg-secondary",
  quoted: "bg-primary/70 text-primary-foreground",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  converted: "bg-primary text-primary-foreground",
};

/** Best-effort: parse "Build Plan: <bucket> · <term> · router=... · setup=... · addons=..." */
function parseBuildPlanMessage(msg: string | null) {
  if (!msg) return null;
  const m = msg.match(/Build Plan:\s*([^·]+)·\s*([^·]+)·/);
  if (!m) return null;
  return { bucket: m[1].trim(), term: m[2].trim() };
}

export function QuoteRequestsTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:quote-requests", source_module: "dashboard" });
    (async () => {
      // Use SECURITY DEFINER RPC that returns only safe customer-facing columns
      const { data, error } = await (supabase as any).rpc("get_customer_quote_requests");
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading your quote requests…</div>;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-8 h-8" />}
        title="No quote requests yet"
        message="When you submit a Build Plan we'll show your reference and selections here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-foreground/20 bg-muted/40 p-3 text-xs flex gap-2 items-start">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          These are quote requests, not orders. <strong>No payment has been taken.</strong>{" "}
          We'll confirm final speed, setup and order details before you proceed.
        </span>
      </div>
      {rows.map((r) => {
        const parsed = parseBuildPlanMessage(r.message);
        return (
          <div key={r.id} className="border-4 border-foreground bg-background p-4 flex flex-col md:flex-row md:items-start gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{r.reference}</span>
                <Badge className={`${statusColors[r.status] ?? "bg-muted"} border-2 border-foreground capitalize`}>
                  {r.status}
                </Badge>
              </div>
              <div className="mt-2 text-sm space-y-0.5">
                {parsed ? (
                  <>
                    <p><span className="text-muted-foreground">Speed:</span> <strong>{parsed.bucket}</strong></p>
                    <p><span className="text-muted-foreground">Plan:</span> <strong>{parsed.term}</strong></p>
                  </>
                ) : (
                  <p className="text-muted-foreground capitalize">{r.service_interest} · {r.plan_preference?.replace("_", " ")}</p>
                )}
                {r.postcode && <p><span className="text-muted-foreground">Postcode:</span> <span className="font-mono">{r.postcode}</span></p>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground md:text-right">
              {format(new Date(r.created_at), "dd MMM yyyy · HH:mm")}
            </div>
          </div>
        );
      })}
    </div>
  );
}