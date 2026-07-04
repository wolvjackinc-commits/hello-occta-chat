import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { invokeFn } from "@/lib/invokeFn";
import { toast } from "@/hooks/use-toast";

type Row = {
  account_number: string | null; customer_name: string | null; email: string | null;
  order_number: string | null; service_id: string; actual_activation_date: string | null;
  monthly_price: number | null; payment_method: string | null; billing_anchor_day: number | null;
  next_billing_date: string | null;
  first_invoice: null | { number: string; total: number; status: string; issue_date: string; period: string };
  last_invoice_period: string | null;
  classification: string; recommended: string;
  safe_to_auto_fix: boolean; applied: string | null;
};

const badgeClass = (c: string) =>
  c === "ok" ? "bg-success/20 border-success" :
  c === "manual_review" ? "bg-destructive/15 border-destructive" :
  "bg-warning/15 border-warning";

export function AdminBillingReconciliation() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [mode, setMode] = useState<"report" | "apply" | null>(null);

  const run = async (m: "report" | "apply") => {
    setLoading(true); setMode(m);
    try {
      const { data, error } = await invokeFn<{ summary: any; rows: Row[] }>("billing-reconciliation", { body: { mode: m } });
      if (error) throw error;
      setRows(data?.rows ?? []); setSummary(data?.summary ?? null);
      toast({ title: m === "apply" ? "Auto-fixes applied" : "Report generated", description: `${data?.summary?.total ?? 0} services reviewed.` });
    } catch (e: any) {
      toast({ title: "Reconciliation failed", description: e.message || String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">BILLING RECONCILIATION</h1>
          <p className="text-sm text-muted-foreground">Read-only report of active service billing state. Safe auto-fix is deterministic only.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run("report")} disabled={loading}>
            {loading && mode === "report" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Run report (dry-run)
          </Button>
          <Button variant="hero" onClick={() => run("apply")} disabled={loading || rows.length === 0}>
            {loading && mode === "apply" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Apply safe fixes
          </Button>
        </div>
      </div>

      {summary && (
        <Card className="border-2 border-foreground p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><div className="text-xs uppercase text-muted-foreground">Total</div><div className="font-display text-xl">{summary.total}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">OK</div><div className="font-display text-xl text-success">{summary.ok}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Auto-fixable</div><div className="font-display text-xl">{summary.auto_fixable}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Auto-fixed</div><div className="font-display text-xl">{summary.auto_fixed}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Manual review</div><div className="font-display text-xl text-destructive">{summary.manual_review}</div></div>
        </Card>
      )}

      <Card className="border-2 border-foreground overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground">
            <tr className="text-left">
              <th className="p-2">Account</th><th className="p-2">Customer</th><th className="p-2">Order</th>
              <th className="p-2">Activated</th><th className="p-2">Method</th><th className="p-2">Anchor</th>
              <th className="p-2">First invoice</th><th className="p-2">Next</th>
              <th className="p-2">Status</th><th className="p-2">Recommended</th><th className="p-2">Applied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.service_id} className="border-b border-foreground/10 align-top">
                <td className="p-2 font-mono text-xs">{r.account_number ?? "—"}</td>
                <td className="p-2">{r.customer_name ?? "—"}<div className="text-xs text-muted-foreground">{r.email}</div></td>
                <td className="p-2 font-mono text-xs">{r.order_number ?? "—"}</td>
                <td className="p-2">{r.actual_activation_date ?? "—"}</td>
                <td className="p-2">{r.payment_method ?? "—"}</td>
                <td className="p-2">{r.billing_anchor_day ?? "—"}</td>
                <td className="p-2">{r.first_invoice ? <>{r.first_invoice.number}<div className="text-xs text-muted-foreground">£{r.first_invoice.total} · {r.first_invoice.status}</div></> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2">{r.next_billing_date ?? "—"}</td>
                <td className="p-2"><Badge variant="outline" className={`border-2 ${badgeClass(r.classification)}`}>{r.classification}</Badge></td>
                <td className="p-2 text-xs">{r.recommended}</td>
                <td className="p-2 text-xs">{r.applied ?? (r.safe_to_auto_fix ? <span className="text-muted-foreground">pending</span> : "—")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Click "Run report" to load billing state for all active services.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default AdminBillingReconciliation;