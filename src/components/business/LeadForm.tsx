import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";

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
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    postcode: "",
    team_size: "",
    interest: interest ?? "",
    message: "",
    consent: false,
  });

  const update = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) {
      toast({ title: "Please accept the privacy notice.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-business-lead", {
      body: { ...form, source },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Something went wrong. Please try again.", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    onSuccess?.();
  };

  if (done) {
    return (
      <div className="border-4 border-foreground bg-secondary p-8 text-center shadow-brutal">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h3 className="font-display text-2xl mb-2">Got it — thanks!</h3>
        <p className="text-muted-foreground">A UK-based specialist will be in touch within 1 working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {heading && <h3 className="font-display text-2xl">{heading}</h3>}
      <div className={compact ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
        <div>
          <Label htmlFor="company_name">Company name *</Label>
          <Input id="company_name" required value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contact_name">Your name *</Label>
          <Input id="contact_name" required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Work email *</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="postcode">Site postcode</Label>
          <Input id="postcode" value={form.postcode} onChange={(e) => update("postcode", e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label htmlFor="team_size">Team size</Label>
          <Select value={form.team_size} onValueChange={(v) => update("team_size", v)}>
            <SelectTrigger id="team_size"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1-5">1–5</SelectItem>
              <SelectItem value="6-15">6–15</SelectItem>
              <SelectItem value="16-50">16–50</SelectItem>
              <SelectItem value="50+">50+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="interest">What are you interested in?</Label>
        <Select value={form.interest} onValueChange={(v) => update("interest", v)}>
          <SelectTrigger id="interest"><SelectValue placeholder="Broadband, VoIP, SIMs, bundle…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="broadband">Business broadband</SelectItem>
            <SelectItem value="voice">Hosted VoIP / SIP</SelectItem>
            <SelectItem value="sim">Business SIMs</SelectItem>
            <SelectItem value="bundle">Bundle (broadband + voice + SIM)</SelectItem>
            <SelectItem value="leased-line">Leased line</SelectItem>
            <SelectItem value="multi-site">Multi-site rollout</SelectItem>
            <SelectItem value="other">Something else</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="message">Tell us more (optional)</Label>
        <Textarea id="message" rows={3} value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="How many sites, current provider, when you'd like to switch…" />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox checked={form.consent} onCheckedChange={(v) => update("consent", !!v)} className="mt-0.5" />
        <span>I agree OCCTA can contact me about my enquiry. See our <a href="/privacy" className="underline">Privacy Policy</a>.</span>
      </label>
      <Button type="submit" variant="hero" size="lg" disabled={submitting} className="w-full">
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Talk to sales"}
      </Button>
    </form>
  );
};

export default LeadForm;