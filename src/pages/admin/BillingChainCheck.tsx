import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { invokeFn } from "@/lib/invokeFn";
import { toast } from "@/hooks/use-toast";

type Row = {
  service_id: string;
  order_number: string | null;
  customer_name: string | null;
  account_number: string | null;
  email: string | null;
  service_status: string | null;
  payment_method: string | null;
  actual_activation_date: string | null;
  next_billing_date: string | null;
  first_invoice_status: string | null;
  first_invoice_paid: boolean;
  payment_request_status: string | null;
  welcome_email_status: string | null;
  first_billing_job_status: string | null;
  first_billing_job_blocker: string | null;
  dd_mandate_status: string | null;
  classifications: string[];
  applied: string[];
  admin_task_created: boolean;
};

type Summary = {
  total: number; ok: number; auto_fixed: number; manual_review: number;
  missing_welcome: number; missing_first_invoice: number; missing_payment_link: number;
  missing_next_billing_date: number; dd_mandate_not_active: number;
  recurring_ready: number; recurring_not_ready: number;
};

const badgeFor = (c: string) => {
  if (c === "ok") return "bg-success/20 border-success";
  if (c === "recurring_not_ready" || c === "missing_next_billing_date") return "bg-warning/15 border-warning";
  return "bg-destructive/15 border-destructive";
};

export function AdminBillingChainCheck() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<"report" | "fix" | null>(null);

  const run = async (m: "report" | "fix") => {
    setLoading(true); setMode(m);
    try {
      const { data, error } = await invokeFn<{ summary: Summary; rows: Row[] }>(
        "verify-live-billing-chain",
        { body: { mode: m, lookback_days: 180 } },
      );
      if (error) throw error;
      setRows(data?.rows ?? []);
      setSummary(data?.summary ?? null);
      toast({
        title: m === "fix" ? "Safe fixes applied" : "Report generated",
        description: `${data?.summary?.total ?? 0} services checked · ${data?.summary?.ok ?? 0} OK · ${data?.summary?.manual_review ?? 0} manual review`,
      });
    } catch (e: any) {
      toast({ title: "Chain check failed", description: e.message || String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { run("report"); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">LIVE BILLING CHAIN CHECK</h1>
          <p className="text-sm text-muted-foreground">
            Verifies every live broadband service has welcome email, first invoice/payment link,
            next billing date and recurring-billing readiness. Runs daily; safe fixes only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run("report")} disabled={loading}>
            {loading && mode === "report" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Re-run report
          </Button>
          <Button variant="hero" onClick={() => run("fix")} disabled={loading}>
            {loading && mode === "fix" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Apply safe fixes
          </Button>
        </div>
      </div>

      {summary && (
        <Card className="border-2 border-foreground p-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <Stat label="Total" value={summary.total} />
          <Stat label="OK" value={summary.ok} tone="success" />
          <Stat label="Auto-fixed" value={summary.auto_fixed} />
          <Stat label="Manual review" value={summary.manual_review} tone="destructive" />
          <Stat label="Recurring ready" value={summary.recurring_ready} tone="success" />
          <Stat label="Recurring NOT ready" value={summary.recurring_not_ready} tone="warning" />
        </Card>
      )}

      <Card className="border-2 border-foreground overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground">
            <tr className="text-left">
              <th className="p-2">Customer</th>
              <th className="p-2">Order</th>
              <th className="p-2">Status</th>
              <th className="p-2">Activated</th>
              <th className="p-2">Method</th>
              <th className="p-2">Welcome</th>
              <th className="p-2">First invoice</th>
              <th className="p-2">Pay link</th>
              <th className="p-2">DD</th>
              <th className="p-2">Next bill</th>
              <th className="p-2">Classifications</th>
              <th className="p-2">Applied / Task</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.service_id} className="border-b border-foreground/10 align-top">
                <td className="p-2">{r.customer_name ?? "—"}<div className="text-xs text-muted-foreground">{r.account_number} · {r.email}</div></td>
                <td className="p-2 font-mono text-xs">{r.order_number ?? "—"}</td>
                <td className="p-2">{r.service_status}</td>
                <td className="p-2">{r.actual_activation_date ?? "—"}</td>
                <td className="p-2">{r.payment_method ?? "—"}</td>
                <td className="p-2">{r.welcome_email_status ?? <span className="text-destructive">missing</span>}</td>
                <td className="p-2">{r.first_invoice_status ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2">{r.payment_request_status ?? "—"}</td>
                <td className="p-2">{r.dd_mandate_status ?? "—"}</td>
                <td className="p-2">{r.next_billing_date ?? "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {r.classifications.map(c => (
                      <Badge key={c} variant="outline" className={`border-2 ${badgeFor(c)} text-xs`}>{c}</Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-xs">
                  {r.applied.length > 0 && <div className="text-success">✓ {r.applied.join(", ")}</div>}
                  {r.admin_task_created && <div className="flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" /> Task filed</div>}
                  {r.applied.length === 0 && !r.admin_task_created && <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">No services in scope.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`font-display text-xl ${cls}`}>{value}</div>
    </div>
  );
}

export default AdminBillingChainCheck;