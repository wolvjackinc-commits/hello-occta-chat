import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractSummaryId: string | null;
}

export function CreateCSPaymentDialog({ open, onOpenChange, contractSummaryId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cs, setCs] = useState<any>(null);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [notes, setNotes] = useState("");
  const [overrideAmount, setOverrideAmount] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [result, setResult] = useState<{ url: string; number?: string; amount?: number } | null>(null);

  useEffect(() => {
    if (!open || !contractSummaryId) return;
    setResult(null);
    setNotes(""); setOverrideAmount(""); setOverrideReason("");
    (async () => {
      const { data } = await (supabase as any).from("contract_summaries")
        .select("id, cs_number, status, plan_name, monthly_price_incl_vat, business_monthly_incl_vat, setup_charge, router_charge, delivery_charge, installation_charge, customer_type, customer_email_snapshot, customer_name_snapshot, account_number")
        .eq("id", contractSummaryId).maybeSingle();
      setCs(data);
    })();
  }, [open, contractSummaryId]);

  const baseMonthly = cs ? Number((cs.customer_type === "business" && cs.business_monthly_incl_vat != null) ? cs.business_monthly_incl_vat : cs.monthly_price_incl_vat) || 0 : 0;
  const oneOff = cs ? Number(cs.setup_charge||0)+Number(cs.router_charge||0)+Number(cs.delivery_charge||0)+Number(cs.installation_charge||0) : 0;
  const computed = Math.round((baseMonthly + oneOff) * 100) / 100;

  const handleCreate = async () => {
    if (!contractSummaryId) return;
    setLoading(true);
    try {
      const body: any = { action: "create-cs-payment", contract_summary_id: contractSummaryId, expires_in_days: expiresInDays, notes: notes || undefined };
      if (overrideAmount.trim()) {
        body.amount_override = Number(overrideAmount);
        body.amount_override_reason = overrideReason;
      }
      const { data, error } = await supabase.functions.invoke("payment-request", { body });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      const origin = window.location.origin;
      setResult({ url: `${origin}${data.pay_url_path}`, number: data.payment_request?.payment_request_number, amount: data.payment_request?.amount });
      toast({ title: "Payment request created", description: data.payment_request?.payment_request_number });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader><DialogTitle>Create Payment Request</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!cs ? <div className="text-sm text-muted-foreground">Loading Contract Summary…</div> : cs.status !== "accepted" ? (
            <div className="border-4 border-destructive p-3 text-sm">CS status is <b>{cs.status}</b>. Only accepted CS can have a payment request.</div>
          ) : result ? (
            <div className="space-y-3">
              <div className="border-4 border-foreground p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Reference</span><span className="font-mono">{result.number}</span></div>
                <div className="flex justify-between"><span>Amount</span><span>£{Number(result.amount||0).toFixed(2)}</span></div>
              </div>
              <Label>Customer pay link</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.url} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(result.url); toast({ title: "Copied" }); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-2 border-foreground p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>CS</span><span className="font-mono">{cs.cs_number}</span></div>
                <div className="flex justify-between"><span>Customer</span><span>{cs.customer_name_snapshot}</span></div>
                <div className="flex justify-between"><span>Plan</span><span>{cs.plan_name}</span></div>
                <div className="flex justify-between"><span>Setup/Router/Delivery/Install</span><span>£{oneOff.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>First month (incl. VAT where applicable)</span><span>£{baseMonthly.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Computed total</span><span>£{computed.toFixed(2)}</span></div>
              </div>
              <div>
                <Label>Expires in (days)</Label>
                <Input type="number" min={1} max={60} value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value)||14)} />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
              </div>
              <details className="border-2 border-foreground p-2">
                <summary className="text-sm cursor-pointer">Amount override (admin only)</summary>
                <div className="space-y-2 pt-2">
                  <Input type="number" step="0.01" placeholder="Override amount in GBP" value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)} />
                  <Textarea placeholder="Reason (required if overriding)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                </div>
              </details>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!result && cs?.status === "accepted" && (
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create payment request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}