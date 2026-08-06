import { money, PLAN_TERM_LABEL, type Journey2Session } from "@/lib/journey2/client";

/**
 * Live order summary. Every figure comes from the server-resolved price
 * snapshot, so what the customer reads is exactly what will be charged.
 */
export default function OrderSummaryCard({ session }: { session: Journey2Session }) {
  const p = session.price_snapshot;
  if (!p) {
    return (
      <aside className="border-4 border-foreground p-5">
        <h2 className="font-display uppercase text-sm tracking-widest mb-2">Your order</h2>
        <p className="text-sm text-muted-foreground">Choose a plan and your exact price appears here — no estimates.</p>
      </aside>
    );
  }
  const addons = p.addons ?? [];
  const oneOff = (p.setup?.oneOff ?? 0) + (p.router?.oneOff ?? 0);
  return (
    <aside className="border-4 border-foreground p-5">
      <h2 className="font-display uppercase text-sm tracking-widest mb-3">Your order</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="text-right font-medium">{p.plan_label ?? p.speed_bucket}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Term</dt>
          <dd className="text-right font-medium">{PLAN_TERM_LABEL[p.plan_term]}</dd>
        </div>
        {p.router && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Router</dt>
            <dd className="text-right font-medium">{p.router.label}</dd>
          </div>
        )}
        {addons.map((a) => (
          <div key={a.id} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{a.label}</dt>
            <dd className="text-right font-medium">{money(a.monthly)}/mo</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t-2 border-foreground pt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Monthly excluding VAT</span>
          <span>{money(p.monthly_total_ex_vat)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">VAT</span>
          <span>{money(p.vat_amount)}</span>
        </div>
        <div className="flex justify-between font-display uppercase text-lg pt-1">
          <span>Monthly total</span>
          <span>{money(p.monthly_total_incl_vat)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Includes VAT.</p>
      </div>

      <div className="mt-4 border-t-2 border-foreground pt-3 space-y-1 text-sm">
        {p.setup && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{p.setup.label}</span>
            <span>{money(p.setup.oneOff)}</span>
          </div>
        )}
        {p.router && p.router.oneOff > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{p.router.label} (one-off)</span>
            <span>{money(p.router.oneOff)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>One-off total</span>
          <span>{money(oneOff)}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Nothing is charged now. You'll review your contract and confirm your payment details before your order is placed.
      </p>
    </aside>
  );
}