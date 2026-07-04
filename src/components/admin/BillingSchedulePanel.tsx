import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Receipt, CreditCard, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

interface Props { userId: string; }

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00Z" : "")) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy");
}

// Advance one month with anchor-day clamp (matches process-recurring-billing).
function nextAnchor(from: Date, anchorDay: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1; // target month index
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay, lastDay);
  return new Date(Date.UTC(year, month, day));
}

function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "invoice_link": return "Invoice link / manual card payment";
    case "direct_debit": return "Direct Debit";
    case "card": return "Card on file";
    default: return method ? method.replace(/_/g, " ") : "—";
  }
}

type SvcRow = {
  id: string; status: string;
  actual_activation_date: string | null;
  next_billing_date: string | null;
  billing_anchor_day: number | null;
  billing_enabled: boolean | null;
  plan_name: string | null;
  price_monthly: number | null;
  order_id: string | null;
};

type InvRow = {
  id: string; invoice_number: string; issue_date: string;
  due_date: string | null; total: number; status: string;
  billing_period_start: string | null; billing_period_end: string | null;
};

export function BillingSchedulePanel({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<SvcRow | null>(null);
  const [firstInvoice, setFirstInvoice] = useState<InvRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [ddStatus, setDdStatus] = useState<string | null>(null);
  const [termsDays, setTermsDays] = useState<number>(7);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: svcRows }, { data: orders }, { data: bs }] = await Promise.all([
          supabase.from("services")
            .select("id, status, actual_activation_date, next_billing_date, billing_anchor_day, billing_enabled, plan_name, price_monthly, order_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("orders")
            .select("id, payment_method, created_at, status")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("billing_settings")
            .select("payment_terms_days")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const live = (svcRows ?? []).find((s: any) => s.status === "active") ?? (svcRows ?? [])[0] ?? null;
        setService(live as SvcRow | null);
        if ((bs as any)?.payment_terms_days) setTermsDays((bs as any).payment_terms_days);

        const linkedOrder = (live as any)?.order_id
          ? (orders ?? []).find((o: any) => o.id === (live as any).order_id)
          : null;
        const activeOrder = linkedOrder
          ?? (orders ?? []).find((o: any) => o.status === "active" || o.status === "live")
          ?? (orders ?? [])[0];
        setPaymentMethod((activeOrder as any)?.payment_method ?? null);

        if ((activeOrder as any)?.payment_method === "direct_debit") {
          const { data: mand } = await supabase
            .from("dd_mandates_list" as any)
            .select("status")
            .eq("user_id", userId)
            .maybeSingle();
          setDdStatus((mand as any)?.status ?? "not_set_up");
        }

        let inv: InvRow | null = null;
        if ((live as any)?.id) {
          const { data } = await supabase.from("invoices")
            .select("id, invoice_number, issue_date, due_date, total, status, billing_period_start, billing_period_end")
            .eq("service_id", (live as any).id)
            .order("issue_date", { ascending: true })
            .limit(1)
            .maybeSingle();
          inv = data as InvRow | null;
        }
        if (!inv) {
          const { data } = await supabase.from("invoices")
            .select("id, invoice_number, issue_date, due_date, total, status, billing_period_start, billing_period_end")
            .eq("user_id", userId)
            .order("issue_date", { ascending: true })
            .limit(1)
            .maybeSingle();
          inv = data as InvRow | null;
        }
        setFirstInvoice(inv);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return <Card className="border-2 border-foreground p-4 text-sm text-muted-foreground">Loading billing schedule…</Card>;
  }

  const activation = service?.actual_activation_date ?? firstInvoice?.billing_period_start ?? null;
  const nextIssue = service?.next_billing_date ? new Date(service.next_billing_date + "T00:00:00Z") : null;
  const anchor = service?.billing_anchor_day ?? null;
  const nextPeriodEnd = nextIssue && anchor ? nextAnchor(nextIssue, anchor) : null;
  const nextDue = nextIssue ? addDays(nextIssue, termsDays) : null;
  const pmLabel = paymentMethodLabel(paymentMethod);
  const isInvoiceLink = paymentMethod === "invoice_link";
  const isDD = paymentMethod === "direct_debit";

  return (
    <Card className="border-2 border-foreground p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5" /> BILLING SCHEDULE
        </h3>
        <Badge variant="outline" className="border-2 border-foreground">Anchor day: {anchor ?? "—"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Service activated</div>
          <div className="font-medium">{fmt(activation)}</div>
          {!service?.actual_activation_date && firstInvoice?.billing_period_start && (
            <div className="text-[10px] text-muted-foreground">Inferred from first invoice period</div>
          )}
        </div>

        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> First invoice</div>
          {firstInvoice ? (
            <>
              <div className="font-medium">{firstInvoice.invoice_number} · £{Number(firstInvoice.total).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground">
                Issued {fmt(firstInvoice.issue_date)} · Due {fmt(firstInvoice.due_date)} · <span className="uppercase">{firstInvoice.status}</span>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Not raised yet</div>
          )}
        </div>

        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Next invoice</div>
          {nextIssue ? (
            <>
              <div className="font-medium">{fmt(nextIssue)}</div>
              <div className="text-[11px] text-muted-foreground">
                Period {fmt(nextIssue)}{nextPeriodEnd ? <> → {fmt(addDays(nextPeriodEnd, -1))}</> : null}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Due by {fmt(nextDue)} ({termsDays}-day terms)</div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Not scheduled</div>
          )}
        </div>

        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payment method</div>
          <div className="font-medium">{pmLabel}</div>
          {isInvoiceLink && (<div className="text-[10px] text-muted-foreground">Not automatically charged — customer pays manually via secure link.</div>)}
          {isDD && (<div className="text-[10px] text-muted-foreground">Mandate status: {ddStatus ?? "unknown"}</div>)}
          {service?.price_monthly && <div className="text-[10px] text-muted-foreground">£{Number(service.price_monthly).toFixed(2)} / month</div>}
        </div>
      </div>

      <div className="border-l-4 border-foreground bg-muted/30 p-3 text-sm">
        <strong>Plain-English:</strong>{" "}
        {activation ? (
          <>
            Service went live on <strong>{fmt(activation)}</strong>.{" "}
            {firstInvoice
              ? <>First invoice <strong>{firstInvoice.invoice_number}</strong> was raised on <strong>{fmt(firstInvoice.issue_date)}</strong> for <strong>£{Number(firstInvoice.total).toFixed(2)}</strong> (due {fmt(firstInvoice.due_date)}, status {firstInvoice.status}). </>
              : <>First invoice has not been raised yet. </>}
            {nextIssue
              ? <>Next invoice is scheduled for <strong>{fmt(nextIssue)}</strong> covering {fmt(nextIssue)}{nextPeriodEnd ? <> → {fmt(addDays(nextPeriodEnd, -1))}</> : null}.</>
              : <>No further billing is currently scheduled.</>}
            {" "}Payment method: <strong>{pmLabel}</strong>{isInvoiceLink ? " (manual — no auto-charge)." : "."}
          </>
        ) : (
          <>Activation date not yet set — billing schedule will populate once the service goes live.</>
        )}
      </div>
    </Card>
  );
}