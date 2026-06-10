import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityProvider, useAvailability } from "@/contexts/AvailabilityContext";
import {
  SpeedBucket, PlanTerm, RouterChoice, RouterPaymentType, SetupChoice,
  SPEED_BUCKET_META, PRICE_LOCK_WORDING, FLEX_30_WORDING, FROM_PRICE_DISCLOSURE,
  FIRST_BILL_PROMISE, FAIR_PRICING_DEFAULTS,
} from "@/lib/pricing/fairPricing";

type Resolved = {
  ok: true;
  quote_only: boolean;
  bumped?: boolean;
  message?: string;
  monthly_broadband_incl_vat?: number;
  monthly_total_incl_vat?: number;
  monthly_total_ex_vat?: number;
  vat_amount?: number;
  router?: { label: string; monthly: number; oneOff: number; payment_type: string; option: string };
  setup?: { label: string; oneOff: number; option: string };
  addons?: { id: string; label: string; monthly: number }[];
  one_off_incl_vat?: number;
  first_bill_incl_vat?: number;
  eligibility_wording?: string;
  first_bill_promise?: string;
};

const ADDON_DEFS = [
  { id: "priority_support" as const, label: "Priority support / enhanced care", monthly: FAIR_PRICING_DEFAULTS.addons.priorityMonthly },
  { id: "static_ip" as const, label: "Static IP (selected services)", monthly: FAIR_PRICING_DEFAULTS.addons.staticIpMonthly },
  { id: "digital_voice" as const, label: "Digital Voice add-on", monthly: FAIR_PRICING_DEFAULTS.addons.digitalVoiceMonthly },
  { id: "paper_billing" as const, label: "Paper billing", monthly: FAIR_PRICING_DEFAULTS.addons.paperBillingMonthly },
];

function BuildPlanInner() {
  const nav = useNavigate();
  const { status, result, selectedAddress } = useAvailability();
  const [step, setStep] = useState(1);
  const [bucket, setBucket] = useState<SpeedBucket | null>(null);
  const [term, setTerm] = useState<PlanTerm | null>(null);
  const [router, setRouter] = useState<RouterChoice>("own");
  const [routerPay, setRouterPay] = useState<RouterPaymentType>("none");
  const [setup, setSetup] = useState<SetupChoice>("remote");
  const [addons, setAddons] = useState<string[]>([]);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolving, setResolving] = useState(false);

  const eligibleBuckets = useMemo<SpeedBucket[]>(() => {
    const plans = result?.eligibleOcctaPlans ?? [];
    const all: SpeedBucket[] = ["essential", "superfast", "ultrafast"];
    if (!plans.length) return all;
    return all.filter((b) => plans.includes(b));
  }, [result]);

  // Resolve price server-side whenever choices change
  useEffect(() => {
    if (!bucket || !term) { setResolved(null); return; }
    let cancelled = false;
    setResolving(true);
    supabase.functions.invoke("resolve-build-plan-price", {
      body: {
        speed_bucket: bucket,
        plan_term: term,
        router_option: router,
        router_payment_type: routerPay,
        setup_option: setup,
        addons,
        customer_type: "residential",
        max_download: result?.maxDownload,
        primary_technology: result?.primaryTechnology,
      },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setResolved({ ok: true, quote_only: true, message: "Couldn't resolve price right now." }); }
      else { setResolved(data as Resolved); }
    }).finally(() => !cancelled && setResolving(false));
    return () => { cancelled = true; };
  }, [bucket, term, router, routerPay, setup, addons, result]);

  const canNext = () => {
    if (step === 1) return !!bucket;
    if (step === 2) return !!term;
    if (step === 3) return !!router && (router === "own" || router === "business" || routerPay !== "none");
    if (step === 4) return !!setup;
    return true;
  };

  const goToQuote = () => {
    sessionStorage.setItem("occta_build_plan", JSON.stringify({
      bucket, term, router, routerPay, setup, addons, resolved,
      address: selectedAddress,
    }));
    nav("/quote/start");
  };

  if (status !== "success" || !result) {
    return (
      <Layout>
        <SEO title="Build Your Plan" canonical="/build-plan" />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl uppercase mb-4">Check your address first</h1>
          <p className="text-muted-foreground mb-6">We need to confirm what's available before you build your plan.</p>
          <Button onClick={() => nav("/")}>Back to address check</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Build Your Plan — OCCTA Fair Broadband" canonical="/build-plan" />
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-6">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step} of 5</p>
          <h1 className="font-display text-3xl md:text-4xl uppercase mt-1">Build your plan</h1>
          <p className="text-sm text-muted-foreground mt-2">{FROM_PRICE_DISCLOSURE}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div className="border-4 border-foreground bg-background p-6 md:p-8">
            {step === 1 && (
              <Step title="Choose your speed">
                <div className="grid gap-3">
                  {(["essential","superfast","ultrafast"] as SpeedBucket[]).map((b) => {
                    const meta = SPEED_BUCKET_META[b];
                    const isEligible = eligibleBuckets.includes(b);
                    const selected = bucket === b;
                    return (
                      <button key={b} onClick={() => isEligible && setBucket(b)} disabled={!isEligible}
                        className={`text-left p-5 border-4 transition-colors ${selected ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"} ${!isEligible ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display uppercase text-lg">{meta.title}</p>
                            <p className="text-sm text-muted-foreground">{meta.speedRange}</p>
                            <p className="text-sm mt-1">{meta.tagline}</p>
                          </div>
                          {selected && <Check className="w-5 h-5" />}
                        </div>
                        {!isEligible && <p className="text-xs text-muted-foreground mt-2">Not available at this address.</p>}
                      </button>
                    );
                  })}
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title="Choose plan type">
                <div className="grid gap-3">
                  <OptionCard selected={term === "price_lock_24"} onClick={() => setTerm("price_lock_24")}
                    title="Price Lock 24" subtitle="Fixed monthly broadband price for 24 months." body={PRICE_LOCK_WORDING} />
                  <OptionCard selected={term === "flex_30"} onClick={() => setTerm("flex_30")}
                    title="Flex 30" subtitle="30-day rolling where available." body={FLEX_30_WORDING} />
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step title="Choose your router">
                <div className="grid gap-3">
                  <OptionCard selected={router === "own"} onClick={() => { setRouter("own"); setRouterPay("none"); }}
                    title="Use my own compatible router" subtitle="£0" body="Save by bringing your own. We'll send a compatibility checklist." />
                  <RouterOptionGroup
                    label="Standard WiFi 6 router" selected={router === "standard"} onSelect={() => setRouter("standard")}
                    oneOffLabel="£79.99 one-off" monthlyLabel="£4.99/month"
                    paymentType={routerPay} onPaymentChange={setRouterPay}
                  />
                  <RouterOptionGroup
                    label="Premium WiFi / mesh" selected={router === "premium"} onSelect={() => setRouter("premium")}
                    oneOffLabel="From £129.99 one-off" monthlyLabel="£7.99/month"
                    paymentType={routerPay} onPaymentChange={setRouterPay}
                  />
                  <OptionCard selected={router === "business"} onClick={() => { setRouter("business"); setRouterPay("none"); }}
                    title="Business router" subtitle="Quoted before order" body="We'll quote a business-grade router for your needs." />
                </div>
              </Step>
            )}

            {step === 4 && (
              <Step title="Choose setup">
                <div className="grid gap-3">
                  <OptionCard selected={setup === "remote"} onClick={() => setSetup("remote")}
                    title="Remote / no-site activation" subtitle="£0 where available" body="No engineer needed for most existing fibre lines." />
                  <OptionCard selected={setup === "standard"} onClick={() => setSetup("standard")}
                    title="Standard setup" subtitle="From £49.99" body="For lines needing a non-engineer activation step." />
                  <OptionCard selected={setup === "engineer"} onClick={() => setSetup("engineer")}
                    title="Engineer / new install" subtitle="From £99.99" body="For new lines that need an engineer visit." />
                  <OptionCard selected={setup === "complex"} onClick={() => setSetup("complex")}
                    title="Complex install / survey / ECC" subtitle="Quoted before order" body="If the site needs a survey or excess construction charge." />
                </div>
              </Step>
            )}

            {step === 5 && (
              <Step title="Optional add-ons">
                <div className="grid gap-3">
                  {ADDON_DEFS.map((a) => {
                    const on = addons.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => setAddons((xs) => on ? xs.filter(x => x !== a.id) : [...xs, a.id])}
                        className={`text-left p-5 border-4 transition-colors flex items-center justify-between gap-3 ${on ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"}`}>
                        <div>
                          <p className="font-display uppercase">{a.label}</p>
                          <p className="text-sm text-muted-foreground">From £{a.monthly.toFixed(2)}/month</p>
                        </div>
                        {on && <Check className="w-5 h-5" />}
                      </button>
                    );
                  })}
                </div>
              </Step>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t-2 border-foreground/10">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              {step < 5 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={goToQuote} disabled={!resolved || resolved.quote_only === true && !addons.length /* allow quote-only path */}>
                  Continue to quote <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          <FirstBillPreview resolved={resolved} resolving={resolving} />
        </div>
      </div>
    </Layout>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl uppercase mb-5">{title}</h2>
      {children}
    </div>
  );
}

function OptionCard({ selected, onClick, title, subtitle, body }: { selected: boolean; onClick: () => void; title: string; subtitle?: string; body?: string }) {
  return (
    <button onClick={onClick}
      className={`text-left p-5 border-4 transition-colors ${selected ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display uppercase text-lg">{title}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {body && <p className="text-sm mt-2 leading-relaxed">{body}</p>}
        </div>
        {selected && <Check className="w-5 h-5 flex-shrink-0" />}
      </div>
    </button>
  );
}

function RouterOptionGroup({ label, selected, onSelect, oneOffLabel, monthlyLabel, paymentType, onPaymentChange }:
  { label: string; selected: boolean; onSelect: () => void; oneOffLabel: string; monthlyLabel: string; paymentType: RouterPaymentType; onPaymentChange: (p: RouterPaymentType) => void }) {
  return (
    <div className={`border-4 ${selected ? "border-foreground bg-primary/10" : "border-foreground/20"}`}>
      <button onClick={onSelect} className="w-full text-left p-5">
        <div className="flex items-center justify-between">
          <p className="font-display uppercase text-lg">{label}</p>
          {selected && <Check className="w-5 h-5" />}
        </div>
      </button>
      {selected && (
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button onClick={() => onPaymentChange("one_off")}
            className={`p-3 border-2 text-sm ${paymentType === "one_off" ? "border-foreground bg-background" : "border-foreground/30"}`}>
            {oneOffLabel}
          </button>
          <button onClick={() => onPaymentChange("monthly")}
            className={`p-3 border-2 text-sm ${paymentType === "monthly" ? "border-foreground bg-background" : "border-foreground/30"}`}>
            {monthlyLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function FirstBillPreview({ resolved, resolving }: { resolved: Resolved | null; resolving: boolean }) {
  return (
    <aside className="border-4 border-foreground bg-background p-6 self-start lg:sticky lg:top-24">
      <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">First bill preview</p>
      <h3 className="font-display text-xl uppercase mb-4">Your first bill</h3>

      {resolving && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</div>}

      {!resolving && !resolved && (
        <p className="text-sm text-muted-foreground">Pick a speed and plan type to see your bill preview.</p>
      )}

      {!resolving && resolved?.quote_only && (
        <div className="text-sm space-y-2">
          <p className="flex items-start gap-2"><Info className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{resolved.message ?? "Available by quote."}</span></p>
        </div>
      )}

      {!resolving && resolved && !resolved.quote_only && (
        <div className="text-sm space-y-3">
          <Line label="Broadband (monthly, incl. VAT)" value={`£${(resolved.monthly_broadband_incl_vat ?? 0).toFixed(2)}`} />
          {resolved.router && resolved.router.monthly > 0 && <Line label={`${resolved.router.label} (monthly)`} value={`£${resolved.router.monthly.toFixed(2)}`} />}
          {resolved.addons?.map((a) => <Line key={a.id} label={`${a.label} (monthly)`} value={`£${a.monthly.toFixed(2)}`} />)}
          <div className="border-t-2 border-foreground/10 pt-2 mt-2">
            <Line label="Monthly total (incl. VAT)" value={`£${(resolved.monthly_total_incl_vat ?? 0).toFixed(2)}`} bold />
            <p className="text-xs text-muted-foreground mt-1">VAT included: £{(resolved.vat_amount ?? 0).toFixed(2)}</p>
          </div>
          {(resolved.one_off_incl_vat ?? 0) > 0 && (
            <div className="border-t-2 border-foreground/10 pt-2">
              {resolved.router && resolved.router.oneOff > 0 && <Line label={`${resolved.router.label} (one-off)`} value={`£${resolved.router.oneOff.toFixed(2)}`} />}
              {resolved.setup && resolved.setup.oneOff > 0 && <Line label={`${resolved.setup.label} (one-off)`} value={`£${resolved.setup.oneOff.toFixed(2)}`} />}
              <Line label="One-off total" value={`£${(resolved.one_off_incl_vat ?? 0).toFixed(2)}`} />
            </div>
          )}
          <div className="border-t-4 border-foreground pt-3 mt-3">
            <Line label="Estimated first bill" value={`£${(resolved.first_bill_incl_vat ?? 0).toFixed(2)}`} bold />
          </div>
          {resolved.eligibility_wording && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-3 pt-3 border-t-2 border-foreground/10">{resolved.eligibility_wording}</p>
          )}
          {resolved.bumped && (
            <p className="text-xs text-muted-foreground italic">Price adjusted to the nearest safe amount for this combination.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-5 pt-4 border-t-2 border-foreground/10">{FIRST_BILL_PROMISE}</p>
    </aside>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-display uppercase" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "" : "font-medium"}>{value}</span>
    </div>
  );
}

export default function BuildPlan() {
  return (
    <AvailabilityProvider>
      <BuildPlanInner />
    </AvailabilityProvider>
  );
}