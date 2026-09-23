import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
  Info,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { generateDDMandatePdf } from "@/lib/generateDDMandatePdf";

type DDMandateCustomerView = {
  id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  sort_code_masked?: string | null;
  account_number_masked?: string | null;
  consent_timestamp?: string | null;
  signature_name?: string | null;
  created_at: string | null;
};

/** Real timestamps only — never substitute "today" for a missing set-up date. */
export function formatSetupDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return format(d, "dd MMM yyyy");
}

const DD_GUARANTEE_TEXT = `This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.

If there are any changes to the amount, date or frequency of your Direct Debit, OCCTA Limited will notify you (normally 10 working days) in advance of your account being debited or as otherwise agreed. If you request OCCTA Limited to collect a payment, confirmation of the amount and date will be given to you at the time of the request.

If an error is made in the payment of your Direct Debit, by OCCTA Limited or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.

If you receive a refund you are not entitled to, you must pay it back when OCCTA Limited asks you to.

You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.`;

interface DirectDebitStatusProps {
  userId: string;
}

export function DirectDebitStatus({ userId }: DirectDebitStatusProps) {
  const [mandates, setMandates] = useState<DDMandateCustomerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchMandates();
  }, [userId]);

  const fetchMandates = async () => {
    setLoading(true);
    setFailed(false);

    // Primary source: the masked customer/admin view. It is explicitly
    // scoped to auth.uid() or staff roles and never exposes full bank details.
    try {
      const { data, error } = await supabase
        .from("dd_mandates_list")
        .select("id, status, mandate_reference, bank_last4, account_holder, sort_code_masked, account_number_masked, consent_timestamp, signature_name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMandates((data || []) as DDMandateCustomerView[]);
      setLoading(false);
      return;
    } catch {
      /* fall through to canonical overview */
    }

    // Fallback: the canonical auth-scoped overview RPC.
    try {
      const { data, error } = await supabase.rpc("get_my_customer_overview");
      if (error) throw error;
      const dd = (data as any)?.direct_debit;
      if (dd?.status) {
        setMandates([
          {
            id: "canonical-dd",
            status: String(dd.status),
            mandate_reference: null,
            bank_last4: dd.masked_account_last4 ?? null,
            account_holder: dd.account_holder_name ?? null,
            sort_code_masked: dd.masked_sort_last2 ? `**-**-${dd.masked_sort_last2}` : null,
            account_number_masked: dd.masked_account_last4 ? `****${dd.masked_account_last4}` : null,
            consent_timestamp: null,
            signature_name: null,
            created_at: dd.updated_at ?? null,
          },
        ]);
      } else {
        setMandates([]);
      }
    } catch {
      setMandates([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const openSignedMandate = (mandate: DDMandateCustomerView) => {
    generateDDMandatePdf({
      mandate_reference: mandate.mandate_reference || "—",
      status: mandate.status,
      account_holder: mandate.account_holder,
      sort_code_masked: mandate.sort_code_masked ?? null,
      account_number_masked: mandate.account_number_masked ?? null,
      bank_last4: mandate.bank_last4,
      consent_timestamp: mandate.consent_timestamp ?? null,
      signature_name: mandate.signature_name ?? null,
      created_at: mandate.created_at || new Date().toISOString(),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-primary border-2 border-foreground gap-1">
            <CheckCircle className="w-3 h-3" />
            Active
          </Badge>
        );
      case "pending":
      case "verified":
      case "details_received":
      case "awaiting_manual_submission":
      case "pending_contract":
      case "submitted_to_provider":
        return (
          <Badge className="bg-warning border-2 border-foreground gap-1">
            <Clock className="w-3 h-3" />
            {status === "pending" ? "Pending Verification" :
             status === "verified" ? "Verified" :
             status === "details_received" ? "Details Received" :
             status === "awaiting_manual_submission" ? "Signed — Awaiting Submission" :
             status === "pending_contract" ? "Pending Contract" : "Submitted to Provider"}
          </Badge>
        );
      case "action_required":
        return (
          <Badge className="bg-warning border-2 border-foreground gap-1">
            <Clock className="w-3 h-3" />
            Action Required
          </Badge>
        );
      case "cancelled":
      case "failed":
        return (
          <Badge className="bg-destructive border-2 border-foreground gap-1">
            <XCircle className="w-3 h-3" />
            {status === "cancelled" ? "Cancelled" : "Failed"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-2 border-foreground">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="card-brutal bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5" />
          <h3 className="font-display text-lg">DIRECT DEBIT</h3>
        </div>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // Filter to show only relevant mandates (not cancelled/failed unless recent)
  const activeMandates = mandates.filter(m =>
    ["active", "pending", "verified", "details_received", "awaiting_manual_submission", "pending_contract", "submitted_to_provider", "action_required"].includes(m.status)
  );
  const inactiveMandates = mandates.filter(m => ["cancelled", "failed", "rejected"].includes(m.status));

  return (
    <Card className="card-brutal bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          DIRECT DEBIT
        </h3>
        {activeMandates.length > 0 && (
          <Badge variant="outline" className="border-2 border-foreground">
            {activeMandates.length} active
          </Badge>
        )}
      </div>

      {failed ? (
        <div className="py-6 text-center" role="alert">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-3">
            We couldn't load your Direct Debit details just now.
          </p>
          <button
            type="button"
            onClick={fetchMandates}
            className="border-2 border-foreground px-3 py-1.5 text-xs font-display uppercase"
          >
            Try again
          </button>
        </div>
      ) : mandates.length === 0 ? (
        <div className="py-6 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No Direct Debit set up</p>
          <p className="text-xs text-muted-foreground">
            Contact us to set up automatic payments via Direct Debit
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeMandates.map((mandate) => (
            <div
              key={mandate.id}
              className="border-4 border-foreground p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(mandate.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ref: {mandate.mandate_reference || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Account Holder</p>
                  <p className="font-medium">{mandate.account_holder || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Bank Account</p>
                  <p className="font-mono">{mandate.account_number_masked || `****${mandate.bank_last4 || "****"}`}</p>
                </div>
                {formatSetupDate(mandate.created_at) && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Set Up</p>
                    <p>{formatSetupDate(mandate.created_at)}</p>
                  </div>
                )}
                {mandate.signature_name && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">E-signature</p>
                    <p className="font-serif italic">{mandate.signature_name}</p>
                  </div>
                )}
              </div>

              {(mandate.consent_timestamp || mandate.signature_name) && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 border-2 border-foreground gap-2"
                  onClick={() => openSignedMandate(mandate)}
                >
                  <FileText className="w-4 h-4" />
                  View / print signed mandate
                </Button>
              )}

              {["pending", "details_received", "awaiting_manual_submission", "submitted_to_provider", "action_required"].includes(mandate.status) && (
                <div className="mt-3 p-2 bg-warning/10 border-2 border-warning/50 text-sm">
                  <p className="flex items-center gap-2 text-warning-foreground">
                    <Clock className="w-4 h-4" />
                    {mandate.status === "awaiting_manual_submission"
                      ? "Your signed Direct Debit instruction has been received and is awaiting manual submission to our Direct Debit provider."
                      : mandate.status === "submitted_to_provider"
                        ? "Your Direct Debit instruction has been submitted to the provider and is being processed."
                        : mandate.status === "action_required"
                          ? "We need to check something before your Direct Debit can be completed. Please contact support if we have not already contacted you."
                          : "Your Direct Debit instruction has been received and is being checked."}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Direct Debit Guarantee */}
          <Accordion type="single" collapsible className="border-2 border-foreground">
            <AccordionItem value="guarantee" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="font-display text-sm">Direct Debit Guarantee</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="bg-muted p-3 rounded text-xs leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                  {DD_GUARANTEE_TEXT}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Your payments are protected by the Direct Debit Guarantee
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Inactive mandates (collapsed) */}
          {inactiveMandates.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="inactive" className="border-0">
                <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2">
                  Show {inactiveMandates.length} inactive mandate{inactiveMandates.length !== 1 ? "s" : ""}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {inactiveMandates.map((mandate) => (
                      <div
                        key={mandate.id}
                        className="border-2 border-foreground/20 p-3 opacity-60"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono">{mandate.mandate_reference || "—"}</span>
                          {getStatusBadge(mandate.status)}
                        </div>
                        {formatSetupDate(mandate.created_at) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatSetupDate(mandate.created_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </Card>
  );
}

export default DirectDebitStatus;
