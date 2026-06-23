import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Receipt, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addMonths } from "date-fns";

interface Props { userId: string; }

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy");
}

export function BillingSchedulePanel({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState<string | null>(null);
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [billing, setBilling] = useState<{ billing_mode: string; billing_day: number | null; payment_terms_days: number; next_invoice_date: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: bs }, { data: orders }] = await Promise.all([
          supabase.from("billing_settings").select("billing_mode, billing_day, payment_terms_days, next_invoice_date").eq("user_id", userId).maybeSingle(),
          supabase.from("orders").select("plan_price, payment_method, created_at, status, plan_name").eq("user_id", userId).order("created_at", { ascending: false }),
        ]);
        if (bs) setBilling(bs as any);
        const liveOrder = (orders ?? []).find((o: any) => o.status === "active" || o.status === "live") || (orders ?? [])[0];
        if (liveOrder) {
          setPlanPrice(Number(liveOrder.plan_price ?? 0) || null);
          setPaymentMethod(liveOrder.payment_method ?? null);
        }
        // Try to read activation from a customer_service row or first active service
        const { data: svc } = await supabase.from("services").select("created_at, updated_at, status").eq("user_id", userId).order("created_at", { ascending: false });
        const live = (svc ?? []).find((s: any) => s.status === "active");
        const act = (live as any)?.updated_at || (live as any)?.created_at || (svc ?? [])[0]?.created_at || liveOrder?.created_at || null;
        setActivation(act);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return <Card className="border-2 border-foreground p-4 text-sm text-muted-foreground">Loading billing schedule…</Card>;
  }

  const activationDate = activation ? new Date(activation) : null;
  const mode = billing?.billing_mode ?? "anniversary";
  const termsDays = billing?.payment_terms_days ?? 7;
  let firstInvoice: Date | null = billing?.next_invoice_date ? new Date(billing.next_invoice_date) : null;
  if (!firstInvoice && activationDate) {
    if (mode === "fixed_day" && billing?.billing_day) {
      const d = Math.min(billing.billing_day, 28);
      firstInvoice = new Date(activationDate.getFullYear(), activationDate.getMonth(), d);
      if (firstInvoice <= activationDate) firstInvoice = addMonths(firstInvoice, 1);
    } else {
      firstInvoice = addMonths(activationDate, 1);
    }
  }
  const firstDue = firstInvoice ? addDays(firstInvoice, termsDays) : null;
  const recurring = mode === "fixed_day" && billing?.billing_day
    ? `the ${billing.billing_day}${billing.billing_day === 1 ? "st" : billing.billing_day === 2 ? "nd" : billing.billing_day === 3 ? "rd" : "th"} of every month`
    : "every month on the activation anniversary";

  return (
    <Card className="border-2 border-foreground p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5" /> BILLING SCHEDULE
        </h3>
        <Badge variant="outline" className="border-2 border-foreground capitalize">{mode.replace("_", " ")}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Service activated</div>
          <div className="font-medium">{fmt(activationDate)}</div>
        </div>
        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> First invoice raised</div>
          <div className="font-medium">{fmt(firstInvoice)}</div>
        </div>
        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> First payment due</div>
          <div className="font-medium">{fmt(firstDue)}</div>
          <div className="text-[10px] text-muted-foreground">{termsDays}-day payment terms</div>
        </div>
        <div className="border-2 border-foreground/30 p-3">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payment method</div>
          <div className="font-medium capitalize">{paymentMethod?.replace("_", " ") ?? "—"}</div>
          {planPrice && <div className="text-[10px] text-muted-foreground">£{planPrice.toFixed(2)} per cycle</div>}
        </div>
      </div>

      <div className="border-l-4 border-foreground bg-muted/30 p-3 text-sm">
        <strong>Plain-English:</strong> {activationDate ? <>Service went live on <strong>{fmt(activationDate)}</strong>. The first invoice will be raised on <strong>{fmt(firstInvoice)}</strong> and is due by <strong>{fmt(firstDue)}</strong>{paymentMethod ? <> via {paymentMethod.replace("_", " ")}</> : null}. After that we bill {recurring} for as long as the service is active.</> : <>Activation date not yet set — billing schedule will populate once the service goes live.</>}
      </div>
    </Card>
  );
}