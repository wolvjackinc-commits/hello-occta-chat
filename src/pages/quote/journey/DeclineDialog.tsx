import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASONS: { code: string; label: string }[] = [
  { code: "too_expensive", label: "Price is too high" },
  { code: "found_alternative", label: "Going with another provider" },
  { code: "speed_too_slow", label: "Speed isn't what I need" },
  { code: "address_not_ready", label: "Address/timing not right" },
  { code: "contract_concerns", label: "Concerns about contract terms" },
  { code: "changed_mind", label: "Just changed my mind" },
  { code: "no_longer_needed", label: "No longer need broadband" },
  { code: "other", label: "Other (please explain)" },
];

export default function DeclineDialog({
  open, onOpenChange, onConfirm, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason_code: string, reason_text: string) => Promise<void> | void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const disabled = !reason || submitting || (reason === "other" && notes.trim().length < 3);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Decline this quote</DialogTitle>
          <DialogDescription>
            No payment has been taken. Letting us know why helps us improve — it takes a few seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="font-display uppercase text-xs mb-2 block">Reason</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <label key={r.code} className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value={r.code} id={`reason-${r.code}`} />
                  <span>{r.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="decline-notes" className="font-display uppercase text-xs mb-2 block">
              Anything else? {reason === "other" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="decline-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Optional feedback"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Keep quote</Button>
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={() => onConfirm(reason, notes.trim())}
            className="font-display uppercase"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
