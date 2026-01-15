import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const AdminPaymentsDD = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [attemptForm, setAttemptForm] = useState({
    userId: "",
    invoiceId: "",
    provider: "GoCardless",
    status: "failed",
    amount: "",
    reason: "",
  });

  const { data, refetch } = useQuery({
    queryKey: ["admin-payments-dd"],
    queryFn: async () => {
      const [mandates, attempts] = await Promise.all([
        supabase.from("dd_mandates").select("*").order("created_at", { ascending: false }),
        supabase.from("payment_attempts").select("*").order("created_at", { ascending: false }),
      ]);
      return { mandates: mandates.data ?? [], attempts: attempts.data ?? [] };
    },
  });

  const declineRate = data?.attempts.length
    ? Math.round(
        (data.attempts.filter((attempt) => attempt.status === "failed").length / data.attempts.length) * 100
      )
    : 0;
  const failedAttempts = data?.attempts.filter((attempt) => attempt.status === "failed") ?? [];
  const retryCount = failedAttempts.reduce((count, attempt) => {
    if (!attempt.invoice_id) return count;
    return count + 1;
  }, 0);

  const handleAddAttempt = async () => {
    const { error } = await supabase.from("payment_attempts").insert({
      user_id: attemptForm.userId,
      invoice_id: attemptForm.invoiceId || null,
      provider: attemptForm.provider,
      status: attemptForm.status,
      amount: Number(attemptForm.amount || 0),
      reason: attemptForm.reason,
    });
    if (error) {
      toast({ title: "Failed to add attempt", variant: "destructive" });
      return;
    }
    toast({ title: "Payment attempt logged" });
    setOpen(false);
    setAttemptForm({
      userId: "",
      invoiceId: "",
      provider: "GoCardless",
      status: "failed",
      amount: "",
      reason: "",
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Payments & Direct Debit</h1>
          <p className="text-muted-foreground">Track mandates and payment attempt decline rates.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Log payment attempt</Button>
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="text-xs uppercase text-muted-foreground">Decline rate</div>
        <div className="text-3xl font-display">{declineRate}%</div>
        <div className="text-sm text-muted-foreground">
          Failed attempts: {failedAttempts.length} · Retries: {retryCount}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Mandates</h2>
          <div className="space-y-3">
            {data?.mandates.map((mandate) => (
              <div key={mandate.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{mandate.status}</div>
                <div className="text-xs text-muted-foreground">Ref: {mandate.mandate_reference}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Payment attempts</h2>
          <div className="space-y-3">
            {data?.attempts.map((attempt) => (
              <div key={attempt.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{attempt.status}</div>
                <div className="text-xs text-muted-foreground">{attempt.provider} · £{attempt.amount}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log payment attempt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Customer user ID"
              value={attemptForm.userId}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, userId: event.target.value }))}
            />
            <Input
              placeholder="Invoice ID (optional)"
              value={attemptForm.invoiceId}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
            />
            <Input
              placeholder="Provider"
              value={attemptForm.provider}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, provider: event.target.value }))}
            />
            <Input
              placeholder="Status"
              value={attemptForm.status}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, status: event.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={attemptForm.amount}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <Input
              placeholder="Reason"
              value={attemptForm.reason}
              onChange={(event) => setAttemptForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAttempt}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
