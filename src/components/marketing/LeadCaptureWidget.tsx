import { useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

type Interest = "broadband" | "sim" | "router" | "landline" | "business" | "other";

interface Props {
  title?: string;
  description?: string;
  defaultInterest?: Interest;
  source?: string;
  compact?: boolean;
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export default function LeadCaptureWidget({
  title = "Not sure what you need? We'll help.",
  description = "Drop your postcode and what you're after — we'll come back within one business day with the best options at your address.",
  defaultInterest,
  source = "web",
  compact = false,
}: Props) {
  const { toast } = useToast();
  const loc = useLocation();
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState<Interest | "">(defaultInterest ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast({ title: "Name required", variant: "destructive" });
    if (!UK_POSTCODE.test(postcode.trim())) return toast({ title: "Enter a valid UK postcode", variant: "destructive" });
    if (!interest) return toast({ title: "Choose what you're interested in", variant: "destructive" });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast({ title: "Enter a valid email", variant: "destructive" });

    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-marketing-lead", {
      body: {
        name: name.trim(),
        postcode: postcode.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        interest,
        message: message.trim() || null,
        source,
        page_path: loc.pathname + loc.search,
      },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Something went wrong", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "Thanks — we'll be in touch", description: "One of the team will reach out shortly." });
  };

  if (done) {
    return (
      <div className="border-4 border-foreground bg-card p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
        <h3 className="font-display uppercase text-xl mb-1">Got it, {name.split(" ")[0]}</h3>
        <p className="text-sm text-muted-foreground">
          We'll email or ring you within one working day about {interest} options at <span className="font-medium">{postcode.toUpperCase()}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-4 border-foreground bg-card p-5 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 bg-primary text-primary-foreground flex items-center justify-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display uppercase text-lg md:text-xl">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <Label htmlFor="lcw-name" className="text-xs font-display uppercase">Your name</Label>
          <Input id="lcw-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
        </div>
        <div>
          <Label htmlFor="lcw-postcode" className="text-xs font-display uppercase">Postcode</Label>
          <Input id="lcw-postcode" required value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SW1A 1AA" autoComplete="postal-code" />
        </div>
        <div>
          <Label htmlFor="lcw-email" className="text-xs font-display uppercase">Email (optional)</Label>
          <Input id="lcw-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="lcw-phone" className="text-xs font-display uppercase">Phone (optional)</Label>
          <Input id="lcw-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" autoComplete="tel" />
        </div>
      </div>

      <div>
        <Label className="text-xs font-display uppercase">What are you after?</Label>
        <Select value={interest} onValueChange={(v) => setInterest(v as Interest)}>
          <SelectTrigger><SelectValue placeholder="Pick one…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="broadband">Home broadband</SelectItem>
            <SelectItem value="sim">SIM / mobile plan</SelectItem>
            <SelectItem value="router">Router / Wi-Fi setup</SelectItem>
            <SelectItem value="landline">Digital home phone</SelectItem>
            <SelectItem value="business">Business services</SelectItem>
            <SelectItem value="other">Something else</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!compact && (
        <div>
          <Label htmlFor="lcw-msg" className="text-xs font-display uppercase">Anything we should know? (optional)</Label>
          <Textarea id="lcw-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. moving in on the 1st, need static IP, etc." />
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full font-display uppercase">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Get my recommendations"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        We only use your details to help with your enquiry. See our <a href="/privacy-policy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}