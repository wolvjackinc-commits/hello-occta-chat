import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { v: "billing", l: "Billing" },
  { v: "service_quality", l: "Service quality" },
  { v: "switching", l: "Switching" },
  { v: "cancellation", l: "Cancellation" },
  { v: "digital_voice", l: "Digital Voice" },
  { v: "sales", l: "Sales" },
  { v: "complaint_handling", l: "Complaint handling" },
  { v: "accessibility", l: "Accessibility" },
  { v: "other", l: "Other" },
];

export function ComplaintForm({ onSubmitted, showContact = false }: { onSubmitted?: (ref: string) => void; showContact?: boolean }) {
  const { toast } = useToast();
  const [category, setCategory] = useState("billing");
  const [summary, setSummary] = useState("");
  const [desired, setDesired] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);

  const submit = async () => {
    if (summary.trim().length < 5) {
      toast({ title: "Please give a short summary", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-complaint", {
      body: { category, summary, desired_outcome: desired, contact_email: email, contact_phone: phone },
    });
    setSubmitting(false);
    const payload = data as { ok?: boolean; reference?: string; error?: string } | null;
    if (error || !payload?.ok) {
      toast({ title: "Couldn't submit", description: payload?.error || error?.message, variant: "destructive" });
      return;
    }
    setRef(payload.reference ?? null);
    if (payload.reference) onSubmitted?.(payload.reference);
    toast({ title: "Complaint received", description: `Reference: ${payload.reference}` });
  };

  if (ref) {
    return (
      <div className="p-4 border-4 border-foreground bg-secondary/30">
        <p className="font-display uppercase">Thanks — we've logged your complaint</p>
        <p className="text-sm mt-1">Reference: <span className="font-mono">{ref}</span></p>
        <p className="text-xs text-muted-foreground mt-2">
          We'll acknowledge within 2 working days. If we cannot resolve within 6 weeks, or we issue a deadlock letter earlier, you may refer to our ADR provider.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs uppercase">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase">What happened</Label>
        <Textarea rows={4} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} className="border-2 border-foreground" placeholder="Tell us briefly what went wrong and when." />
      </div>
      <div>
        <Label className="text-xs uppercase">What would put it right</Label>
        <Textarea rows={2} maxLength={2000} value={desired} onChange={(e) => setDesired(e.target.value)} className="border-2 border-foreground" placeholder="e.g. refund, apology, fix, callback" />
      </div>
      {showContact && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-2 border-foreground" />
          <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="border-2 border-foreground" />
        </div>
      )}
      <Button variant="hero" onClick={submit} disabled={submitting}>{submitting ? "Sending…" : "Submit complaint"}</Button>
      <p className="text-[11px] text-muted-foreground">Please don't include card, bank or sensitive medical details.</p>
    </div>
  );
}