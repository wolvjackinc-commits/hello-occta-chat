import { comparisonTerm, planSavings } from "@/lib/journey2/conversion";
import { useState } from "react";
import { Gift, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, PLAN_TERM_LABEL, SPEED_ESTIMATES, type Catalogue, type Journey2Session, type PlanTerm, type SpeedBucket } from "@/lib/journey2/client";
import { clearPreferredSpeedBucket, getPreferredSpeedBucket } from "@/lib/journey2/prefill";

export default function PlanStep({
  catalogue, session, saving, onSave, onBack,
}: {
  catalogue: Catalogue;
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const preferred = getPreferredSpeedBucket();
  const preferredIsAvailable = preferred && catalogue.plans.some((p) => p.speed_bucket === preferred);
  const initialBucket = session.speed_bucket ?? (preferredIsAvailable ? preferred : catalogue.plans[0]?.speed_bucket) ?? null;
  const [bucket, setBucket] = useState<SpeedBucket | null>(initialBucket);
  const [term, setTerm] = useState<PlanTerm>(session.plan_term ?? "price_lock_24");

  const plan = catalogue.plans.find((p) => p.speed_bucket === bucket) ?? null;
  const availableTerms = plan ? (Object.keys(plan.terms) as PlanTerm[]) : [];
  const activeTerm = availableTerms.includes(term)
    ? term
    : availableTerms.includes("price_lock_24")
      ? "price_lock_24"
      : availableTerms[0];
  const priced = plan && activeTerm ? plan.terms[activeTerm] : null;

  const flex = plan?.terms.flex_30?.monthly_incl_vat;
  const lock = plan?.terms.price_lock_24?.monthly_incl_vat;
  const savings = planSavings(flex, lock);
  const est = plan
    ? {
        download: plan.estimated_download_mbps ?? SPEED_ESTIMATES[plan.speed_bucket]?.download ?? 0,
        upload: plan.estimated_upload_mbps ?? SPEED_ESTIMATES[plan.speed_bucket]?.upload ?? 0,
      }
    : null;
  const switch50 = session.campaign_code === "SWITCH50";

  const savePlan = () => {
    if (!bucket || !activeTerm) return;
    clearPreferredSpeedBucket();
    onSave({ speed_bucket: bucket, plan_term: activeTerm });
  };

  return (
    <div className="space-y-5 border-4 border-foreground p-4 sm:p-6">
      <div>
        <h1 className="font-display uppercase text-2xl">Pick your speed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The prices below are the OCCTA prices for the plan and term shown, including VAT. No teaser rates and no mid-contract price rises on Price Lock.
        </p>
      </div>

      <div className="border-2 border-foreground/30 bg-muted/30 p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>Availability note:</strong> Plans shown are current OCCTA offers and may not all be available at every address.
            Final availability, speed and network technology are subject to network and supplier validation for your installation address.
            If your selected plan cannot be supplied, we’ll email you with the available options before provisioning. We won’t move you to a different plan or price without your agreement. If your selection is confirmed, your order continues as submitted.
          </p>
        </div>
      </div>

      {switch50 && (
        <div className="border-4 border-primary bg-primary/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-display uppercase"><Gift className="h-4 w-4" /> Your SWITCH50 offer</div>
          <p className="mt-1">Choose <strong>Essential Fibre + Price Lock 24</strong> where available to receive <strong>£50 Switch Cash</strong>. The reward is separate from the monthly broadband price.</p>
        </div>
      )}

      <fieldset className="space-y-3">
        <legend className="font-display uppercase text-xs tracking-widest mb-2">Speed</legend>
        {catalogue.plans.map((p) => {
          const selected = p.speed_bucket === bucket;
          const shownTerm = comparisonTerm(p, term);
          const shownPrice = shownTerm ? p.terms[shownTerm]?.monthly_incl_vat : undefined;
          const down = p.estimated_download_mbps ?? SPEED_ESTIMATES[p.speed_bucket]?.download ?? 0;
          const up = p.estimated_upload_mbps ?? SPEED_ESTIMATES[p.speed_bucket]?.upload ?? 0;
          const rewardPlan = switch50 && p.speed_bucket === "essential";
          return (
            <label key={p.speed_bucket}
              className={`relative flex cursor-pointer flex-col items-stretch gap-3 border-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${selected ? "border-foreground bg-muted" : rewardPlan ? "border-primary" : "border-border"}`}>
              {rewardPlan && <span className="self-start bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-primary-foreground sm:absolute sm:right-2 sm:top-2">£50 Switch Cash eligible</span>}
              <span className="flex min-w-0 items-start gap-3 sm:pr-32">
                <input type="radio" name="j2-speed" checked={selected}
                  onChange={() => setBucket(p.speed_bucket)} className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display uppercase">{p.label}</span>
                  <span className="block text-xs font-medium">
                    Estimated download up to {down} Mbps · estimated upload up to {up} Mbps
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {Object.keys(p.terms).length > 1 ? "Flex 30 or Price Lock 24" : PLAN_TERM_LABEL[Object.keys(p.terms)[0] as PlanTerm]}
                  </span>
                </span>
              </span>
              <span className="whitespace-nowrap pl-7 text-left sm:pl-0 sm:text-right">
                <span className="block font-bold">{shownPrice == null ? "Unavailable" : money(shownPrice)}<span className="text-xs font-normal">/mo</span></span>
                <span className="block text-[11px] text-muted-foreground">incl. VAT · {shownTerm === "flex_30" ? "Flex 30" : "Price Lock 24"}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {est && (
        <p className="text-xs border-2 border-foreground p-3">
          Estimated speeds for your selected band: up to {est.download} Mbps download and up to {est.upload} Mbps upload.
          These are estimates, not guarantees. The service and speed information included in your Contract Summary and Contract Information forms part of what you review before accepting the agreement.
        </p>
      )}

      {plan && (
        <fieldset className="space-y-3">
          <legend className="font-display uppercase text-xs tracking-widest mb-2">Contract type</legend>
          {availableTerms.map((t) => {
            const selected = t === activeTerm;
            const info = plan.terms[t]!;
            const rewardTerm = switch50 && bucket === "essential" && t === "price_lock_24";
            return (
              <label key={t}
                className={`relative flex cursor-pointer flex-col items-stretch gap-3 border-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${selected ? "border-foreground bg-muted" : rewardTerm ? "border-primary" : "border-border"}`}>
                {rewardTerm && <span className="self-start bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-primary-foreground sm:absolute sm:right-2 sm:top-2">SWITCH50</span>}
                <span className="flex min-w-0 items-start gap-3 sm:pr-24">
                  <input type="radio" name="j2-term" checked={selected} onChange={() => setTerm(t)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-display uppercase">{PLAN_TERM_LABEL[t]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t === "flex_30"
                        ? "No minimum term — 30 days' notice to leave."
                        : "Your price is fixed for 24 months. Early exit fees may apply if you leave during the minimum term."}
                    </span>
                  </span>
                </span>
                <span className="whitespace-nowrap pl-7 text-left sm:pl-0 sm:text-right">
                  <span className="block font-bold">{money(info.monthly_incl_vat)}<span className="text-xs font-normal">/mo</span></span>
                  <span className="block text-[11px] text-muted-foreground">{money(info.monthly_ex_vat)} + {money(info.vat_amount)} VAT</span>
                </span>
              </label>
            );
          })}
          {savings && (
            <p className="text-xs border-2 border-foreground p-3">
              Price Lock 24 is {money(savings.monthly)} less per month — {money(savings.over24Months)} over 24 months at today’s Flex 30 price, in exchange for a 24-month commitment. This comparison excludes router charges, extras and cashback; Flex 30 prices may change.
            </p>
          )}
        </fieldset>
      )}

      {priced && (
        <div className="border-2 border-foreground p-4 text-sm" aria-live="polite">
          <p className="font-semibold">Selected broadband: {money(priced.monthly_incl_vat)}/month including VAT</p>
          <p className="mt-1">{catalogue.setup ? `${catalogue.setup.label}: ${money(catalogue.setup.one_off)} one-off.` : "Setup charge confirmed in your order summary."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Router not included. Choose your own compatible router or a paid option next. Optional extras are shown separately before you confirm.</p>
        </div>
      )}

      {catalogue.plans.length === 0 && (
        <p className="text-sm border-2 border-foreground p-4">
          We can't show exact prices online right now. Call 0800 260 6626 or email hello@occta.co.uk and we'll price your order with you.
        </p>
      )}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">Back</Button>
        <Button
          type="button"
          disabled={saving || !bucket || !activeTerm || !priced}
          onClick={savePlan}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Choose router for this plan"}
        </Button>
      </div>
    </div>
  );
}