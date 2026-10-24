import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { getCampaignUtmForSubmit } from "@/lib/campaignAttribution";

/**
 * Letting-agent / landlord sign-up. Saved as a business lead
 * (interest "lettings_partner") so it reaches the existing sales inbox and admin list.
 */
export const PartnerEnquiryForm = () => {
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", postcode: "", properties: "", message: "" });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setError("Agency name, your name and email are required.");
      return;
    }
    if (!consent) {
      setError("Please confirm we can contact you about the partner programme.");
      return;
    }
    setSubmitting(true);
    const message = [
      form.properties.trim() ? `Lets / manages about ${form.properties.trim()} properties.` : "",
      form.message.trim(),
    ].filter(Boolean).join("\n\n");
    const { data, error: fnError } = await supabase.functions.invoke("submit-business-lead", {
      body: {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        postcode: form.postcode.trim().toUpperCase() || null,
        interest: "lettings_partner",
        message: message || null,
        source: "lettings_partner_programme",
        consent: true,
        utm: getCampaignUtmForSubmit(),
      },
    });
    setSubmitting(false);
    if (fnError || !(data as { ok?: boolean } | null)?.ok) {
      setError("Something went wrong sending that. Please try again, or call 0800 260 6626.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div role="status" className="border-4 border-foreground bg-secondary p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden="true" />
        <h3 className="mb-2 font-display text-2xl">Thanks — we'll be in touch.</h3>
        <p className="text-muted-foreground">We'll email your agency's link, QR code and flyer, usually within one working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-4 border-foreground bg-background p-6" noValidate>
      <h3 className="font-display text-2xl">Get your partner link</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="pe-company">Agency or business name *</Label>
          <Input id="pe-company" required autoComplete="organization" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pe-name">Your name *</Label>
          <Input id="pe-name" required autoComplete="name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pe-email">Work email *</Label>
          <Input id="pe-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pe-phone">Phone</Label>
          <Input id="pe-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pe-postcode">Office postcode</Label>
          <Input id="pe-postcode" autoComplete="postal-code" value={form.postcode} onChange={(e) => update("postcode", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pe-props">Properties you let or manage</Label>
          <Input id="pe-props" inputMode="numeric" placeholder="e.g. 120" value={form.properties} onChange={(e) => update("properties", e.target.value.replace(/[^0-9+]/g, "").slice(0, 6))} />
        </div>
      </div>
      <div>
        <Label htmlFor="pe-msg">Anything we should know?</Label>
        <Textarea id="pe-msg" rows={3} maxLength={1500} value={form.message} onChange={(e) => update("message", e.target.value)}
          placeholder="Student lets, HMOs, bills-included properties, how you onboard tenants…" />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
        <span>I agree OCCTA can contact me about the partner programme. See our <a className="underline" href="/privacy">privacy policy</a>.</span>
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button type="submit" variant="hero" size="lg" disabled={submitting} className="w-full">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Sending…</> : "Send my details"}
      </Button>
    </form>
  );
};

export default PartnerEnquiryForm;
