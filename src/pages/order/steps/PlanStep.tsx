import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, PLAN_TERM_LABEL, type Catalogue, type Journey2Session, type PlanTerm, type SpeedBucket } from "@/lib/journey2/client";

export default function PlanStep({
  catalogue, session, saving, onSave, onBack,
}: {
  catalogue: Catalogue;
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const [bucket, setBucket] = useState<SpeedBucket | null>(session.speed_bucket ?? catalogue.plans[0]?.speed_bucket ?? null);
  const [term, setTerm] = useState<PlanTerm>(session.plan_term ?? "flex_30");

  const plan = catalogue.plans.find((p) => p.speed_bucket === bucket) ?? null;
  const availableTerms = plan ? (Object.keys(plan.terms) as PlanTerm[]) : [];
  const activeTerm = availableTerms.includes(term) ? term : availableTerms[0];
  const priced = plan && activeTerm ? plan.terms[activeTerm] : null;

  const flex = plan?.terms.flex_30?.monthly_incl_vat;
  const lock = plan?.terms.price_lock_24?.monthly_incl_vat;
  const saving24 = flex && lock ? Math.round((flex - lock) * 24 * 100) / 100 : null;

  return (
    <div className="border-4 border-foreground p-6 space-y-5">
      <div>
        <h1 className="font-display uppercase text-2xl">Pick your speed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every price below is the exact price you'll pay, including VAT. No teaser rates and no mid-contract price rises.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display uppercase text-xs tracking-widest mb-2">Speed</legend>
        {catalogue.plans.map((p) => {
          const selected = p.speed_bucket === bucket;
          const cheapest = Math.min(...Object.values(p.terms).map((t) => t!.monthly_incl_vat));
          return (
            <label key={p.speed_bucket}
              className={`flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : "border-border"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="j2-speed" checked={selected}
                  onChange={() => setBucket(p.speed_bucket)} className="h-4 w-4" />
                <span>
                  <span className="block font-display uppercase">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {Object.keys(p.terms).length > 1 ? "Flex 30 or Price Lock 24" : PLAN_TERM_LABEL[Object.keys(p.terms)[0] as PlanTerm]}
                  </span>
                </span>
              </span>
              <span className="text-right whitespace-nowrap">
                <span className="block font-bold">{money(cheapest)}<span className="text-xs font-normal">/mo</span></span>
                <span className="block text-[11px] text-muted-foreground">incl. VAT</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {plan && (
        <fieldset className="space-y-3">
          <legend className="font-display uppercase text-xs tracking-widest mb-2">Contract type</legend>
          {availableTerms.map((t) => {
            const selected = t === activeTerm;
            const info = plan.terms[t]!;
            return (
              <label key={t}
                className={`flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : "border-border"}`}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="j2-term" checked={selected} onChange={() => setTerm(t)} className="h-4 w-4" />
                  <span>
                    <span className="block font-display uppercase">{PLAN_TERM_LABEL[t]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t === "flex_30"
                        ? "No minimum term — 30 days' notice to leave."
                        : "Your price is fixed for 24 months. Early exit fees apply if you leave early."}
                    </span>
                  </span>
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="block font-bold">{money(info.monthly_incl_vat)}<span className="text-xs font-normal">/mo</span></span>
                  <span className="block text-[11px] text-muted-foreground">{money(info.monthly_ex_vat)} + {money(info.vat_amount)} VAT</span>
                </span>
              </label>
            );
          })}
          {saving24 !== null && saving24 > 0 && (
            <p className="text-xs border-2 border-foreground p-3">
              Price Lock 24 saves you {money(saving24)} over 24 months compared with Flex 30, in exchange for a 24-month commitment.
            </p>
          )}
        </fieldset>
      )}

      {catalogue.plans.length === 0 && (
        <p className="text-sm border-2 border-foreground p-4">
          We can't show exact prices online right now. Call 0800 260 6626 or email hello@occta.co.uk and we'll price your order with you.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button
          type="button"
          disabled={saving || !bucket || !activeTerm || !priced}
          onClick={() => bucket && activeTerm && onSave({ speed_bucket: bucket, plan_term: activeTerm })}
        >
          {saving ? "Saving…" : "Continue to router"}
        </Button>
      </div>
    </div>
  );
}