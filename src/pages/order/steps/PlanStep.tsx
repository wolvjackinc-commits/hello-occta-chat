import { useState } from "react";
import { Gift, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, PLAN_TERM_LABEL, SPEED_ESTIMATES, type Catalogue, type Journey2Session, type PlanTerm, type SpeedBucket } from "@/lib/journey2/client";

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
  const saving24 = flex && lock ? Math.round((flex - lock) * 24 * 100) / 100 : null;
  const est = plan
    ? {
        download: plan.estimated_download_mbps ?? SPEED_ESTIMATES[plan.speed_bucket]?.download ?? 0,
        upload: plan.estimated_upload_mbps ?? SPEED_ESTIMATES[plan.speed_bucket]?.upload ?? 0,
      }
    : null;
  const switch50 = session.campaign_code === "SWITCH50";

  return (
    <div className="border-4 border-foreground p-6 space-y-5">
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
          const cheapest = Math.min(...Object.values(p.terms).map((t) => t!.monthly_incl_vat));
          const down = p.estimated_download_mbps ?? SPEED_ESTIMATES[p.speed_bucket]?.download ?? 0;
          const up = p.estimated_upload_mbps ?? SPEED_ESTIMATES[p.speed_bucket]?.upload ?? 0;
          const rewardPlan = switch50 && p.speed_bucket === "essential";
          return (
            <label key={p.speed_bucket}
              className={`relative flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : rewardPlan ? "border-primary" : "border-border"}`}>
              {rewardPlan && <span className="absolute right-2 top-2 bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-primary-foreground">£50 Switch Cash eligible</span>}
              <span className="flex items-center gap-3 pr-24 sm:pr-32">
                <input type="radio" name="j2-speed" checked={selected}
                  onChange={() => setBucket(p.speed_bucket)} className="h-4 w-4" />
                <span>
                  <span className="block font-display uppercase">{p.label}</span>
                  <span className="block text-xs font-medium">
                    Estimated download up to {down} Mbps · estimated upload up to {up} Mbps
                  </span>
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
                className={`relative flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : rewardTerm ? "border-primary" : "border-border"}`}>
                {rewardTerm && <span className="absolute right-2 top-2 bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-primary-foreground">SWITCH50</span>}
                <span className="flex items-center gap-3 pr-20">
                  <input type="radio" name="j2-term" checked={selected} onChange={() => setTerm(t)} className="h-4 w-4" />
                  <span>
                    <span className="block font-display uppercase">{PLAN_TERM_LABEL[t]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t === "flex_30"
                        ? "No minimum term — 30 days' notice to leave."
                        : "Your price is fixed for 24 months. Early exit fees may apply if you leave during the minimum term."}
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
