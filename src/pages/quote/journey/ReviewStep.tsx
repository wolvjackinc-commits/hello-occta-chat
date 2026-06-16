import { useMemo, useState } from "react";
import { Loader2, Check, ShieldCheck, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function genUuid(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof (c as any).randomUUID === "function") return (c as any).randomUUID();
  const b = (c ?? window.crypto).getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function formatGB(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
}

const FINAL_CONSENT =
  "I confirm everything above is correct, I authorise OCCTA LIMITED to proceed with my order on this basis, and I understand that no payment will be taken until my service is confirmed active.";

export default function ReviewStep({
  token,
  quote,
  journey,
  paymentMethod,
  onSubmitted,
}: {
  token: string;
  quote: any;
  journey: any;
  paymentMethod: any | null;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idem] = useState(() => genUuid());

  const monthlyGross = useMemo(
    () => (quote?.monthly_gross != null ? `£${Number(quote.monthly_gross).toFixed(2)}` : "—"),
    [quote?.monthly_gross],
  );

  const submit = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-submit-order", {
        body: { token, idempotency_key: idem, final_consent: true },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't submit your order",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Order submitted",
          description: `Confirmation ${(data as any)?.order?.order_number ?? "received"}. Check your email.`,
        });
        onSubmitted();
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const addressLine = [quote?.service_postcode].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="border-4 border-foreground p-5 space-y-2">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5" />
          <p className="font-display uppercase text-sm">Review your order</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Please double-check everything below. Nothing is charged at this step — submitting confirms your intent to proceed and starts your 14-day cooling-off period (already begun on acceptance).
        </p>
      </div>

      <Section title="Plan">
        <Row label="Quote" value={quote?.quote_number} />
        <Row label="Plan" value={quote?.plan_name} />
        <Row label="Monthly price" value={monthlyGross} strong />
        <Row label="Service postcode" value={addressLine || quote?.service_postcode} />
        <Row label="Customer" value={quote?.customer_name} />
      </Section>

      <Section title="Agreement">
        <Row label="Contract accepted" value={formatGB(journey?.contract_accepted_at)} />
        <Row label="Cooling-off ends" value={formatGB(journey?.cooling_off_ends_at)} />
      </Section>

      <Section title="Start date">
        <Row label="Preferred service start" value={formatGB(journey?.preferred_start_date)} strong />
      </Section>

      <Section title="Payment">
        {paymentMethod?.method === "direct_debit" ? (
          <>
            <Row label="Method" value="Monthly Direct Debit (setup request)" strong />
            <Row label="Account holder" value={paymentMethod.account_holder_name} />
            <Row label="Bank" value={paymentMethod.bank_name} />
            <Row label="Sort / Account" value={`**-**-${paymentMethod.masked_sort_last2} · ****${paymentMethod.masked_account_last4}`} />
            <Row label="Preferred collection day" value={`Day ${paymentMethod.billing_anchor_day}`} />
          </>
        ) : paymentMethod?.method === "invoice_link" ? (
          <>
            <Row label="Method" value="Monthly invoice paid online via Worldpay" strong />
            <Row label="Preferred invoice day" value={`Day ${paymentMethod.billing_anchor_day}`} />
          </>
        ) : (
          <p className="text-xs text-destructive">No active payment method — go back to the Payment step.</p>
        )}
      </Section>

      <label className="flex items-start gap-2 text-sm border-l-4 border-foreground pl-3 py-2">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
        <span>{FINAL_CONSENT}</span>
      </label>

      <Button
        variant="hero"
        className="w-full font-display uppercase"
        disabled={!agreed || submitting || !paymentMethod}
        onClick={submit}
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : <><ShieldCheck className="w-4 h-4 mr-2" /> Submit my order</>}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center">
        OCCTA LIMITED · Registered in England &amp; Wales · No payment is taken at submission.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-4 border-foreground p-5 space-y-2">
      <p className="font-display uppercase text-xs tracking-[0.15em]">{title}</p>
      <dl className="text-sm space-y-1">{children}</dl>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-foreground/10 pb-1 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold text-right" : "text-right"}>{value ?? "—"}</dd>
    </div>
  );
}

export function CompletedStep({ orderNumber }: { orderNumber?: string | null }) {
  return (
    <div className="space-y-6">
      <div className="border-4 border-primary bg-primary/5 p-6 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 border-4 border-foreground bg-yellow-400">
          <Check className="w-7 h-7" />
        </div>
        <p className="font-display uppercase text-xl">Order submitted</p>
        {orderNumber ? (
          <p className="text-sm">Your confirmation reference: <strong>{orderNumber}</strong></p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          We've emailed you a summary. No payment was taken — billing begins only once your service is confirmed active. Your 14-day cooling-off period is in force.
        </p>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        Questions? <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>
      </div>
    </div>
  );
}