import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Props = { userId: string; serviceId: string };

function gbp(minor?: number | null) {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

export function CancellationRequestCard({ userId, serviceId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: openCase } = useQuery({
    queryKey: ["cancellation-case", serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_cancellation_cases" as any)
        .select("id, status, proposed_cease_date, customer_preview, requested_date, created_at")
        .eq("service_id", serviceId)
        .not("status", "in", "(completed,withdrawn,rejected)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  async function submit() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("service-cancellation", {
        body: { action: "request", service_id: serviceId, reason_code: reason || null, notes: notes || null },
      });
      if (error) throw error;
      // immediately compute preview for visibility
      if ((data as any)?.case_id) {
        await supabase.functions.invoke("service-cancellation", {
          body: { action: "preview", case_id: (data as any).case_id },
        });
      }
      toast({ title: "Cancellation request received", description: "We'll review your agreement and confirm the proposed cease date and final balance." });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["cancellation-case", serviceId] });
    } catch (e: any) {
      toast({ title: "Could not submit request", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function withdraw() {
    if (!openCase?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("service-cancellation", {
        body: { action: "withdraw", case_id: openCase.id, reason: "customer_withdrew" },
      });
      if (error) throw error;
      toast({ title: "Cancellation withdrawn" });
      qc.invalidateQueries({ queryKey: ["cancellation-case", serviceId] });
    } catch (e: any) {
      toast({ title: "Could not withdraw", description: e?.message ?? "Please contact support.", variant: "destructive" });
    } finally { setBusy(false); }
  }

  const preview = (openCase as any)?.customer_preview ?? null;

  return (
    <Card className="p-4 border-2 border-foreground rounded-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display uppercase text-sm">Cancel this service</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Your service will not stop immediately. We'll review your agreement, confirm any notice
            period or early termination charge, and provide the proposed cease date and final balance
            before completing the cancellation.
          </p>
        </div>
        {!openCase ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-none border-2 border-foreground">Request cancellation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request cancellation</DialogTitle>
                <DialogDescription>
                  We'll calculate the proposed cease date, notice period and any final balance, then a member of our team will confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Reason (optional)</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 80))} placeholder="e.g. moving home" />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1000))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Close</Button>
                <Button onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Badge variant="secondary" className="rounded-none">{openCase.status.replace(/_/g, " ")}</Badge>
        )}
      </div>

      {openCase && (
        <div className="mt-4 border-t-2 border-foreground/20 pt-4 text-sm space-y-1">
          <div>Requested: {new Date(openCase.created_at).toLocaleDateString("en-GB")}</div>
          {preview && (
            <>
              <div>Proposed cease date: <strong>{preview.proposed_cease_date ?? "—"}</strong></div>
              <div>Notice period: {preview.notice_period_days ?? "—"} days</div>
              <div>Estimated service charges: {gbp(preview.unbilled_service_minor)}</div>
              <div>Unpaid invoices: {gbp(preview.unpaid_invoices_minor)}</div>
              {preview.etf_minor != null && <div>Estimated early termination charge: {gbp(preview.etf_minor)}</div>}
              <div>Credits: {gbp(preview.credits_minor)}</div>
              <div className="font-display">Estimated final balance: {gbp(preview.final_balance_minor)}</div>
              <p className="text-xs text-muted-foreground mt-2">Final figures remain subject to confirmation by our team.</p>
            </>
          )}
          {!["cease_committed", "completed", "submitted_to_giacom"].includes(openCase.status) && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={withdraw} disabled={busy} className="rounded-none border-2 border-foreground">
                {busy ? "…" : "Withdraw request"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}