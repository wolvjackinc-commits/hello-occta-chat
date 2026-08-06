import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityProvider, useAvailability } from "@/contexts/AvailabilityContext";
import {
  SpeedBucket, PlanTerm, RouterChoice, RouterPaymentType, SetupChoice,
  SPEED_BUCKET_META, PRICE_LOCK_WORDING, FLEX_30_WORDING, FROM_PRICE_DISCLOSURE,
  FIRST_BILL_PROMISE, FAIR_PRICING_DEFAULTS,
} from "@/lib/pricing/fairPricing";
import { EmergencyCallNote } from "@/components/legal/EmergencyCallNote";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import { startAssignedJourney } from "@/lib/journey2/route";

const UK_TELECOM_PROVIDERS = [
  "BT", "Sky", "TalkTalk", "Virgin Media", "Vodafone", "Plusnet",
  "EE", "Now Broadband", "Shell Energy Broadband", "Hyperoptic",
  "Community Fibre", "Zen Internet", "John Lewis Broadband",
  "Origin Broadband", "KCOM", "Direct Save Telecom", "Utility Warehouse",
  "Pop Telecom", "Onestream", "Cuckoo", "Other / Don't know",
];

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

const QUOTE_ONLY_ADDONS: { id: string; label: string }[] = [
  { id: "wifi_mesh", label: "WiFi extender / mesh" },
];

const SPEED_LABELS: Record<SpeedBucket, string> = {
  essential: "Essential Fibre",
  superfast: "Superfast Fibre",
  ultrafast: "Ultrafast Fibre",
  gigabit:   "Gigabit Fibre",
};
const TERM_LABELS: Record<PlanTerm, string> = {
  price_lock_24: "Price Lock 24",
  flex_30:       "Flex 30",
};
const ROUTER_LABELS: Record<string, string> = {
  own: "My own compatible router (£0)",
  standard: "Standard WiFi 6 router",
  premium: "Premium WiFi / mesh",
  business: "Business router (by quote)",
};
const SETUP_LABELS: Record<string, string> = {
  remote: "Remote / no-site activation",
  standard: "Standard setup",
  engineer: "Engineer / new install",
  complex: "Complex install (by quote)",
};
const TOTAL_STEPS = 7;
const getHeadlineEstimate = (bucket: SpeedBucket | null, term: PlanTerm | null) => {
  if (!bucket || !term) return null;
  const prices = FAIR_PRICING_DEFAULTS.headline[bucket];
  return term === "price_lock_24" ? prices.lock24 : prices.flex30;
};

const getClientEstimate = (
  bucket: SpeedBucket | null,
  term: PlanTerm | null,
  router: RouterChoice | null,
  routerPay: RouterPaymentType,
  setup: SetupChoice | null,
  addonIds: string[],
): Resolved | null => {
  const broadband = getHeadlineEstimate(bucket, term);
  if (broadband == null) return null;
  const routerMonthly = router === "standard" && routerPay === "monthly" ? FAIR_PRICING_DEFAULTS.router.standardMonthly : router === "premium" && routerPay === "monthly" ? FAIR_PRICING_DEFAULTS.router.premiumMonthly : 0;
  const routerOneOff = router === "standard" && routerPay === "one_off" ? FAIR_PRICING_DEFAULTS.router.standardOneOff : router === "premium" && routerPay === "one_off" ? FAIR_PRICING_DEFAULTS.router.premiumOneOff : 0;
  const setupOneOff = setup === "standard" ? FAIR_PRICING_DEFAULTS.setup.standard : setup === "engineer" ? FAIR_PRICING_DEFAULTS.setup.engineer : 0;
  const selectedAddons = ADDON_DEFS.filter((a) => addonIds.includes(a.id));
  const addonsMonthly = selectedAddons.reduce((sum, a) => sum + a.monthly, 0);
  const monthlyTotal = broadband + routerMonthly + addonsMonthly;
  const oneOffTotal = routerOneOff + setupOneOff;
  return {
    ok: true,
    quote_only: false,
    monthly_broadband_incl_vat: broadband,
    monthly_total_incl_vat: monthlyTotal,
    vat_amount: monthlyTotal / 6,
    router: router && router !== "own" && router !== "business" ? { label: ROUTER_LABELS[router], monthly: routerMonthly, oneOff: routerOneOff, payment_type: routerPay, option: router } : undefined,
    setup: setup ? { label: SETUP_LABELS[setup], oneOff: setupOneOff, option: setup } : undefined,
    addons: selectedAddons.map((a) => ({ id: a.id, label: a.label, monthly: a.monthly })),
    one_off_incl_vat: oneOffTotal,
    first_bill_incl_vat: monthlyTotal + oneOffTotal,
    first_bill_promise: FIRST_BILL_PROMISE,
  };
};

function BuildPlanInner() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const isTestMode = searchParams.get("test") === "1";
  const isFallback = searchParams.get("availability") === "fallback";
  const prefillPlan = (searchParams.get("plan") || searchParams.get("bucket")) as SpeedBucket | null;
  const testMaxDownload = Number(searchParams.get("max_download") ?? "0") || undefined;
  const testTech = searchParams.get("primary_technology") || undefined;
  const { toast } = useToast();
  const { status, result, selectedAddress } = useAvailability();
  const validBuckets: SpeedBucket[] = ["essential", "superfast", "ultrafast", "gigabit"];
  const initialBucket: SpeedBucket | null =
    prefillPlan && validBuckets.includes(prefillPlan) ? prefillPlan : null;
  const [step, setStep] = useState(initialBucket ? 2 : 1);
  const [bucket, setBucket] = useState<SpeedBucket | null>(initialBucket);
  const [term, setTerm] = useState<PlanTerm | null>(null);
  const [router, setRouter] = useState<RouterChoice | null>(null);
  const [routerPay, setRouterPay] = useState<RouterPaymentType>("none");
  const [setup, setSetup] = useState<SetupChoice | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [quoteOnlyAddons, setQuoteOnlyAddons] = useState<string[]>([]);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolving, setResolving] = useState(false);
  const initialPostcode = searchParams.get("postcode") || "";
  const [contact, setContact] = useState({
    full_name: "", email: "", phone: "", date_of_birth: "",
    address_line_1: "", address_line_2: "", town: "", county: "",
    postcode: initialPostcode,
    in_contract: "" as "" | "yes" | "no" | "unsure",
    current_provider: "",
    marketing_consent: false, privacy_ack: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Prefill contact fields (incl. DOB) from the signed-in customer's profile
  // so their existing details stay in sync across sessions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, phone, date_of_birth, address_line1, address_line2, city, postcode")
        .eq("id", user.id)
        .maybeSingle();
      if (!p || cancelled) return;
      setContact((c) => ({
        ...c,
        full_name: c.full_name || p.full_name || "",
        email: c.email || p.email || "",
        phone: c.phone || p.phone || "",
        date_of_birth: c.date_of_birth || p.date_of_birth || "",
        address_line_1: c.address_line_1 || p.address_line1 || "",
        address_line_2: c.address_line_2 || p.address_line2 || "",
        town: c.town || p.city || "",
        postcode: c.postcode || p.postcode || "",
      }));
    })();
    return () => { cancelled = true; };
  }, []);

  // First screen opens at the page top; later steps start at the selector box.
  useEffect(() => {
    const t = setTimeout(() => {
      // Always scroll back to the very top so the "Step X of 7" counter and
      // page heading stay visible when advancing between steps.
      window.scrollTo({ top: 0, left: 0, behavior: step === 1 ? "auto" : "smooth" });
      if (step !== 1) {
        headingRef.current?.focus({ preventScroll: true });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [step]);

  // Auto-advance from router step once a payment type has been chosen for
  // standard / premium router options. Own/business routers advance via their
  // own onClick handlers.
  useEffect(() => {
    if (step !== 3) return;
    if ((router === "standard" || router === "premium") && routerPay !== "none") {
      const t = setTimeout(() => setStep((s) => s === 3 ? 4 : s), 220);
      return () => clearTimeout(t);
    }
  }, [step, router, routerPay]);

  const eligibleBuckets = useMemo<SpeedBucket[]>(() => {
    const all: SpeedBucket[] = ["essential", "superfast", "ultrafast", "gigabit"];
    // National policy: every valid UK postcode sees all main buckets.
    // Live availability data, when present, only personalises confirmation copy.
    if (isFallback) return all;
    const plans = result?.eligibleOcctaPlans ?? [];
    if (!plans.length) return all;
    return all.filter((b) => plans.includes(b));
  }, [result, isFallback]);

  // True when we have not personalised plans for this address.
  const isUnpersonalised = isFallback || !result;

  // Resolve price server-side whenever choices change
  useEffect(() => {
    if (!bucket || !term) { setResolved(null); return; }
    if (isFallback) {
      setResolved({
        ...(getClientEstimate(bucket, term, router, routerPay, setup, addons) as Resolved),
        eligibility_wording: "Estimate only — final availability, setup and price are confirmed before order.",
      });
      setResolving(false);
      return;
    }
    // Live mode needs router + setup before calling the resolver.
    if (!router || !setup) { setResolved(getClientEstimate(bucket, term, router, routerPay, setup, addons)); return; }
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
        max_download: isTestMode ? testMaxDownload : result?.maxDownload,
        primary_technology: isTestMode ? testTech : result?.primaryTechnology,
        ...(isTestMode && testMaxDownload != null ? { test_availability: { max_download: testMaxDownload, primary_technology: testTech } } : {}),
      },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setResolved({ ...(getClientEstimate(bucket, term, router, routerPay, setup, addons) as Resolved), eligibility_wording: "Estimate shown while we confirm the exact final price." }); }
      else { setResolved(data as Resolved); }
    }).finally(() => !cancelled && setResolving(false));
    return () => { cancelled = true; };
  }, [bucket, term, router, routerPay, setup, addons, result, isFallback]);

  const canNext = () => {
    if (step === 1) return !!bucket;
    if (step === 2) return !!term;
    if (step === 3) return !!router && (router === "own" || router === "business" || routerPay !== "none");
    if (step === 4) return !!setup;
    if (step === 5) return true; // optional add-ons
    if (step === 6) {
      const baseOk = contact.full_name.length >= 2
        && /^[^@]+@[^@]+\.[^@]+$/.test(contact.email)
        && contact.phone.length >= 7
        && !!contact.date_of_birth
        && contact.address_line_1.trim().length >= 3
        && contact.town.trim().length >= 2
        && contact.postcode.length >= 5
        && !!contact.in_contract
        && contact.privacy_ack;
      if (!baseOk) return false;
      if (contact.in_contract === "yes" && !contact.current_provider) return false;
      return true;
    }
    return true; // step 7 review
  };

  const submitBuildPlan = async () => {
    if (!bucket || !term) return;
    setSubmitting(true);
    try {
      const addr: any = selectedAddress ?? {};
      const { getAttribution } = await import("@/lib/attribution");
      const attribution = getAttribution();
      const { data, error } = await supabase.functions.invoke("submit-build-plan", {
        body: {
          speed_bucket: bucket, plan_term: term,
          router_option: router, router_payment_type: routerPay,
          setup_option: setup, addons,
          customer_type: "residential",
          max_download: isFallback ? undefined : (isTestMode ? testMaxDownload : result?.maxDownload),
          primary_technology: isFallback ? undefined : (isTestMode ? testTech : result?.primaryTechnology),
          ...(isTestMode ? { test_mode: true, test_availability: testMaxDownload != null ? { max_download: testMaxDownload, primary_technology: testTech } : undefined } : {}),
          ...(isFallback ? { force_quote_only: true, availability_mode: "fallback" } : {}),
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          date_of_birth: contact.date_of_birth || null,
          postcode: contact.postcode || (addr.postcode as string) || "",
          address_line_1: contact.address_line_1.trim()
            || [addr.sub_premises, addr.premises_name, addr.thoroughfare_number, addr.thoroughfare_name].filter(Boolean).join(" ")
            || null,
          address_line_2: contact.address_line_2.trim() || null,
          town: contact.town.trim() || (addr.post_town as string) || null,
          county: contact.county.trim() || (addr.county as string) || null,
          in_contract: contact.in_contract || null,
          current_provider: contact.in_contract === "yes" ? (contact.current_provider || null) : null,
          preferred_contact_method: "email",
          marketing_consent: contact.marketing_consent,
          ...attribution,
        },
      });
      if (error || !data || (data as any).error) {
        throw new Error((data as any)?.error || error?.message || "submit_failed");
      }
      if (isTestMode) {
        toast({ title: "[TEST] Submitted", description: `Mode: ${(data as any).mode} · Ref: ${(data as any).reference}` });
        setSubmitting(false);
        return;
      }
      if (isFallback) {
        toast({ title: "Thanks — we'll confirm availability", description: "We'll confirm availability and send your final quote before order." });
      }
      const reference = (data as any).reference as string;
      nav(`/quote/thank-you?ref=${encodeURIComponent(reference)}`, {
        state: {
          bucketLabel: bucket ? SPEED_LABELS[bucket] : undefined,
          termLabel: term ? TERM_LABELS[term] : undefined,
          routerLabel: router ? ROUTER_LABELS[router] : undefined,
          setupLabel: setup ? SETUP_LABELS[setup] : undefined,
          addons: [
            ...addons.map((id) => ADDON_DEFS.find((a) => a.id === id)?.label).filter(Boolean) as string[],
            ...quoteOnlyAddons.map((id) => `${QUOTE_ONLY_ADDONS.find((a) => a.id === id)?.label ?? id} (by quote)`),
          ],
          postcode: (contact.postcode || "").toUpperCase(),
          monthlyEstimate: resolved?.monthly_total_incl_vat ?? resolved?.monthly_broadband_incl_vat,
          firstBillEstimate: resolved?.first_bill_incl_vat,
          email: contact.email,
        },
      });
    } catch (_err) {
      toast({ title: "Couldn't submit your plan", description: "Please try again shortly.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // National policy: no hard gate. Anyone with (or without) a confirmed
  // address can view and build a plan. We confirm the final order details
  // before they proceed.

  return (
    <Layout>
      <SEO title="Build Your Plan — OCCTA Fair Broadband" canonical="/build-plan" />
      <div className="container mx-auto px-4 py-10 md:py-14 pb-40 lg:pb-14">
        <div className="mb-6">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
          <h1 className="font-display text-3xl md:text-4xl uppercase mt-1">Build your plan</h1>
          <p className="text-sm text-muted-foreground mt-2">{FROM_PRICE_DISCLOSURE}</p>
        </div>

        {isUnpersonalised && (
          <div className="mb-6 border-4 border-foreground bg-primary/5 p-4 flex items-start gap-3">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-display uppercase tracking-wider">Broadband plans available to view</p>
              <p className="text-muted-foreground mt-1">
                Choose the plan you're interested in. We'll confirm the final speed, setup and order details before you proceed.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div className="border-4 border-foreground bg-background p-6 md:p-8 lg:min-h-[640px] flex flex-col">
            {step === 1 && (
              <Step title="Choose your speed" headingRef={headingRef}>
                <div className="grid gap-3">
                  {(["essential","superfast","ultrafast","gigabit"] as SpeedBucket[]).map((b) => {
                    const meta = SPEED_BUCKET_META[b];
                    const isEligible = eligibleBuckets.includes(b);
                    const selected = bucket === b;
                    const headline = FAIR_PRICING_DEFAULTS.headline[b];
                    return (
                      <button key={b} onClick={() => { if (!isEligible) return; setBucket(b); setTimeout(() => setStep((s) => s === 1 ? 2 : s), 180); }} disabled={!isEligible}
                        className={`text-left p-5 border-4 transition-colors ${selected ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"} ${!isEligible ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display uppercase text-lg">{meta.title}</p>
                            <p className="text-sm text-muted-foreground">{meta.speedRange}</p>
                            <p className="text-sm mt-1">{meta.tagline}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Price Lock 24 from £{headline.lock24.toFixed(2)}/month · Flex 30 from £{headline.flex30.toFixed(2)}/month
                            </p>
                            {isUnpersonalised && (
                              <p className="text-[11px] uppercase tracking-wider font-display mt-2 inline-block border-2 border-foreground/40 px-2 py-0.5">
                                Subject to confirmation
                              </p>
                            )}
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
              <Step title="Choose plan type" headingRef={headingRef}>
                <div className="grid gap-3">
                  <OptionCard selected={term === "price_lock_24"} onClick={() => { setTerm("price_lock_24"); setTimeout(() => setStep((s) => s === 2 ? 3 : s), 180); }}
                    title="Price Lock 24" subtitle="Fixed monthly broadband price for 24 months." body={PRICE_LOCK_WORDING} />
                  <OptionCard selected={term === "flex_30"} onClick={() => { setTerm("flex_30"); setTimeout(() => setStep((s) => s === 2 ? 3 : s), 180); }}
                    title="Flex 30" subtitle="30-day rolling where available." body={FLEX_30_WORDING} />
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step title="Choose your router" headingRef={headingRef}>
                <div className="grid gap-3">
                  <OptionCard selected={router === "own"} onClick={() => { setRouter("own"); setRouterPay("none"); setTimeout(() => setStep((s) => s === 3 ? 4 : s), 200); }}
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
                  <OptionCard selected={router === "business"} onClick={() => { setRouter("business"); setRouterPay("none"); setTimeout(() => setStep((s) => s === 3 ? 4 : s), 200); }}
                    title="Business router" subtitle="Available by quote." body="We'll quote a business-grade router for your needs." />
                </div>
              </Step>
            )}

            {step === 4 && (
              <Step title="Choose setup" headingRef={headingRef}>
                <div className="grid gap-3">
                  <OptionCard selected={setup === "remote"} onClick={() => { setSetup("remote"); setTimeout(() => setStep((s) => s === 4 ? 5 : s), 180); }}
                    title="Remote / no-site activation" subtitle="£0 where available" body="No engineer needed for most existing fibre lines." />
                  <OptionCard selected={setup === "standard"} onClick={() => { setSetup("standard"); setTimeout(() => setStep((s) => s === 4 ? 5 : s), 180); }}
                    title="Standard setup" subtitle="From £49.99" body="For lines needing a non-engineer activation step." />
                  <OptionCard selected={setup === "engineer"} onClick={() => { setSetup("engineer"); setTimeout(() => setStep((s) => s === 4 ? 5 : s), 180); }}
                    title="Engineer / new install" subtitle="From £99.99" body="For new lines that need an engineer visit." />
                  <OptionCard selected={setup === "complex"} onClick={() => { setSetup("complex"); setTimeout(() => setStep((s) => s === 4 ? 5 : s), 180); }}
                    title="Complex install / survey / ECC" subtitle="Available by quote." body="If the site needs a survey or excess construction charge." />
                </div>
              </Step>
            )}

            {step === 5 && (
              <Step title="Optional extras" headingRef={headingRef}>
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
                  {QUOTE_ONLY_ADDONS.map((a) => {
                    const on = quoteOnlyAddons.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => setQuoteOnlyAddons((xs) => on ? xs.filter(x => x !== a.id) : [...xs, a.id])}
                        className={`text-left p-5 border-4 transition-colors flex items-center justify-between gap-3 ${on ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"}`}>
                        <div>
                          <p className="font-display uppercase">{a.label}</p>
                          <p className="text-sm text-muted-foreground">Available by quote.</p>
                        </div>
                        {on && <Check className="w-5 h-5" />}
                      </button>
                    );
                  })}
                </div>
                {addons.includes("digital_voice") && (
                  <div className="mt-4">
                    <EmergencyCallNote />
                  </div>
                )}
              </Step>
            )}

            {step === 6 && (
              <Step title="Your details" headingRef={headingRef}>
                <div className="grid gap-4">
                  <div>
                    <Label className="text-sm">Full name *</Label>
                    <Input value={contact.full_name} onChange={(e) => setContact((c) => ({ ...c, full_name: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Email *</Label>
                      <Input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Phone *</Label>
                      <Input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Date of birth *</Label>
                    <Input type="date" value={contact.date_of_birth} onChange={(e) => setContact((c) => ({ ...c, date_of_birth: e.target.value }))} className="mt-1" max={new Date().toISOString().split("T")[0]} />
                    <p className="text-xs text-muted-foreground mt-1">Used to verify your account and required for credit/DD checks.</p>
                  </div>
                  <div className="border-t-2 border-foreground/10 pt-4">
                    <p className="font-display uppercase text-xs tracking-wider text-muted-foreground mb-3">Installation address</p>
                    <div className="mb-4">
                      <AddressAutocomplete
                        onSelect={(addr) =>
                          setContact((c) => ({
                            ...c,
                            address_line_1: addr.line1 || c.address_line_1,
                            address_line_2: addr.line2 || c.address_line_2,
                            town: addr.city || c.town,
                            postcode: addr.postcode || c.postcode,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-3">
                      <div>
                        <Label className="text-sm">Address line 1 *</Label>
                        <Input placeholder="House number and street" value={contact.address_line_1} onChange={(e) => setContact((c) => ({ ...c, address_line_1: e.target.value }))} className="mt-1" maxLength={160} />
                      </div>
                      <div>
                        <Label className="text-sm">Address line 2</Label>
                        <Input placeholder="Flat, building, etc. (optional)" value={contact.address_line_2} onChange={(e) => setContact((c) => ({ ...c, address_line_2: e.target.value }))} className="mt-1" maxLength={160} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Town / city *</Label>
                          <Input value={contact.town} onChange={(e) => setContact((c) => ({ ...c, town: e.target.value }))} className="mt-1" maxLength={80} />
                        </div>
                        <div>
                          <Label className="text-sm">County</Label>
                          <Input value={contact.county} onChange={(e) => setContact((c) => ({ ...c, county: e.target.value }))} className="mt-1" maxLength={80} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Postcode *</Label>
                        <Input value={contact.postcode} onChange={(e) => setContact((c) => ({ ...c, postcode: e.target.value.toUpperCase() }))} className="mt-1 font-mono" maxLength={10} />
                      </div>
                    </div>
                  </div>
                  <div className="border-t-2 border-foreground/10 pt-4">
                    <p className="font-display uppercase text-xs tracking-wider text-muted-foreground mb-3">Your current setup</p>
                    <Label className="text-sm">Are you currently in a contract with another provider? *</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(["yes","no","unsure"] as const).map((opt) => (
                        <button key={opt} type="button"
                          onClick={() => setContact((c) => ({ ...c, in_contract: opt, current_provider: opt === "yes" ? c.current_provider : "" }))}
                          className={`p-3 border-4 font-display uppercase text-sm transition-colors ${contact.in_contract === opt ? "border-foreground bg-primary/10" : "border-foreground/20 hover:border-foreground"}`}>
                          {opt === "yes" ? "Yes" : opt === "no" ? "No" : "Not sure"}
                        </button>
                      ))}
                    </div>
                    {contact.in_contract === "yes" && (
                      <div className="mt-3">
                        <Label className="text-sm">Current provider *</Label>
                        <Select value={contact.current_provider} onValueChange={(v) => setContact((c) => ({ ...c, current_provider: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select your provider" /></SelectTrigger>
                          <SelectContent>
                            {UK_TELECOM_PROVIDERS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          We'll let you know how to switch smoothly — most UK providers handle the changeover automatically.
                        </p>
                      </div>
                    )}
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox checked={contact.marketing_consent} onCheckedChange={(v) => setContact((c) => ({ ...c, marketing_consent: !!v }))} />
                    <span className="text-muted-foreground">I'm happy to receive occasional OCCTA updates. Unsubscribe anytime.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox checked={contact.privacy_ack} onCheckedChange={(v) => setContact((c) => ({ ...c, privacy_ack: !!v }))} />
                    <span>I've read the Privacy Policy and agree to OCCTA contacting me about this quote. *</span>
                  </label>
                  {resolved?.quote_only && (
                    <p className="text-xs text-muted-foreground border-t-2 border-foreground/10 pt-3">
                      This address needs a manual quote so we can confirm the best available option.
                    </p>
                  )}
                </div>
              </Step>
            )}

            {step === 7 && (
              <Step title="Review your plan" headingRef={headingRef}>
                <div className="space-y-3 text-sm">
                  <ReviewLine label="Speed" value={bucket ? SPEED_LABELS[bucket] : "—"} />
                  <ReviewLine label="Plan type" value={term ? TERM_LABELS[term] : "—"} />
                  <ReviewLine label="Router" value={router ? ROUTER_LABELS[router] : "—"} />
                  <ReviewLine label="Setup" value={setup ? SETUP_LABELS[setup] : "—"} />
                  <ReviewLine label="Add-ons" value={
                    [...addons.map((id) => ADDON_DEFS.find(a => a.id === id)?.label).filter(Boolean) as string[],
                     ...quoteOnlyAddons.map((id) => `${QUOTE_ONLY_ADDONS.find(a => a.id === id)?.label} (by quote)`)
                    ].join(", ") || "None"
                  } />
                  <ReviewLine label="Postcode" value={(contact.postcode || "").toUpperCase() || "—"} />
                  <div className="border-t-4 border-foreground pt-3 mt-3 space-y-1">
                    <ReviewLine label="Estimated monthly total" value={resolved?.monthly_total_incl_vat != null ? `£${resolved.monthly_total_incl_vat.toFixed(2)}` : (resolved?.monthly_broadband_incl_vat != null ? `From £${resolved.monthly_broadband_incl_vat.toFixed(2)}` : "—")} bold />
                    {(resolved?.one_off_incl_vat ?? 0) > 0 && (
                      <ReviewLine label="Estimated one-off total" value={`£${(resolved?.one_off_incl_vat ?? 0).toFixed(2)}`} bold />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Estimate — final speed, setup and order details confirmed before you proceed.
                  </p>
                  {addons.includes("digital_voice") && (
                    <div className="mt-4">
                      <EmergencyCallNote />
                    </div>
                  )}
                </div>
              </Step>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t-2 border-foreground/10">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              {step < TOTAL_STEPS ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={submitBuildPlan} disabled={!canNext() || submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <>Get my quote <ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
              )}
            </div>
          </div>

          <FirstBillPreview resolved={resolved} resolving={resolving} isFallback={isUnpersonalised} />
        </div>
      </div>

      {/* Mobile sticky bottom estimate bar */}
      <MobileEstimateBar
        bucket={bucket}
        term={term}
        resolved={resolved}
        isUnpersonalised={isUnpersonalised}
      />
    </Layout>
  );
}

function Step({ title, children, headingRef }: { title: string; children: React.ReactNode; headingRef?: React.RefObject<HTMLHeadingElement> }) {
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl uppercase mb-5 outline-none">{title}</h2>
      {children}
    </div>
  );
}

function ReviewLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-display uppercase" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "" : "font-medium text-right"}>{value}</span>
    </div>
  );
}

function MobileEstimateBar({ bucket, term, resolved, isUnpersonalised }: {
  bucket: SpeedBucket | null;
  term: PlanTerm | null;
  resolved: Resolved | null;
  isUnpersonalised: boolean;
}) {
  const monthly = resolved?.monthly_total_incl_vat ?? resolved?.monthly_broadband_incl_vat;
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background border-t-4 border-foreground px-3 pt-3 pr-20 z-40" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {bucket ? SPEED_LABELS[bucket] : "Choose your plan"}{term ? ` · ${TERM_LABELS[term]}` : ""}
          </p>
          <p className="font-display text-lg leading-tight truncate">
            {monthly != null
              ? `${isUnpersonalised ? "From " : ""}£${monthly.toFixed(2)}/mo`
              : bucket
                ? `From £${FAIR_PRICING_DEFAULTS.headline[bucket].lock24.toFixed(2)}/mo`
                : "Pick a speed"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Final price confirmed before you proceed.
          </p>
        </div>
      </div>
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

function FirstBillPreview({ resolved, resolving, isFallback }: { resolved: Resolved | null; resolving: boolean; isFallback?: boolean }) {
  return (
    <aside className="border-4 border-foreground bg-background p-6 self-start lg:sticky lg:top-24">
      <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
        Estimated price{isFallback ? " — subject to confirmation" : ""}
      </p>
      <h3 className="font-display text-xl uppercase mb-4">Your estimate</h3>

      {resolving && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</div>}

      {!resolving && !resolved && (
        <p className="text-sm text-muted-foreground">Pick a speed and plan type to see your estimate.</p>
      )}

      {!resolving && resolved?.quote_only && (
        <div className="text-sm space-y-2">
          <p className="flex items-start gap-2"><Info className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{resolved.message ?? "Available by quote."}</span></p>
          {isFallback && resolved.monthly_broadband_incl_vat != null && (
            <p className="text-base font-display mt-2">
              From £{resolved.monthly_broadband_incl_vat.toFixed(2)}/month
              <span className="block text-xs text-muted-foreground font-normal mt-1">
                Estimate only. Final price confirmed before order.
              </span>
            </p>
          )}
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
              <div className="border-t-4 border-foreground pt-3 mt-2">
                <Line label="Estimated one-off total" value={`£${(resolved.one_off_incl_vat ?? 0).toFixed(2)}`} bold />
              </div>
            </div>
          )}
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routingAttempt, setRoutingAttempt] = useState(0);
  const started = useRef(false);
  const allowLegacyTest = searchParams.get("test") === "1";

  useEffect(() => {
    if (allowLegacyTest || started.current) return;
    started.current = true;
    setRoutingError(null);
    void startAssignedJourney(
      (path) => navigate(path, { replace: true }),
      (message) => setRoutingError(message),
    );
  }, [allowLegacyTest, navigate, routingAttempt]);

  if (!allowLegacyTest) {
    return (
      <Layout>
        <SEO
          title="Starting your broadband order | OCCTA Limited"
          description="Start your OCCTA broadband order with clear prices, contract terms and Direct Debit setup."
          canonical="/order"
          noIndex
        />
        <main className="container mx-auto max-w-xl px-4 py-16 text-center" aria-live="polite">
          {routingError ? (
            <div className="border-4 border-foreground p-8">
              <h1 className="font-display text-2xl uppercase">We couldn't start your order</h1>
              <p className="mt-3 text-sm text-muted-foreground">{routingError}</p>
              <Button
                className="mt-5"
                onClick={() => {
                  started.current = false;
                  setRoutingAttempt((attempt) => attempt + 1);
                }}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin" aria-hidden="true" />
              <h1 className="font-display text-2xl uppercase">Starting your order</h1>
              <p className="mt-2 text-sm text-muted-foreground">Loading the latest OCCTA ordering journey…</p>
            </>
          )}
        </main>
      </Layout>
    );
  }

  return (
    <AvailabilityProvider>
      <BuildPlanInner />
    </AvailabilityProvider>
  );
}