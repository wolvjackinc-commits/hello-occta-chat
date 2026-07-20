import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Wifi, PhoneCall, Smartphone, Building2, Cable } from "lucide-react";

type ServiceKey = "broadband" | "voice" | "sim" | "bundle" | "leased_line";

const SERVICES: { key: ServiceKey; label: string; icon: any; hint: string }[] = [
  { key: "broadband", label: "Business Broadband", icon: Wifi, hint: "SoGEA, FTTP, static IP" },
  { key: "voice", label: "Hosted VoIP / SIP", icon: PhoneCall, hint: "UK numbers, call queues" },
  { key: "sim", label: "Business SIMs", icon: Smartphone, hint: "Pooled data, EU roaming" },
  { key: "bundle", label: "Multi-service bundle", icon: Building2, hint: "Broadband + voice + SIM" },
  { key: "leased_line", label: "Leased line / dedicated", icon: Cable, hint: "Symmetric, SLA-backed" },
];

const BusinessQuote = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [services, setServices] = useState<Set<ServiceKey>>(new Set());
  const [reqs, setReqs] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({
    company_name: "", contact_name: "", email: "", phone: "", site_count: 1,
    sla_preference: "standard" as "standard" | "priority" | "enhanced",
    message: "", consent: false,
  });

  const toggleService = (k: ServiceKey) => {
    setServices((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  };
  const setReq = (k: string, v: string) => setReqs((r) => ({ ...r, [k]: v }));

  const submit = async () => {
    if (!contact.consent) { toast({ title: "Please accept the privacy notice.", variant: "destructive" }); return; }
    if (services.size === 0) { setStep(1); toast({ title: "Pick at least one service.", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-business-quote", {
      body: {
        ...contact,
        services: Array.from(services),
        requirements: reqs,
        source: "business_quote_page",
      },
    });
    setSubmitting(false);
    if (error) { toast({ title: "Something went wrong", description: error.message, variant: "destructive" }); return; }
    setDone(true);
  };

  if (done) {
    return (
      <Layout>
        <SEO title="Quote received" description="Your business quote request has been received." canonical="/business/quote" />
        <section className="container mx-auto px-4 py-24 max-w-2xl text-center">
          <div className="border-4 border-foreground bg-secondary p-10 shadow-brutal">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-primary" />
            <h1 className="font-display text-4xl mb-3">Got it — thanks!</h1>
            <p className="text-muted-foreground mb-6">A UK-based specialist will send you a tailored quote within 1 working day.</p>
            <div className="text-sm">
              While you wait, <a href="/business" className="underline">explore our bundles</a> or <a href="/business/support" className="underline">check support</a>.
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Get a Business Quote — OCCTA" description="Pick your services, share requirements, and get a tailored quote in 1 working day." canonical="/business/quote" keywords="business broadband quote, business VoIP quote, business SIM quote, UK business telecom" />
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase tracking-wider text-xs mb-3">Get a quote</span>
          <h1 className="font-display text-4xl md:text-5xl mb-3">Tell us what you need.</h1>
          <p className="text-muted-foreground">Three quick steps. Tailored quote in one working day.</p>
        </div>

        <div className="flex gap-1 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 flex-1 border-2 border-foreground ${n <= step ? "bg-primary" : "bg-background"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl">1. Which services?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SERVICES.map((s) => {
                const selected = services.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleService(s.key)}
                    className={`flex items-start gap-3 border-4 p-4 text-left transition ${selected ? "border-foreground bg-primary text-primary-foreground" : "border-foreground/30 hover:border-foreground"}`}
                  >
                    <s.icon className="w-6 h-6 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display">{s.label}</div>
                      <div className="text-xs opacity-80">{s.hint}</div>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 ml-auto" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="hero" disabled={services.size === 0} onClick={() => setStep(2)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl">2. Requirements</h2>
            {services.has("broadband") && (
              <div className="border-l-4 border-primary pl-3">
                <div className="font-display mb-2">Broadband</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sites</Label><Input type="number" min={1} value={reqs.bb_sites ?? ""} onChange={(e) => setReq("bb_sites", e.target.value)} placeholder="1" /></div>
                  <div>
                    <Label>Speed needed</Label>
                    <Select value={reqs.bb_speed ?? ""} onValueChange={(v) => setReq("bb_speed", v)}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="up_to_80">Up to 80 Mbps</SelectItem>
                        <SelectItem value="150">~150 Mbps</SelectItem>
                        <SelectItem value="500">~500 Mbps</SelectItem>
                        <SelectItem value="900">~900 Mbps</SelectItem>
                        <SelectItem value="gig_plus">1 Gbps+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            {services.has("voice") && (
              <div className="border-l-4 border-primary pl-3">
                <div className="font-display mb-2">Voice</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Seats / users</Label><Input type="number" min={1} value={reqs.voice_seats ?? ""} onChange={(e) => setReq("voice_seats", e.target.value)} placeholder="5" /></div>
                  <div><Label>Existing numbers to port?</Label><Input value={reqs.voice_porting ?? ""} onChange={(e) => setReq("voice_porting", e.target.value)} placeholder="Yes / No / how many" /></div>
                </div>
              </div>
            )}
            {services.has("sim") && (
              <div className="border-l-4 border-primary pl-3">
                <div className="font-display mb-2">SIMs</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Lines</Label><Input type="number" min={1} value={reqs.sim_lines ?? ""} onChange={(e) => setReq("sim_lines", e.target.value)} placeholder="10" /></div>
                  <div><Label>Monthly data / line</Label><Input value={reqs.sim_data ?? ""} onChange={(e) => setReq("sim_data", e.target.value)} placeholder="e.g. 20 GB pooled" /></div>
                </div>
              </div>
            )}
            {services.has("bundle") && (
              <div className="border-l-4 border-primary pl-3">
                <div className="font-display mb-2">Bundle</div>
                <div><Label>What matters most?</Label><Textarea rows={2} value={reqs.bundle_notes ?? ""} onChange={(e) => setReq("bundle_notes", e.target.value)} placeholder="Simplicity, price, uptime…" /></div>
              </div>
            )}
            {services.has("leased_line") && (
              <div className="border-l-4 border-primary pl-3">
                <div className="font-display mb-2">Leased line</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bandwidth</Label><Input value={reqs.ll_bw ?? ""} onChange={(e) => setReq("ll_bw", e.target.value)} placeholder="100 / 500 / 1000 Mbps" /></div>
                  <div><Label>Uptime SLA needed</Label><Input value={reqs.ll_sla ?? ""} onChange={(e) => setReq("ll_sla", e.target.value)} placeholder="e.g. 99.95%" /></div>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="hero" onClick={() => setStep(3)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="border-4 border-foreground bg-background p-6 shadow-brutal space-y-4">
            <h2 className="font-display text-2xl">3. Your details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Company name *</Label><Input required value={contact.company_name} onChange={(e) => setContact((c) => ({ ...c, company_name: e.target.value }))} /></div>
              <div><Label>Your name *</Label><Input required value={contact.contact_name} onChange={(e) => setContact((c) => ({ ...c, contact_name: e.target.value }))} /></div>
              <div><Label>Work email *</Label><Input type="email" required value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /></div>
              <div><Label>Number of sites</Label><Input type="number" min={1} value={contact.site_count} onChange={(e) => setContact((c) => ({ ...c, site_count: Number(e.target.value) || 1 }))} /></div>
              <div>
                <Label>Preferred SLA</Label>
                <Select value={contact.sla_preference} onValueChange={(v) => setContact((c) => ({ ...c, sla_preference: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard — business hours</SelectItem>
                    <SelectItem value="priority">Priority — 8-hour fix</SelectItem>
                    <SelectItem value="enhanced">Enhanced — 24/7, 4-hour fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Anything else?</Label>
              <Textarea rows={3} value={contact.message} onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))} placeholder="Existing provider, timing, constraints…" />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox checked={contact.consent} onCheckedChange={(v) => setContact((c) => ({ ...c, consent: !!v }))} className="mt-0.5" />
              <span>I agree OCCTA can contact me about this quote. See our <a href="/privacy" className="underline">Privacy Policy</a>.</span>
            </label>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="hero" size="lg" onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Request quote"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
};

export default BusinessQuote;