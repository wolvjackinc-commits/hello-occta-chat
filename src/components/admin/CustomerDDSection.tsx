import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { format } from "date-fns";
import {
  Building2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DDMandateDetailDialog } from "./DDMandateDetailDialog";

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

interface CustomerDDSectionProps {
  userId: string;
  accountNumber: string | null;
}

export function CustomerDDSection({ userId, accountNumber }: CustomerDDSectionProps) {
  const { toast } = useToast();
  const [selectedMandate, setSelectedMandate] = useState<DDMandateView | null>(null);
  const [statusAction, setStatusAction] = useState<{ mandate: DDMandateView; newStatus: string } | null>(null);
  const [updating, setUpdating] = useState(false);

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

  const handleStatusUpdate = async () => {
    if (!statusAction) return;
    
    setUpdating(true);
    try {
      const { mandate, newStatus } = statusAction;
      
      const { error } = await supabase
        .from("dd_mandates")
        .update({ status: newStatus })
        .eq("id", mandate.id);

      if (error) throw error;

      await logAudit({
        action: "update",
        entity: "dd_mandate",
        entityId: mandate.id,
        metadata: {
          previous_status: mandate.status,
          new_status: newStatus,
          account_number: accountNumber,
        },
      });

      toast({ title: `Mandate status updated to ${newStatus}` });
      refetch();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdating(false);
      setStatusAction(null);
    }
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

                {/* Admin Actions */}
                {mandate.status !== "cancelled" && (
                  <div className="mt-3 pt-3 border-t border-foreground/10 flex flex-wrap gap-2">
                    {mandate.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusAction({ mandate, newStatus: "verified" })}
                        className="border-2 border-foreground text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Verified
                      </Button>
                    )}
                    {mandate.status === "verified" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusAction({ mandate, newStatus: "submitted_to_provider" })}
                        className="border-2 border-foreground text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Mark Submitted
                      </Button>
                    )}
                    {mandate.status === "submitted_to_provider" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusAction({ mandate, newStatus: "active" })}
                        className="border-2 border-foreground text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatusAction({ mandate, newStatus: "cancelled" })}
                      className="text-destructive text-xs"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
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

      {/* Status Update Confirmation */}
      <AlertDialog open={!!statusAction} onOpenChange={() => setStatusAction(null)}>
        <AlertDialogContent className="border-4 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Update Mandate Status
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the mandate status from "{statusAction?.mandate.status}" to "{statusAction?.newStatus}"?
              {statusAction?.newStatus === "cancelled" && (
                <span className="block mt-2 text-destructive font-medium">
                  This action cannot be undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusUpdate}
              disabled={updating}
              className={statusAction?.newStatus === "cancelled" ? "bg-destructive" : ""}
            >
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CustomerDDSection;
