import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logClientEvent } from "@/lib/activityLog";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Loader2 } from "lucide-react";

const SERVICE_INTERESTS = [
  { value: "broadband", label: "Broadband" },
  { value: "sim", label: "SIM plan" },
  { value: "digital_voice", label: "Digital Home Phone" },
  { value: "business", label: "Business telecom" },
  { value: "switching", label: "Switching provider" },
  { value: "bundle", label: "Bundle (broadband + voice / SIM)" },
  { value: "other", label: "Not sure / something else" },
] as const;

const PLAN_PREFS = [
  { value: "flex", label: "Flex (30-day rolling)" },
  { value: "contract_saver", label: "Contract Saver" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

const schema = z.object({
  service_interest: z.enum(["broadband","sim","digital_voice","business","switching","bundle","other"]),
  plan_preference: z.enum(["flex","contract_saver","not_sure"]),
  customer_type: z.enum(["residential","business"]),
  business_name: z.string().trim().max(160).optional(),
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(180),
  phone: z.string().trim().min(7, "Enter a valid phone").max(30),
  postcode: z.string().trim().min(5, "Enter your postcode").max(10),
  address_line_1: z.string().trim().max(160).optional(),
  address_line_2: z.string().trim().max(160).optional(),
  town: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  preferred_contact_method: z.enum(["email","phone","whatsapp"]),
  current_provider: z.string().trim().max(120).optional(),
  current_monthly_bill: z.string().trim().max(10).optional(),
  message: z.string().trim().max(1000).optional(),
  marketing_consent: z.boolean(),
  privacy_ack: z.literal(true, { errorMap: () => ({ message: "Please acknowledge our Privacy Policy" }) }),
}).superRefine((val, ctx) => {
  if (val.customer_type === "business" && (!val.business_name || val.business_name.length < 2)) {
    ctx.addIssue({ code: "custom", path: ["business_name"], message: "Business name is required" });
  }
});

type FormState = z.input<typeof schema>;

export default function QuoteStart() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = usePlatformSettings();

  const initialInterest = useMemo(() => {
    const raw = params.get("interest");
    const map: Record<string, FormState["service_interest"]> = {
      broadband: "broadband", broadband_flex: "broadband", broadband_contract_saver: "broadband",
      sim: "sim", voice: "digital_voice", digital_voice: "digital_voice",
      business: "business", switch: "switching", switching: "switching",
      bundle: "bundle", rewards: "other",
    };
    return (raw && map[raw]) || "broadband";
  }, [params]);

  const [form, setForm] = useState<FormState>({
    service_interest: initialInterest,
    plan_preference: "not_sure",
    customer_type: "residential",
    business_name: "",
    full_name: "",
    email: "",
    phone: "",
    postcode: "",
    address_line_1: "",
    address_line_2: "",
    town: "",
    county: "",
    preferred_contact_method: "email",
    current_provider: "",
    current_monthly_bill: "",
    message: "",
    marketing_consent: false,
    privacy_ack: false as unknown as true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logClientEvent({
      event_type: "quote_start",
      title: "Quote start opened",
      source_module: "quote",
      details: { interest: initialInterest },
    });
  }, [initialInterest]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.errors.forEach((er) => { if (er.path[0]) next[String(er.path[0])] = er.message; });
      setErrors(next);
      toast({ title: "Please check the form", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...parsed.data,
        business_name: parsed.data.business_name || null,
        address_line_1: parsed.data.address_line_1 || null,
        address_line_2: parsed.data.address_line_2 || null,
        town: parsed.data.town || null,
        county: parsed.data.county || null,
        current_provider: parsed.data.current_provider || null,
        current_monthly_bill: parsed.data.current_monthly_bill
          ? Number(parsed.data.current_monthly_bill) : null,
        message: parsed.data.message || null,
      };
      // Strip privacy_ack — server doesn't accept it
      delete (body as any).privacy_ack;

      const { data, error } = await supabase.functions.invoke("submit-quote-request", { body });
      if (error || !data || (data as any).error) {
        throw new Error((data as any)?.error || error?.message || "submit_failed");
      }
      const reference = (data as any).reference as string;
      logClientEvent({
        event_type: "form_submit",
        title: "Quote request submitted",
        source_module: "quote",
        details: { interest: parsed.data.service_interest, customer_type: parsed.data.customer_type },
      });
      navigate(`/quote/thank-you?ref=${encodeURIComponent(reference)}`);
    } catch (err) {
      toast({
        title: "Couldn't send your quote request",
        description: "Please try again or call us. Your details were not stored.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isBusiness = form.customer_type === "business";

  return (
    <Layout>
      <SEO
        title="Request a quote — OCCTA"
        description="Tell us what you need and we'll prepare a confirmed quote and Contract Summary before you pay. No commitment until you accept your Contract Summary."
        canonical="/quote/start"
      />
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Quote request
        </p>
        <h1 className="font-display uppercase text-3xl md:text-5xl leading-[0.95] tracking-tight mb-4">
          Let's get you a <span className="text-primary">proper quote.</span>
        </h1>
        <p className="text-base text-muted-foreground mb-6">{settings.manual_mode_message}</p>
        <p className="text-sm text-muted-foreground mb-8">
          Final price, contract length, one-off charges, speed estimate and key terms will be confirmed
          in your Contract Summary before you pay.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 border-4 border-foreground p-6">
          {/* Service */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Service interest</Label>
              <Select value={form.service_interest} onValueChange={(v) => set("service_interest", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_INTERESTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.service_interest === "broadband" || form.service_interest === "bundle") && (
              <div>
                <Label className="text-sm">Plan preference</Label>
                <Select value={form.plan_preference} onValueChange={(v) => set("plan_preference", v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_PREFS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Customer type */}
          <div>
            <Label className="text-sm">This quote is for</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {(["residential","business"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("customer_type", t)}
                  className={`border-2 p-3 text-sm font-display uppercase tracking-wider ${form.customer_type === t ? "border-primary bg-primary/10" : "border-foreground/30"}`}>
                  {t === "residential" ? "Residential" : "Business"}
                </button>
              ))}
            </div>
          </div>

          {isBusiness && (
            <div>
              <Label className="text-sm">Business name</Label>
              <Input value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} className="mt-1" />
              {errors.business_name && <p className="text-xs text-destructive mt-1">{errors.business_name}</p>}
            </div>
          )}

          {/* Address */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Postcode *</Label>
              <Input value={form.postcode} onChange={(e) => set("postcode", e.target.value.toUpperCase())} className="mt-1 font-mono" maxLength={10} />
              {errors.postcode && <p className="text-xs text-destructive mt-1">{errors.postcode}</p>}
            </div>
            <div>
              <Label className="text-sm">Town / city</Label>
              <Input value={form.town ?? ""} onChange={(e) => set("town", e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Address line 1</Label>
              <Input value={form.address_line_1 ?? ""} onChange={(e) => set("address_line_1", e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Address line 2</Label>
              <Input value={form.address_line_2 ?? ""} onChange={(e) => set("address_line_2", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">County</Label>
              <Input value={form.county ?? ""} onChange={(e) => set("county", e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Full name *</Label>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="mt-1" />
              {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <Label className="text-sm">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label className="text-sm">Phone *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1" />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label className="text-sm">Preferred contact</Label>
              <Select value={form.preferred_contact_method} onValueChange={(v) => set("preferred_contact_method", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Switching helpers */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Current provider (optional)</Label>
              <Input value={form.current_provider ?? ""} onChange={(e) => set("current_provider", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Current monthly bill £ (optional)</Label>
              <Input value={form.current_monthly_bill ?? ""} onChange={(e) => set("current_monthly_bill", e.target.value)} className="mt-1" inputMode="decimal" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Anything else we should know?</Label>
            <Textarea value={form.message ?? ""} onChange={(e) => set("message", e.target.value.slice(0, 1000))} className="mt-1" rows={4} />
            <p className="text-xs text-muted-foreground mt-1">{(form.message ?? "").length}/1000</p>
          </div>

          {/* Consent */}
          <div className="space-y-3 border-t-2 border-foreground/20 pt-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={form.marketing_consent} onCheckedChange={(v) => set("marketing_consent", !!v)} />
              <span className="text-muted-foreground">
                I'm happy to receive occasional OCCTA updates and offers. Unsubscribe anytime.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={!!form.privacy_ack} onCheckedChange={(v) => set("privacy_ack", (!!v) as unknown as true)} />
              <span>
                I've read the <Link to="/privacy" className="underline">Privacy Policy</Link> and agree to OCCTA
                contacting me about this quote. *
              </span>
            </label>
            {errors.privacy_ack && <p className="text-xs text-destructive">{errors.privacy_ack}</p>}
          </div>

          <Button type="submit" variant="hero" className="w-full font-display uppercase" disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Request my quote"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No payment is taken now. You'll review and accept a Contract Summary before paying anything.
          </p>
        </form>
      </section>
    </Layout>
  );
}