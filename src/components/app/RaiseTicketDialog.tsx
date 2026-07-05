import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/logger";

const schema = z.object({
  category: z.string().min(1, "Choose a category"),
  subject: z.string().min(5, "Subject too short").max(120, "Subject too long"),
  message: z.string().min(20, "Please add more detail (20+ chars)").max(2000, "Too long"),
});

const CATEGORIES = [
  { value: "broadband", label: "Broadband" },
  { value: "mobile", label: "Mobile / SIM" },
  { value: "landline", label: "Home Phone" },
  { value: "billing", label: "Billing" },
  { value: "payments", label: "Payments" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onSubmitted?: () => void };

export function RaiseTicketDialog({ open, onOpenChange, onSubmitted }: Props) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setCategory(""); setSubject(""); setMessage(""); setErrors({}); setSuccess(null);
  };

  const submit = async () => {
    const parsed = schema.safeParse({ category, subject, message });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to raise a ticket.");
        setSubmitting(false);
        return;
      }
      const { data: profileData } = await supabase
        .from("customer_profile" as any)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const profile = (profileData as any) ?? {};

      const { data, error } = await supabase.functions.invoke("submit-support-ticket", {
        body: {
          name: profile.full_name || user.email,
          email: profile.email || user.email,
          phone: profile.phone || null,
          category,
          priority: "normal",
          subject: subject.trim(),
          message: message.trim(),
        },
      });
      const payload = data as { ok?: boolean; ticket_id?: string; error?: string } | null;
      if (error || !payload?.ok) throw new Error(payload?.error || error?.message || "submit_failed");

      setSuccess(payload.ticket_id ? payload.ticket_id.slice(0, 8).toUpperCase() : "sent");
      toast.success("Ticket raised — we'll reply within 24 hours");
      onSubmitted?.();
    } catch (err) {
      logError("RaiseTicketDialog.submit", err);
      toast.error("Couldn't raise ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise a support ticket</DialogTitle>
          <DialogDescription>
            Our team replies within 24 hours. For instant help, try the AI assistant first.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold mb-1">Ticket received</p>
            <p className="text-sm text-muted-foreground mb-1">Reference: <span className="font-mono">{success}</span></p>
            <p className="text-xs text-muted-foreground">We've emailed a confirmation and our team will be in touch.</p>
            <Button className="mt-5 w-full" onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ticket-cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ticket-cat" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" maxLength={120} aria-invalid={!!errors.subject} />
              {errors.subject && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.subject}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ticket-msg">Describe your issue</Label>
              <Textarea id="ticket-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="What's going wrong? Include any error messages, dates, or affected services." maxLength={2000} aria-invalid={!!errors.message} />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
              {errors.message && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.message}</p>}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send ticket"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}