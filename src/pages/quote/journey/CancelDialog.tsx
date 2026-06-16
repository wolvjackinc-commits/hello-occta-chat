import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const REASONS: { code: string; label: string }[] = [
  { code: "changed_mind", label: "Changed my mind" },
  { code: "too_expensive", label: "Too expensive" },
  { code: "found_alternative", label: "Found an alternative" },
  { code: "speed_too_slow", label: "Speed too slow" },
  { code: "address_not_ready", label: "Address / installation not ready" },
  { code: "contract_concerns", label: "Concerns about the contract" },
  { code: "no_longer_needed", label: "No longer needed" },
  { code: "other", label: "Other" },
];

const CONFIRM_TEXT =
  "I confirm I want to cancel my OCCTA order during my 14-day cooling-off period.";

/**
 * Two-step cancellation dialog.
 *   Step 1 — request → server returns single-use confirmation token (held in
 *            React state only, never stored in localStorage/sessionStorage).
 *   Step 2 — confirm with reason + unticked consent checkbox.
 */
export default function CancelDialog({
  open,
  onOpenChange,
  token,
  endsAt,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  endsAt: string | null;
  onCancelled: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [cancellationToken, setCancellationToken] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);

  const reset = () => {
    setStep(1);
    setCancellationToken(null);
    setReason("");
    setNotes("");
    setConfirmed(false);
    setLoading(false);
  };

  const handleClose = (v: boolean) => {
    if (loading) return;
    if (!v) reset();
    onOpenChange(v);
  };

  const startRequest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-cancel-request", {
        body: { token },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't start cancellation",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        setCancellationToken((data as any).cancellation_token);
        setStep(2);
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!cancellationToken || !reason || !confirmed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-cancel-confirm", {
        body: {
          token,
          cancellation_token: cancellationToken,
          reason_code: reason,
          reason_text: notes.trim() || null,
          confirm_text: CONFIRM_TEXT,
        },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Cancellation failed",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Order cancelled", description: "We've recorded your cancellation and emailed you a copy." });
        // Wipe the held cancellation token from memory immediately.
        setCancellationToken(null);
        onCancelled();
        handleClose(false);
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const endsLondon = endsAt
    ? new Date(endsAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" })
    : "—";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-4 border-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Cancel your OCCTA order
          </DialogTitle>
          <DialogDescription>
            You can cancel this agreement during your 14-day cooling-off period, which ends on <strong>{endsLondon}</strong>.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3 text-sm">
            <p>We'll send a single-use confirmation step next. No charges have been taken yet, and cancelling won't affect any other OCCTA account you might have.</p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>Keep order</Button>
              <Button variant="destructive" onClick={startRequest} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> : "Continue to cancel"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="block font-display uppercase text-xs mb-1">Reason</span>
              <select
                className="w-full border-2 border-foreground bg-background p-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block font-display uppercase text-xs mb-1">Notes (optional)</span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Tell us anything that would help us improve."
                className="border-2 border-foreground"
              />
            </label>

            <label className="flex items-start gap-2 border-l-4 border-destructive pl-3 py-2">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
              <span>{CONFIRM_TEXT}</span>
            </label>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>Keep order</Button>
              <Button variant="destructive" onClick={confirm} disabled={loading || !reason || !confirmed}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : "Confirm cancellation"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
