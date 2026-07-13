import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Building2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { DDMandateDetailDialog } from "./DDMandateDetailDialog";
import { DDWorkflowDialog } from "./DDWorkflowDialog";
import { generateDDMandatePdf } from "@/lib/generateDDMandatePdf";
import { DD_GUARANTEE_TEXT } from "@/lib/legal/directDebitGuarantee";
import { FileText, ShieldCheck, Unlock, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type DDMandateView = {
  id: string;
  user_id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  sort_code_masked: string | null;
  account_number_masked: string | null;
  has_bank_details: boolean;
  consent_timestamp: string | null;
  payment_request_id: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowAction = "verify" | "submit_to_provider" | "mark_active" | "mark_failed" | "cancel";

interface CustomerDDSectionProps {
  userId: string;
  accountNumber: string | null;
}

export function CustomerDDSection({ userId }: CustomerDDSectionProps) {
  const [selectedMandate, setSelectedMandate] = useState<DDMandateView | null>(null);
  const [workflowAction, setWorkflowAction] = useState<{ mandate: DDMandateView; action: WorkflowAction } | null>(null);
  const [showGuarantee, setShowGuarantee] = useState(false);
  const [revealFor, setRevealFor] = useState<DDMandateView | null>(null);
  const [revealReason, setRevealReason] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<{
    account_holder_name: string | null;
    sort_code: string | null;
    account_number: string | null;
    bank_name: string | null;
    billing_address: string | null;
    postcode: string | null;
  } | null>(null);

  const formatSort = (s: string | null) =>
    s && /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}` : (s ?? "—");

  const copy = async (label: string, val: string | null) => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable.", variant: "destructive" });
    }
  };

  const runReveal = async () => {
    if (!revealFor) return;
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-dd-reveal-bank", {
        body: {
          user_id: revealFor.user_id,
          mandate_id: revealFor.id,
          reason: revealReason || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error((data as { error?: string })?.error || "reveal_failed");
      setRevealed({
        account_holder_name: data.account_holder_name ?? null,
        sort_code: data.sort_code ?? null,
        account_number: data.account_number ?? null,
        bank_name: data.bank_name ?? null,
        billing_address: data.billing_address ?? null,
        postcode: data.postcode ?? null,
      });
    } catch (e) {
      toast({
        title: "Could not reveal bank details",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRevealing(false);
    }
  };

  const closeReveal = () => {
    setRevealFor(null);
    setRevealReason("");
    setRevealed(null);
  };

  const { data: mandates, isLoading, refetch } = useQuery({
    queryKey: ["customer-dd-mandates", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_mandates_list")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as DDMandateView[];
    },
  });

  // Load customer + billing context so we can populate the mandate PDF
  // (customer name/address + next collection date & amount).
  const { data: ctx } = useQuery({
    queryKey: ["customer-dd-context", userId],
    queryFn: async () => {
      const [{ data: profile }, { data: billing }, { data: cs }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, address_line1, city, postcode").eq("id", userId).maybeSingle(),
        supabase.from("billing_settings").select("next_invoice_date, payment_terms_days, billing_mode, billing_day").eq("user_id", userId).maybeSingle(),
        supabase.from("contract_summaries").select("cs_number, plan_name, monthly_price_incl_vat, contract_length").eq("customer_id", userId).eq("status", "accepted").order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { profile, billing, cs };
    },
  });

  const nextCollection = (() => {
    const nextInv = ctx?.billing?.next_invoice_date as string | undefined;
    const terms = (ctx?.billing?.payment_terms_days as number | undefined) ?? 14;
    if (!nextInv) return null;
    const d = new Date(nextInv);
    d.setDate(d.getDate() + terms);
    return d.toISOString().slice(0, 10);
  })();

  const nextAmount = (() => {
    const monthly = Number(ctx?.cs?.monthly_price_incl_vat ?? 0);
    if (!monthly) return null;
    // Quarterly cadence when payment_terms + monthly plan implies 3-month billing.
    // We infer 3× when billing_mode = fixed_day and there is a gap of ~3 months between invoices.
    // Safe default: show 3× for legacy quarterly (existing OCCTA policy).
    return Number((monthly * 3).toFixed(2));
  })();

  const openMandatePdf = (mandate: DDMandateView) => {
    const p = ctx?.profile as any;
    const address = p ? [p.address_line1, p.city, p.postcode].filter(Boolean).join(", ") : "";
    generateDDMandatePdf({
      mandate_reference: mandate.mandate_reference || "—",
      status: mandate.status,
      account_holder: mandate.account_holder,
      sort_code_masked: mandate.sort_code_masked,
      account_number_masked: mandate.account_number_masked,
      bank_last4: mandate.bank_last4,
      consent_timestamp: mandate.consent_timestamp,
      created_at: mandate.created_at,
      customer_name: p?.full_name ?? null,
      customer_email: p?.email ?? null,
      customer_address: address || null,
      next_collection_date: nextCollection,
      next_collection_amount: nextAmount,
      contract_reference: ctx?.cs?.cs_number ?? null,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; className: string }> = {
      pending: { icon: <Clock className="w-3 h-3" />, className: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
      verified: { icon: <CheckCircle className="w-3 h-3" />, className: "bg-blue-500/10 text-blue-600 border-blue-500" },
      submitted_to_provider: { icon: <ExternalLink className="w-3 h-3" />, className: "bg-purple-500/10 text-purple-600 border-purple-500" },
      active: { icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-500/10 text-green-600 border-green-500" },
      cancelled: { icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-600 border-red-500" },
      failed: { icon: <AlertCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-600 border-red-500" },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <Badge className={`${config.className} border gap-1`}>
        {config.icon}
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const openWorkflow = (mandate: DDMandateView, action: WorkflowAction) => {
    setWorkflowAction({ mandate, action });
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5" />
          <h3 className="font-display text-lg">Direct Debit</h3>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <h3 className="font-display text-lg">Direct Debit</h3>
          </div>
          {mandates && mandates.length > 0 && (
            <Badge variant="outline" className="border-2 border-foreground">
              {mandates.length} mandate{mandates.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {(!mandates || mandates.length === 0) ? (
          <div className="py-6 text-center text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No Direct Debit mandates</p>
            <p className="text-xs mt-1">Send a DD setup request to this customer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mandates.map((mandate) => (
              <div
                key={mandate.id}
                className="border-2 border-foreground/20 p-3 hover:border-foreground/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">
                        {mandate.mandate_reference || "—"}
                      </span>
                      {getStatusBadge(mandate.status)}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Account Holder:</span>
                        <p className="font-medium">{mandate.account_holder || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bank Account:</span>
                        <p className="font-mono">
                          {mandate.sort_code_masked || "—"} / {mandate.account_number_masked || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <p>{format(new Date(mandate.created_at), "dd MMM yyyy HH:mm")}</p>
                      </div>
                      {mandate.consent_timestamp && (
                        <div>
                          <span className="text-muted-foreground">Consented:</span>
                          <p>{format(new Date(mandate.consent_timestamp), "dd MMM yyyy HH:mm")}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMandate(mandate)}
                      className="gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMandatePdf(mandate)}
                      className="gap-1 border-2 border-foreground"
                    >
                      <FileText className="w-3 h-3" />
                      Mandate PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setRevealFor(mandate); setRevealed(null); setRevealReason(""); }}
                      className="gap-1 border-2 border-foreground"
                    >
                      <Unlock className="w-3 h-3" />
                      Reveal bank
                    </Button>
                  </div>
                </div>

                {/* Next collection summary */}
                {mandate.status !== "cancelled" && mandate.status !== "failed" && nextCollection && nextAmount && (
                  <div className="mt-3 border-2 border-foreground bg-foreground text-background p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-80">Next collection</p>
                      <p className="text-xs mt-1">
                        £{nextAmount.toFixed(2)} on {format(new Date(nextCollection), "dd MMM yyyy")}
                      </p>
                      <p className="text-[10px] opacity-70 mt-1">Advance notice sent 10 working days beforehand.</p>
                    </div>
                    {ctx?.cs?.cs_number && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest opacity-80">Contract</p>
                        <p className="text-xs font-mono mt-1">{ctx.cs.cs_number}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Workflow Actions */}
                {!["cancelled", "failed"].includes(mandate.status) && (
                  <div className="mt-3 pt-3 border-t border-foreground/10 flex flex-wrap gap-2">
                    {/* Verify: pending → verified */}
                    {mandate.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWorkflow(mandate, "verify")}
                        className="border-2 border-foreground text-xs gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Verify
                      </Button>
                    )}

                    {/* Submit to Provider: verified → submitted_to_provider */}
                    {mandate.status === "verified" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWorkflow(mandate, "submit_to_provider")}
                        className="border-2 border-foreground text-xs gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Submit to Provider
                      </Button>
                    )}

                    {/* Mark Active: submitted_to_provider → active */}
                    {mandate.status === "submitted_to_provider" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWorkflow(mandate, "mark_active")}
                          className="border-2 border-foreground text-xs gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Mark Active
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWorkflow(mandate, "mark_failed")}
                          className="border-2 border-destructive text-destructive text-xs gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Mark Failed
                        </Button>
                      </>
                    )}

                    {/* Cancel: any non-terminal status */}
                    {!["active", "cancelled", "failed"].includes(mandate.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openWorkflow(mandate, "cancel")}
                        className="text-destructive text-xs gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Cancel
                      </Button>
                    )}

                    {/* For active mandates, only allow cancel */}
                    {mandate.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openWorkflow(mandate, "cancel")}
                        className="text-destructive text-xs gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Cancel Mandate
                      </Button>
                    )}
                  </div>
                )}

                {/* Terminal status indicator */}
                {["cancelled", "failed"].includes(mandate.status) && (
                  <div className="mt-3 pt-3 border-t border-foreground/10">
                    <p className="text-xs text-muted-foreground italic">
                      This mandate is {mandate.status} and cannot be modified.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Direct Debit Guarantee panel */}
            <div className="border-2 border-foreground p-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setShowGuarantee((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-display uppercase text-sm">The Direct Debit Guarantee</span>
                </span>
                <span className="text-xs text-muted-foreground">{showGuarantee ? "Hide" : "Show"}</span>
              </button>
              {showGuarantee && (
                <div className="mt-3 space-y-2 text-xs leading-relaxed whitespace-pre-line">
                  {DD_GUARANTEE_TEXT}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* DD Detail Dialog */}
      {selectedMandate && (
        <DDMandateDetailDialog
          open={!!selectedMandate}
          onOpenChange={() => setSelectedMandate(null)}
          mandate={{
            id: selectedMandate.id,
            user_id: selectedMandate.user_id,
            status: selectedMandate.status,
            mandate_reference: selectedMandate.mandate_reference,
            bank_last4: selectedMandate.bank_last4,
            account_holder: selectedMandate.account_holder,
            consent_timestamp: selectedMandate.consent_timestamp,
            payment_request_id: selectedMandate.payment_request_id,
            created_at: selectedMandate.created_at,
            updated_at: selectedMandate.updated_at,
            has_bank_details: selectedMandate.has_bank_details,
            sort_code_masked: selectedMandate.sort_code_masked || undefined,
            account_number_masked: selectedMandate.account_number_masked || undefined,
          }}
          onUpdate={() => refetch()}
        />
      )}

      {/* Workflow Dialog */}
      {workflowAction && (
        <DDWorkflowDialog
          open={!!workflowAction}
          onOpenChange={() => setWorkflowAction(null)}
          mandateId={workflowAction.mandate.id}
          mandateRef={workflowAction.mandate.mandate_reference}
          currentStatus={workflowAction.mandate.status}
          action={workflowAction.action}
          onSuccess={() => refetch()}
        />
      )}

      {/* Reveal full bank details dialog (admin-only, audit-logged) */}
      <Dialog open={!!revealFor} onOpenChange={(o) => { if (!o) closeReveal(); }}>
        <DialogContent className="max-w-lg border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display uppercase flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              Reveal full bank details
            </DialogTitle>
            <DialogDescription>
              This action is admin-only and audit-logged. Only reveal to complete a
              legitimate operational task (e.g. Bacs submission, complaint handling).
            </DialogDescription>
          </DialogHeader>

          {!revealed ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Mandate: <span className="font-mono">{revealFor?.mandate_reference || "—"}</span>
                <br />
                Masked: {revealFor?.sort_code_masked || "—"} / {revealFor?.account_number_masked || "—"}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reveal-reason" className="text-xs uppercase tracking-widest">
                  Reason (recorded in audit log)
                </Label>
                <Input
                  id="reveal-reason"
                  value={revealReason}
                  onChange={(e) => setRevealReason(e.target.value)}
                  placeholder="e.g. Bacs submission for first collection"
                  className="border-2 border-foreground"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={closeReveal} disabled={revealing}>Cancel</Button>
                <Button
                  onClick={runReveal}
                  disabled={revealing || revealReason.trim().length < 4}
                  className="border-2 border-foreground"
                >
                  {revealing ? "Revealing…" : "Reveal"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-foreground p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase text-muted-foreground">Account holder</span>
                  <span className="font-medium">{revealed.account_holder_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase text-muted-foreground">Bank</span>
                  <span className="font-medium">{revealed.bank_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase text-muted-foreground">Sort code</span>
                  <span className="font-mono flex items-center gap-2">
                    {formatSort(revealed.sort_code)}
                    <Button size="sm" variant="ghost" className="h-6 px-2"
                      onClick={() => copy("Sort code", revealed.sort_code)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase text-muted-foreground">Account number</span>
                  <span className="font-mono flex items-center gap-2">
                    {revealed.account_number || "—"}
                    <Button size="sm" variant="ghost" className="h-6 px-2"
                      onClick={() => copy("Account number", revealed.account_number)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </span>
                </div>
                {revealed.billing_address && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs uppercase text-muted-foreground">Billing address</span>
                    <span className="text-right">{revealed.billing_address}</span>
                  </div>
                )}
                {revealed.postcode && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase text-muted-foreground">Postcode</span>
                    <span className="font-mono">{revealed.postcode}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Reveal recorded in audit log with your admin ID and reason. Close this
                dialog once you have finished using the details.
              </p>
              <DialogFooter>
                <Button onClick={closeReveal} className="border-2 border-foreground">Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CustomerDDSection;
