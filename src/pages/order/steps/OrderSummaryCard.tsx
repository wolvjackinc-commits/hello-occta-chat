import { Gift, Info } from "lucide-react";
import { money, PLAN_TERM_LABEL, SPEED_ESTIMATES, type Journey2Session } from "@/lib/journey2/client";

/**
 * Live order summary. Every charge comes from the server-resolved price
 * snapshot. Promotional cash is shown separately and never netted off price.
 */
export default function OrderSummaryCard({ session }: { session: Journey2Session }) {
  const p = session.price_snapshot;
  const campaign = session.campaign_snapshot;
  if (!p) {
    return (
      <aside className="border-4 border-foreground p-5">
        <h2 className="font-display uppercase text-sm tracking-widest mb-2">Your order</h2>
        <p className="text-sm text-muted-foreground">Choose a plan and your exact price appears here — no estimates.</p>
        {session.campaign_code === "SWITCH50" && (
          <div className="mt-4 border-2 border-primary bg-primary/10 p-3 text-xs">
            <p className="font-display uppercase">SWITCH50 detected</p>
            <p className="mt-1 text-muted-foreground">Choose eligible Essential Fibre with Price Lock 24 to receive the £50 Switch Cash offer.</p>
          </div>
        )}
      </aside>
    );
  }
  const addons = p.addons ?? [];
  const oneOff = (p.setup?.oneOff ?? 0) + (p.router?.oneOff ?? 0);
  const est = SPEED_ESTIMATES[p.speed_bucket];
  return (
    <aside className="border-4 border-foreground p-5">
      <h2 className="font-display uppercase text-sm tracking-widest mb-3">Your order</h2>

      {campaign?.code === "SWITCH50" && campaign.eligible && (
        <div className="mb-4 border-4 border-primary bg-primary/10 p-4">
          <div className="flex items-center gap-2 font-display uppercase">
            <Gift className="h-4 w-4" aria-hidden="true" />
            SWITCH50 applied — {money(campaign.reward_amount)} Switch Cash
          </div>
          <p className="mt-1 text-xs">
            Your broadband remains <strong>{money(p.monthly_total_incl_vat)}/month including VAT</strong>. The cash reward is separate from your monthly price.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{campaign.payout_rule}</p>
        </div>
      )}

      {session.campaign_code === "SWITCH50" && campaign && !campaign.eligible && (
        <div className="mb-4 border-2 border-foreground/30 bg-muted/40 p-3 text-xs">
          <div className="flex items-center gap-2 font-display uppercase"><Info className="h-4 w-4" /> SWITCH50 not applied to this selection</div>
          <p className="mt-1 text-muted-foreground">The £50 reward is for eligible new residential Essential Fibre Price Lock 24 orders. You can go back and choose that combination where available.</p>
        </div>
      )}

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="text-right font-medium">{p.plan_label ?? p.speed_bucket}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Term</dt>
          <dd className="text-right font-medium">{PLAN_TERM_LABEL[p.plan_term]}</dd>
        </div>
        {est && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Estimated speed</dt>
            <dd className="text-right font-medium">{est.download} Mbps down / {est.upload} Mbps up</dd>
          </div>
        )}
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
        <p className="text-[11px] text-muted-foreground">Includes VAT. Cashback, where eligible, is not deducted from this price.</p>
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
        Nothing is charged now. You'll review your Contract Summary, Contract Information and payment details before your order is placed.
      </p>
    </aside>
  );
}
