import { useState } from "react";
import { format } from "date-fns";
import { Eye, EyeOff, Shield, CheckCircle, AlertTriangle, Loader2, Globe, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type DDMandate = {
  id: string;
  user_id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  consent_timestamp: string | null;
  payment_request_id: string | null;
  created_at: string;
  updated_at: string;
  has_bank_details?: boolean;
  sort_code_masked?: string;
  account_number_masked?: string;
};

type FullBankDetails = {
  sortCode: string;
  accountNumber: string;
  accountHolderName: string;
  billingAddress: string | null;
  consentTimestamp: string;
  consentIp: string | null;
  consentUserAgent: string | null;
  signatureName: string;
  mandateReference: string | null;
  status: string;
  provider: string | null;
  bankLast4: string | null;
  paymentRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

interface DDMandateDetailDialogProps {
  mandate: DDMandate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending Verification", variant: "secondary" },
  verified: { label: "Verified", variant: "outline" },
  submitted_to_provider: { label: "Submitted to Provider", variant: "outline" },
  active: { label: "Active", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function DDMandateDetailDialog({
  mandate,
  open,
  onOpenChange,
  onUpdate,
}: DDMandateDetailDialogProps) {
  const { toast } = useToast();
  const [isRevealing, setIsRevealing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [bankDetails, setBankDetails] = useState<FullBankDetails | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  const handleRevealBankDetails = async () => {
    if (!mandate) return;
    
    setIsRevealing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "view-dd-bank-details",
          mandateId: mandate.id,
          adminUserId: userData?.user?.id,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Failed to retrieve bank details");
      }

      setBankDetails(data.bankDetails);
      setShowBankDetails(true);
      toast({ title: "Bank details revealed", description: "Access has been logged for audit." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleStatusChange = async () => {
    if (!mandate || !newStatus) return;

    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "verify-dd-mandate",
          mandateId: mandate.id,
          status: newStatus,
          adminUserId: userData?.user?.id,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Failed to update mandate status");
      }

      toast({ title: "Mandate status updated", description: "Customer will receive an email notification." });
      onUpdate();
      setNewStatus("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setShowBankDetails(false);
    setBankDetails(null);
    setNewStatus("");
    onOpenChange(false);
  };

  if (!mandate) return null;

  const statusConfig = STATUS_CONFIG[mandate.status] || STATUS_CONFIG.pending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Shield className="h-5 w-5" />
            DD Mandate Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Reference</Label>
              <p className="font-mono text-sm">{mandate.mandate_reference || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account Holder</Label>
              <p className="text-sm">{mandate.account_holder || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Created</Label>
              <p className="text-sm">{format(new Date(mandate.created_at), "dd MMM yyyy HH:mm")}</p>
            </div>
            {mandate.consent_timestamp && (
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Consent Given</Label>
                <p className="text-sm">{format(new Date(mandate.consent_timestamp), "dd MMM yyyy HH:mm")}</p>
              </div>
            )}
          </div>

          {/* Bank Details Section - Masked by default, Full when revealed */}
          <div className="border-2 border-foreground p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm uppercase tracking-wide">Bank Details</h3>
              {!showBankDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevealBankDetails}
                  disabled={isRevealing}
                  className="gap-2"
                >
                  {isRevealing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Reveal Full Details (Logged)
                </Button>
              )}
              {showBankDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBankDetails(false);
                    setBankDetails(null);
                  }}
                  className="gap-2"
                >
                  <EyeOff className="h-4 w-4" />
                  Hide
                </Button>
              )}
            </div>

            {showBankDetails && bankDetails ? (
              <div className="space-y-4">
                {/* Core Bank Details */}
                <div className="grid grid-cols-2 gap-3 bg-muted p-3 rounded">
                  <div>
                    <Label className="text-xs text-muted-foreground">Sort Code</Label>
                    <p className="font-mono text-sm font-medium">
                      {bankDetails.sortCode?.replace(/(\d{2})(\d{2})(\d{2})/, "$1-$2-$3")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account Number</Label>
                    <p className="font-mono text-sm font-medium">{bankDetails.accountNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account Holder</Label>
                    <p className="text-sm font-medium">{bankDetails.accountHolderName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">E-Signature</Label>
                    <p className="text-sm italic">{bankDetails.signatureName}</p>
                  </div>
                  {bankDetails.billingAddress && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Billing Address</Label>
                      <p className="text-sm">{bankDetails.billingAddress}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Consent & Verification Details */}
                <div>
                  <h4 className="text-xs uppercase text-muted-foreground font-display mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Consent & Verification
                  </h4>
                  <div className="grid grid-cols-2 gap-3 bg-muted/50 p-3 rounded text-xs">
                    <div>
                      <Label className="text-xs text-muted-foreground">Consent Timestamp</Label>
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {bankDetails.consentTimestamp 
                          ? format(new Date(bankDetails.consentTimestamp), "dd MMM yyyy HH:mm:ss")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Consent IP</Label>
                      <p className="font-mono flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {bankDetails.consentIp || "—"}
                      </p>
                    </div>
                    {bankDetails.consentUserAgent && (
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">User Agent</Label>
                        <p className="font-mono text-xs break-all opacity-70">
                          {bankDetails.consentUserAgent}
                        </p>
                      </div>
                    )}
                    {bankDetails.provider && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Provider</Label>
                        <p className="capitalize">{bankDetails.provider}</p>
                      </div>
                    )}
                    {bankDetails.paymentRequestId && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Request ID</Label>
                        <p className="font-mono text-xs">{bankDetails.paymentRequestId}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">Created At</Label>
                    <p>{format(new Date(bankDetails.createdAt), "dd MMM yyyy HH:mm")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Updated</Label>
                    <p>{format(new Date(bankDetails.updatedAt), "dd MMM yyyy HH:mm")}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sort Code</Label>
                  <p className="font-mono text-sm">**-**-**</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Account Number</Label>
                  <p className="font-mono text-sm">****{mandate.bank_last4 || "****"}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Bank details are encrypted. Access is logged for audit.
            </p>
          </div>

          {/* Status Update Section */}
          {["pending", "verified", "submitted_to_provider"].includes(mandate.status) && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-display text-sm uppercase tracking-wide">Update Status</h3>
              <div className="flex gap-2">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {mandate.status === "pending" && (
                      <SelectItem value="verified">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Mark as Verified
                        </span>
                      </SelectItem>
                    )}
                    {["pending", "verified"].includes(mandate.status) && (
                      <SelectItem value="submitted_to_provider">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                          Mark as Submitted to Provider
                        </span>
                      </SelectItem>
                    )}
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        Mark as Active
                      </span>
                    </SelectItem>
                    <SelectItem value="cancelled">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Cancel Mandate
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleStatusChange}
                  disabled={!newStatus || isUpdating}
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Status changes will send an email notification to the customer.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}