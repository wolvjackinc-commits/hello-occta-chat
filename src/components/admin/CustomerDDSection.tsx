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
                  </div>
                </div>

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
    </>
  );
}

export default CustomerDDSection;
