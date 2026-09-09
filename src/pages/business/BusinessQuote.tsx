import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityProvider, getAddressLabel, useAvailability } from "@/contexts/AvailabilityContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Wifi, PhoneCall, Smartphone, Building2, Cable, Search, ShieldCheck } from "lucide-react";

type ServiceKey = "broadband" | "voice" | "sim" | "bundle" | "leased_line";

const SERVICES: { key: ServiceKey; label: string; icon: typeof Wifi; hint: string }[] = [
  { key: "broadband", label: "Business Broadband", icon: Wifi, hint: "SoGEA, full fibre and gigabit" },
  { key: "voice", label: "Hosted VoIP / SIP", icon: PhoneCall, hint: "Numbers, users and call routing" },
  { key: "sim", label: "Business SIMs", icon: Smartphone, hint: "Team mobile requirements" },
  { key: "bundle", label: "Multi-service bundle", icon: Building2, hint: "Broadband + voice + mobile" },
  { key: "leased_line", label: "Dedicated / leased line", icon: Cable, hint: "Survey-led dedicated connectivity" },
];

const TIER_TO_SPEED: Record<string, string> = {
  "biz-sogea-80": "80",
  "biz-fttp-160": "160",
  "biz-fttp-330": "330",
  "biz-fttp-550": "550",
  "biz-fttp-1000": "1000",
  "biz-leased-line": "dedicated",
};

const BusinessQuoteInner = () => {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const initialService = params.get("service");
  const initialTier = params.get("tier") ?? "";
  const initialBundle = params.get("bundle") ?? "";
  const initialServices = useMemo(() => {
    const selected = new Set<ServiceKey>();
    if (initialService === "broadband") selected.add("broadband");
    else if (initialService === "bundle") selected.add("bundle");
    else if (initialService === "voice") selected.add("voice");
    else if (initialService === "sim") selected.add("sim");
    if (initialTier === "biz-leased-line") selected.add("leased_line");
    return selected;
  }, [initialService, initialTier]);

  const availability = useAvailability();
  const [step, setStep] = useState(initialServices.size ? 2 : 1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [quoteRef, setQuoteRef] = useState("");
  const [services, setServices] = useState<Set<ServiceKey>>(initialServices);
  const [reqs, setReqs] = useState<Record<string, string>>({
    bb_speed: TIER_TO_SPEED[initialTier] ?? "",
    bundle_design: initialBundle,
    term_preference: "best_value",
    connection_type: "unknown",
    router_preference: "unsure",
    care_preference: "standard",
    static_ip: "no",
    continuity: "no",
  });
  const [sitePostcode, setSitePostcode] = useState("");
  const [contact, setContact] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    site_count: 1,
    sla_preference: "standard" as "standard" | "priority" | "enhanced",
    message: "",
    consent: false,
  });

  const needsFixedSite = services.has("broadband") || services.has("bundle") || services.has("leased_line");
  const selectedAddressLabel = availability.selectedAddress ? getAddressLabel(availability.selectedAddress) : "";
  const toggleService = (k: ServiceKey) => setServices((s) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const setReq = (k: string, v: string) => setReqs((r) => ({ ...r, [k]: v }));

  const checkSite = async () => {
    if (!sitePostcode.trim()) {
      toast({ title: "Enter the service postcode first.", variant: "destructive" });
      return;
    }
    await availability.checkPostcode(sitePostcode.toUpperCase());
  };

  const submit = async () => {
    if (!contact.consent) {
      toast({ title: "Please accept the privacy notice.", variant: "destructive" });
      return;
    }
    if (!contact.company_name.trim() || !contact.contact_name.trim() || !contact.email.trim()) {
      toast({ title: "Company, contact name and work email are required.", variant: "destructive" });
      return;
    }
    if (services.size === 0) {
      setStep(1);
      toast({ title: "Pick at least one service.", variant: "destructive" });
      return;
    }
    if (needsFixedSite && !sitePostcode.trim()) {
      setStep(2);
      toast({ title: "Add the service postcode so we can qualify the route.", variant: "destructive" });
      return;
    }

    const requirements = {
      ...reqs,
      site_postcode: sitePostcode.trim().toUpperCase(),
      selected_address: selectedAddressLabel || null,
      availability_confirmed: availability.status === "success" ? "yes" : "no",
      availability_max_download: availability.result?.maxDownload != null ? String(availability.result.maxDownload) : null,
      availability_max_upload: availability.result?.maxUpload != null ? String(availability.result.maxUpload) : null,
      availability_primary_technology: availability.result?.primaryTechnology ?? null,
      selected_marketing_tier: initialTier || null,
      selected_bundle_design: initialBundle || null,
    };

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-business-quote", {
      body: {
        ...contact,
        services: Array.from(services),
        requirements,
        source: "business_quote_page_v2",
      },
    });
    setSubmitting(false);

    if (error || !data?.ok) {
      toast({ title: "We couldn't save the request", description: error?.message || data?.error || "Please try again.", variant: "destructive" });
      return;
    }
    setQuoteRef(data.reference || data.id || "Saved");
    setDone(true);
  };

  if (done) {
    return (
      <Layout>
        <SEO title="Business quote request received — OCCTA" description="Your OCCTA business quote request has been received." canonical="/business/quote" />
        <section className="container mx-auto px-4 py-24 max-w-2xl text-center">
          <div className="border-4 border-foreground bg-secondary p-10 shadow-brutal">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-primary" />
            <h1 className="font-display text-4xl mb-3">Request safely received.</h1>
            <p className="text-muted-foreground mb-5">Your business quote reference is <strong>{quoteRef}</strong>. We have recorded the service requirement and will use the current supplier catalogue when preparing the commercial route.</p>
            <div className="border-2 border-foreground bg-background p-4 text-left text-sm mb-6">
              <strong>This is a quote request, not a supplier order.</strong> No broadband order is sent to a network from this page. Final availability, product, term, charges and any care or installation terms are confirmed before contract acceptance and provisioning.
            </div>
            <p className="text-sm text-muted-foreground">A confirmation is sent to the work email supplied. Keep the reference above for any follow-up.</p>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Get a Business Telecom Quote — OCCTA" description="Check your service address and build an OCCTA business broadband, VoIP, SIM or multi-site quote." canonical="/business/quote" keywords="business broadband quote, business VoIP quote, business SIM quote, UK business telecom" />
      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase tracking-wider text-xs mb-3">Business quote engine</span>
          <h1 className="font-display text-4xl md:text-5xl mb-3">Qualify the requirement before the contract.</h1>
          <p className="text-muted-foreground">Service → site and commercial needs → authorised contact. Standard single-site broadband is fast-tracked; bespoke and multi-site work stays quote-led.</p>
        </div>

        <div className="flex gap-1 mb-6">
          {[1, 2, 3].map((n) => <div key={n} className={`h-1.5 flex-1 border-2 border-foreground ${n <= step ? "bg-primary" : "bg-background"}`} />)}
        </div>

        {step === 1 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl">1. Which services?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SERVICES.map((s) => {
                const selected = services.has(s.key);
                return (
                  <button key={s.key} type="button" onClick={() => toggleService(s.key)} className={`flex items-start gap-3 border-4 p-4 text-left transition ${selected ? "border-foreground bg-primary text-primary-foreground" : "border-foreground/30 hover:border-foreground"}`}>
                    <s.icon className="w-6 h-6 flex-shrink-0" />
                    <div className="min-w-0"><div className="font-display">{s.label}</div><div className="text-xs opacity-80">{s.hint}</div></div>
                    {selected && <CheckCircle2 className="w-5 h-5 ml-auto" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end"><Button variant="hero" disabled={services.size === 0} onClick={() => setStep(2)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-6">
            <h2 className="font-display text-2xl">2. Site & commercial requirements</h2>

            {needsFixedSite && (
              <div className="border-4 border-foreground bg-secondary p-4">
                <div className="font-display text-lg mb-1">Service address check</div>
                <p className="text-xs text-muted-foreground mb-3">This helps us qualify technology and speed. It does not place an order or guarantee a supplier route.</p>
                <div className="flex gap-2">
                  <Input value={sitePostcode} onChange={(e) => { setSitePostcode(e.target.value.toUpperCase()); if (availability.postcode && availability.postcode !== e.target.value.toUpperCase()) availability.reset(); }} placeholder="e.g. HD3 3WU" maxLength={10} />
                  <Button type="button" variant="outline" onClick={checkSite} disabled={availability.status === "loading-postcode" || availability.status === "checking-address"}>
                    {availability.status === "loading-postcode" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2 hidden sm:inline">Find address</span>
                  </Button>
                </div>
                {availability.status === "addresses" && availability.addresses.length > 0 && (
                  <div className="mt-3 max-h-56 overflow-auto border-2 border-foreground bg-background divide-y-2 divide-foreground/20">
                    {availability.addresses.map((addr, idx) => (
                      <button key={idx} type="button" onClick={() => availability.selectAddress(addr)} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary">{getAddressLabel(addr)}</button>
                    ))}
                  </div>
                )}
                {availability.status === "checking-address" && <p className="text-sm mt-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking the selected address…</p>}
                {availability.status === "success" && availability.selectedAddress && (
                  <div className="mt-3 border-2 border-foreground bg-background p-3 text-sm">
                    <div className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /><div><strong>{selectedAddressLabel}</strong><div className="text-muted-foreground mt-1">Current availability lookup reports {availability.result?.primaryTechnology || "broadband"} with a maximum download indication of up to {availability.result?.maxDownload ?? "—"} Mbps. The final supplier route is still validated before order.</div></div></div>
                  </div>
                )}
                {availability.status === "error" && <p className="text-xs text-destructive mt-2">{availability.errorMessage} You can still submit the postcode; the request will be routed for manual qualification.</p>}
              </div>
            )}

            {(services.has("broadband") || services.has("bundle")) && (
              <div className="border-l-4 border-primary pl-4 space-y-4">
                <div className="font-display text-lg">Broadband configuration</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Preferred capacity</Label>
                    <Select value={reqs.bb_speed ?? ""} onValueChange={(v) => setReq("bb_speed", v)}>
                      <SelectTrigger><SelectValue placeholder="Best suitable option" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80">Up to 80 Mbps</SelectItem>
                        <SelectItem value="160">Up to 160 Mbps</SelectItem>
                        <SelectItem value="330">Up to 330 Mbps</SelectItem>
                        <SelectItem value="550">Up to 550 Mbps</SelectItem>
                        <SelectItem value="1000">Up to 1 Gbps</SelectItem>
                        <SelectItem value="best">Best suitable option</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Commercial term preference</Label>
                    <Select value={reqs.term_preference} onValueChange={(v) => setReq("term_preference", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Rolling / short term where available</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="best_value">Best-value eligible route</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>New line or switch?</Label>
                    <Select value={reqs.connection_type} onValueChange={(v) => setReq("connection_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="new">New service</SelectItem><SelectItem value="switch">Switch / migrate existing service</SelectItem><SelectItem value="unknown">Not sure</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Router</Label>
                    <Select value={reqs.router_preference} onValueChange={(v) => setReq("router_preference", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="own">Use compatible own router</SelectItem><SelectItem value="standard">OCCTA standard router</SelectItem><SelectItem value="business">Business Wi-Fi / managed setup</SelectItem><SelectItem value="unsure">Recommend one</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Network care</Label>
                    <Select value={reqs.care_preference} onValueChange={(v) => setReq("care_preference", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="standard">Standard included care</SelectItem><SelectItem value="enhanced">Enhanced care</SelectItem><SelectItem value="premium">Fastest available care</SelectItem><SelectItem value="unsure">Recommend one</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Current provider (optional)</Label>
                    <Input value={reqs.current_provider ?? ""} onChange={(e) => setReq("current_provider", e.target.value)} placeholder="If switching" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 border-2 border-foreground p-3"><Checkbox checked={reqs.static_ip === "yes"} onCheckedChange={(v) => setReq("static_ip", v ? "yes" : "no")} /> <span className="text-sm">Static IP required</span></label>
                  <label className="flex items-center gap-2 border-2 border-foreground p-3"><Checkbox checked={reqs.continuity === "yes"} onCheckedChange={(v) => setReq("continuity", v ? "yes" : "no")} /> <span className="text-sm">4G/5G continuity required</span></label>
                </div>
              </div>
            )}

            {services.has("leased_line") && (
              <div className="border-l-4 border-primary pl-4 grid sm:grid-cols-2 gap-3">
                <div><Label>Dedicated bandwidth</Label><Input value={reqs.ll_bw ?? ""} onChange={(e) => setReq("ll_bw", e.target.value)} placeholder="e.g. 100 / 500 / 1000 Mbps" /></div>
                <div><Label>Business requirement / SLA</Label><Input value={reqs.ll_sla ?? ""} onChange={(e) => setReq("ll_sla", e.target.value)} placeholder="Describe required resilience or response" /></div>
              </div>
            )}

            {services.has("voice") && (
              <div className="border-l-4 border-primary pl-4 grid sm:grid-cols-2 gap-3">
                <div><Label>Voice users / seats</Label><Input type="number" min={1} value={reqs.voice_seats ?? ""} onChange={(e) => setReq("voice_seats", e.target.value)} /></div>
                <div><Label>Existing numbers to port?</Label><Input value={reqs.voice_porting ?? ""} onChange={(e) => setReq("voice_porting", e.target.value)} placeholder="No / yes + approximate quantity" /></div>
              </div>
            )}

            {services.has("sim") && (
              <div className="border-l-4 border-primary pl-4 grid sm:grid-cols-2 gap-3">
                <div><Label>SIM lines</Label><Input type="number" min={1} value={reqs.sim_lines ?? ""} onChange={(e) => setReq("sim_lines", e.target.value)} /></div>
                <div><Label>Data / roaming requirement</Label><Input value={reqs.sim_data ?? ""} onChange={(e) => setReq("sim_data", e.target.value)} placeholder="e.g. 100GB pooled + EU roaming" /></div>
              </div>
            )}

            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button><Button variant="hero" onClick={() => setStep(3)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl">3. Authorised business contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Company / trading name *</Label><Input value={contact.company_name} onChange={(e) => setContact((c) => ({ ...c, company_name: e.target.value }))} /></div>
              <div><Label>Your name *</Label><Input value={contact.contact_name} onChange={(e) => setContact((c) => ({ ...c, contact_name: e.target.value }))} /></div>
              <div><Label>Work email *</Label><Input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /></div>
              <div><Label>Number of sites</Label><Input type="number" min={1} max={500} value={contact.site_count} onChange={(e) => setContact((c) => ({ ...c, site_count: Number(e.target.value) || 1 }))} /></div>
              <div>
                <Label>Care priority</Label>
                <Select value={contact.sla_preference} onValueChange={(v) => setContact((c) => ({ ...c, sla_preference: v as "standard" | "priority" | "enhanced" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="standard">Standard network care</SelectItem><SelectItem value="priority">Enhanced care — target confirmed in quote</SelectItem><SelectItem value="enhanced">Premium care — fastest available target</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Timing, existing contract or other constraints</Label><Textarea rows={3} value={contact.message} onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))} placeholder="Target go-live date, contract end date, building access, critical applications…" /></div>
            <div className="border-2 border-foreground bg-secondary p-3 text-xs text-muted-foreground flex gap-2"><ShieldCheck className="w-4 h-4 flex-shrink-0 text-primary" /><span>Submitting creates a business quote request only. It does not accept a contract, collect payment or submit an order to a supplier.</span></div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground"><Checkbox checked={contact.consent} onCheckedChange={(v) => setContact((c) => ({ ...c, consent: !!v }))} className="mt-0.5" /><span>I agree OCCTA can contact me about this request. See our <a href="/privacy" className="underline">Privacy Policy</a>.</span></label>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button><Button variant="hero" size="lg" onClick={submit} disabled={submitting}>{submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Submit business quote request"}</Button></div>
          </div>
        )}
      </section>
    </Layout>
  );
};

const BusinessQuote = () => (
  <AvailabilityProvider>
    <BusinessQuoteInner />
  </AvailabilityProvider>
);

export default BusinessQuote;