import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, ShieldCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFn } from "@/lib/invokeFn";
import { toast } from "@/hooks/use-toast";
import { IncludeArchivedToggle, isArchivedLike } from "@/components/admin/primitives";

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

type PrimaryStatus = "ok" | "action_required" | "review";

const primaryStatusOf = (r: Row): { status: PrimaryStatus; label: string; hint: string } => {
  if (r.admin_task_created) return { status: "review", label: "Manual review", hint: "Admin task filed for follow-up." };
  const c = r.classifications;
  if (c.length === 0 || (c.length === 1 && c[0] === "ok")) {
    return { status: "ok", label: "OK", hint: "Welcome, first invoice, pay link and next billing date all in place." };
  }
  if (c.includes("recurring_not_ready") || c.includes("missing_next_billing_date") || c.includes("dd_mandate_not_active")) {
    return { status: "action_required", label: "Action required", hint: "Recurring billing not fully ready yet." };
  }
  return { status: "action_required", label: "Action required", hint: c.join(", ") };
};

const primaryBadgeCls = (s: PrimaryStatus) =>
  s === "ok"
    ? "bg-success/15 border-success text-success-foreground"
    : s === "review"
      ? "bg-destructive/15 border-destructive"
      : "bg-warning/15 border-warning";

export function AdminBillingChainCheck() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<"report" | "fix" | null>(null);
  const [filter, setFilter] = useState<"attention" | "all" | "ok">("attention");
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

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

  useEffect(() => { run("report");   }, []);

  const filteredRows = rows.filter(r => {
    if (!includeArchived && isArchivedLike(r.service_status)) return false;
    const s = primaryStatusOf(r).status;
    if (filter === "all") return true;
    if (filter === "ok") return s === "ok";
    return s !== "ok"; // attention (default)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Live Billing Chain Check</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Confirms every live customer has been welcomed, first-billed, and is set up for recurring billing.
            Runs daily. Safe fixes only — no invoices, emails or payment links are created from this page.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => run("report")} disabled={loading}>
            {loading && mode === "report" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Re-run
          </Button>
          <Button size="sm" variant="hero" onClick={() => run("fix")} disabled={loading}>
            {loading && mode === "fix" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Apply safe fixes
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-2 border-foreground p-3">
            <Stat label="Live services" value={summary.total} />
          </Card>
          <Card className="border-2 border-success p-3 bg-success/5">
            <Stat label="OK" value={summary.ok} tone="success" />
          </Card>
          <Card className="border-2 border-warning p-3 bg-warning/5">
            <Stat label="Need attention" value={summary.manual_review + summary.recurring_not_ready} tone="warning" />
          </Card>
          <Card className="border-2 border-foreground p-3">
            <Stat label="Auto-fixed this run" value={summary.auto_fixed} />
          </Card>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase">Show</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-56 h-9 border-2 border-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="attention">Need attention</SelectItem>
            <SelectItem value="ok">OK only</SelectItem>
            <SelectItem value="all">All services</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filteredRows.length} of {rows.length}</span>
      </div>
      <div className="flex items-center gap-3">
        <IncludeArchivedToggle
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
          id="chain-include-archived"
          label="Include archived/test/cancelled services"
        />
      </div>

      <Card className="border-2 border-foreground overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground">
            <tr className="text-left text-xs uppercase tracking-wide">
              <th className="p-2">Customer</th>
              <th className="p-2">Activated</th>
              <th className="p-2">Method</th>
              <th className="p-2">Next bill</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(r => {
              const p = primaryStatusOf(r);
              return (
                <tr key={r.service_id} className="border-b border-foreground/10 hover:bg-muted/30">
                  <td className="p-2">
                    <div className="font-medium">{r.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.account_number ?? "—"} · {r.order_number ?? "—"}</div>
                  </td>
                  <td className="p-2 text-xs">{r.actual_activation_date ?? "—"}</td>
                  <td className="p-2 text-xs capitalize">{r.payment_method ?? "—"}</td>
                  <td className="p-2 text-xs">{r.next_billing_date ?? <span className="text-warning">not set</span>}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={`border-2 ${primaryBadgeCls(p.status)} text-xs`}>
                      {p.status === "ok" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : p.status === "review" ? <AlertTriangle className="w-3 h-3 mr-1" /> : <Info className="w-3 h-3 mr-1" />}
                      {p.label}
                    </Badge>
                    {r.applied.length > 0 && <div className="text-xs text-success mt-1">✓ {r.applied.join(", ")}</div>}
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDetailRow(r)}>View</Button>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && !loading && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                {filter === "attention" ? "Nothing needs attention — all live services are OK." : "No services in scope."}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Sheet open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailRow && (
            <>
              <SheetHeader>
                <SheetTitle>{detailRow.customer_name ?? "Service"}</SheetTitle>
                <SheetDescription>
                  {detailRow.account_number} · {detailRow.email}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Order" value={detailRow.order_number} />
                <DetailRow label="Service status" value={detailRow.service_status} />
                <DetailRow label="Activated" value={detailRow.actual_activation_date} />
                <DetailRow label="Payment method" value={detailRow.payment_method} />
                <DetailRow label="Next billing date" value={detailRow.next_billing_date} />
                <DetailRow label="Welcome email" value={detailRow.welcome_email_status} />
                <DetailRow label="First invoice" value={detailRow.first_invoice_status} />
                <DetailRow label="Payment request" value={detailRow.payment_request_status} />
                <DetailRow label="DD mandate" value={detailRow.dd_mandate_status} />
                <DetailRow label="First billing job" value={detailRow.first_billing_job_status} />
                {detailRow.first_billing_job_blocker && (
                  <DetailRow label="Blocker" value={detailRow.first_billing_job_blocker} />
                )}
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Classifications</div>
                  <div className="flex flex-wrap gap-1">
                    {detailRow.classifications.length === 0
                      ? <span className="text-muted-foreground text-xs">—</span>
                      : detailRow.classifications.map(c => (
                          <Badge key={c} variant="outline" className={`border-2 ${badgeFor(c)} text-xs`}>{c}</Badge>
                        ))}
                  </div>
                </div>
                {detailRow.applied.length > 0 && (
                  <div className="text-success text-xs">✓ Applied: {detailRow.applied.join(", ")}</div>
                )}
                {detailRow.admin_task_created && (
                  <div className="flex items-center gap-1 text-destructive text-xs">
                    <AlertTriangle className="w-3 h-3" /> Admin task filed for manual review
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-foreground/10 pb-1">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value ?? "—"}</span>
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