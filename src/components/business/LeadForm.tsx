declare global {
  interface Window { gtag?: (...args: any[]) => void; }
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  source?: string;
  interest?: string;
  compact?: boolean;
  heading?: string;
  onSuccess?: () => void;
};

export const LeadForm = ({ source = "business_hub", interest, compact = false, heading, onSuccess }: Props) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", email: "", phone: "", team_size: "", interest: interest ?? "", message: "", consent: false,
    secondary_contact_name: "", secondary_contact_email: "", secondary_contact_phone: "",
    billing_contact_name: "", billing_contact_email: "", billing_contact_phone: "",
    site_address_line1: "", site_address_line2: "", site_city: "", site_postcode: "",
    sla_preference: "standard",
  });

  const update = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const totalSteps = compact ? 1 : 3;

  const canAdvance = () => {
    if (compact) return true;
    if (step === 1) return Boolean(form.company_name.trim() && form.contact_name.trim() && form.email.trim());
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) {
      toast({ title: "Please accept the privacy notice.", variant: "destructive" });
      return;
    }
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      toast({ title: "Company, contact name and work email are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const payload = { ...form, postcode: form.site_postcode, source };
    const { data, error } = await supabase.functions.invoke("submit-business-lead", { body: payload });
    setSubmitting(false);
    if (error || !data?.ok) {
      toast({ title: "Something went wrong. Please try again.", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    window.gtag?.("event", "conversion", { send_to: "AW-18222446720/YOuSCLXKzMQcEIDxkfFD", value: 1.0, currency: "GBP" });
    setDone(true);
    onSuccess?.();
  };

  if (done) {
    return (
      <div className="border-4 border-foreground bg-secondary p-8 text-center shadow-brutal">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h3 className="font-display text-2xl mb-2">Enquiry received.</h3>
        <p className="text-muted-foreground">The business team can now review your requirement. For broadband pricing, use the business quote journey so the service address and supplier route can be qualified.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {heading && <h3 className="font-display text-2xl">{heading}</h3>}
      {!compact && (
        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map((n) => <div key={n} className={`h-1.5 flex-1 border-2 border-foreground ${n <= step ? "bg-primary" : "bg-background"}`} />)}
        </div>
      )}

      {(compact || step === 1) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor={`company-${source}`}>Company name *</Label><Input id={`company-${source}`} required value={form.company_name} onChange={(e) => update("company_name", e.target.value)} /></div>
            <div><Label htmlFor={`contact-${source}`}>Primary contact *</Label><Input id={`contact-${source}`} required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} /></div>
            <div><Label htmlFor={`email-${source}`}>Work email *</Label><Input id={`email-${source}`} type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div><Label htmlFor={`phone-${source}`}>Phone</Label><Input id={`phone-${source}`} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
            <div>
              <Label>Team size</Label>
              <Select value={form.team_size} onValueChange={(v) => update("team_size", v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="1-5">1–5</SelectItem><SelectItem value="6-15">6–15</SelectItem><SelectItem value="16-50">16–50</SelectItem><SelectItem value="50+">50+</SelectItem></SelectContent></Select>
            </div>
            <div>
              <Label>Interested in</Label>
              <Select value={form.interest} onValueChange={(v) => update("interest", v)}><SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger><SelectContent><SelectItem value="broadband">Business broadband</SelectItem><SelectItem value="voice">Hosted VoIP / SIP</SelectItem><SelectItem value="sim">Business SIMs</SelectItem><SelectItem value="bundle">Multi-service bundle</SelectItem><SelectItem value="leased-line">Dedicated / leased line</SelectItem><SelectItem value="multi-site">Multi-site rollout</SelectItem><SelectItem value="other">Something else</SelectItem></SelectContent></Select>
            </div>
          </div>
          {compact && <div><Label>Site postcode</Label><Input value={form.site_postcode} onChange={(e) => update("site_postcode", e.target.value.toUpperCase())} placeholder="Optional" /></div>}
        </>
      )}

      {!compact && step === 2 && (
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-3"><h4 className="font-display text-lg">Service site</h4><p className="text-xs text-muted-foreground">Useful for broadband qualification; the full business quote journey performs the live address check.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Address line 1</Label><Input value={form.site_address_line1} onChange={(e) => update("site_address_line1", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Address line 2</Label><Input value={form.site_address_line2} onChange={(e) => update("site_address_line2", e.target.value)} /></div>
            <div><Label>City / town</Label><Input value={form.site_city} onChange={(e) => update("site_city", e.target.value)} /></div>
            <div><Label>Postcode</Label><Input value={form.site_postcode} onChange={(e) => update("site_postcode", e.target.value.toUpperCase())} /></div>
          </div>
          <details className="border-2 border-foreground/30 p-3">
            <summary className="font-display cursor-pointer">Additional / billing contacts (optional)</summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div><Label>Secondary name</Label><Input value={form.secondary_contact_name} onChange={(e) => update("secondary_contact_name", e.target.value)} /></div>
              <div><Label>Secondary email</Label><Input type="email" value={form.secondary_contact_email} onChange={(e) => update("secondary_contact_email", e.target.value)} /></div>
              <div><Label>Secondary phone</Label><Input value={form.secondary_contact_phone} onChange={(e) => update("secondary_contact_phone", e.target.value)} /></div>
              <div><Label>Billing name</Label><Input value={form.billing_contact_name} onChange={(e) => update("billing_contact_name", e.target.value)} /></div>
              <div><Label>Billing email</Label><Input type="email" value={form.billing_contact_email} onChange={(e) => update("billing_contact_email", e.target.value)} /></div>
              <div><Label>Billing phone</Label><Input value={form.billing_contact_phone} onChange={(e) => update("billing_contact_phone", e.target.value)} /></div>
            </div>
          </details>
        </div>
      )}

      {!compact && step === 3 && (
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-3"><h4 className="font-display text-lg">Care & requirements</h4><p className="text-xs text-muted-foreground">Restoration targets vary by network. We confirm the exact target and charge in the quote.</p></div>
          <div>
            <Label>Care preference</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              {[
                { v: "standard", t: "Standard", d: "Default network care" },
                { v: "priority", t: "Enhanced", d: "Faster restoration option — target confirmed in quote" },
                { v: "enhanced", t: "Premium", d: "Fastest available care — target confirmed in quote" },
              ].map((o) => <button key={o.v} type="button" onClick={() => update("sla_preference", o.v)} className={`text-left border-4 p-3 transition ${form.sla_preference === o.v ? "border-foreground bg-primary text-primary-foreground" : "border-foreground/40 hover:border-foreground"}`}><div className="font-display">{o.t}</div><div className="text-xs opacity-80">{o.d}</div></button>)}
            </div>
          </div>
          <div><Label>Tell us more</Label><Textarea rows={3} value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Existing provider, contract end date, target go-live, sites, critical applications…" /></div>
        </div>
      )}

      {(compact || step === totalSteps) && <label className="flex items-start gap-2 text-sm text-muted-foreground"><Checkbox checked={form.consent} onCheckedChange={(v) => update("consent", !!v)} className="mt-0.5" /><span>I agree OCCTA can contact me about my enquiry. See our <a href="/privacy" className="underline">Privacy Policy</a>.</span></label>}

      <div className="flex gap-2">
        {!compact && step > 1 && <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>}
        {!compact && step < totalSteps && <Button type="button" variant="hero" className="flex-1" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>}
        {(compact || step === totalSteps) && <Button type="submit" variant="hero" size="lg" disabled={submitting} className="flex-1">{submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Talk to business sales"}</Button>}
      </div>
    </form>
  );
};

export default LeadForm;