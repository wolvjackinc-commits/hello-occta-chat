import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle, ExternalLink, XCircle, AlertTriangle, FileText, History, ShieldCheck, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { providerGuaranteeText } from "@/lib/legal/directDebitGuarantee";

// OCCTA submits Direct Debit mandates MANUALLY in one of two provider portals.
// There is no provider API, no webhook and no automated submission: this dialog
// records what the admin did and the backend emails the customer.
export type WorkflowAction =
  | "verify"
  | "pending_contract"
  | "submit_to_provider"
  | "mark_active"
  | "action_required"
  | "reject"
  | "mark_failed"
  | "cancel";

interface DDWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandateId: string;
  mandateRef: string | null;
  currentStatus: string;
  currentProviderCode?: string | null;
  action: WorkflowAction;
  onSuccess: () => void;
}

type DDProvider = {
  provider_code: string;
  display_name: string;
  legal_collection_name: string;
  service_user_number: string;
  advance_notice_working_days: number;
  mandate_template_name: string;
  guarantee_template_name: string;
  submission_mode: string;
  enabled: boolean;
};

const ACTION_CONFIG: Record<WorkflowAction, { 
  title: string; 
  description: string; 
  newStatus: string;
  icon: React.ReactNode;
  variant: "default" | "destructive";
  requiresProvider?: boolean;
}> = {
  verify: {
    title: "Ready for Manual Submission",
    description: "Mark this mandate as checked and queued for manual submission in the provider portal. The customer is notified automatically.",
    newStatus: "awaiting_manual_submission",
    icon: <CheckCircle className="w-5 h-5 text-blue-500" />,
    variant: "default",
  },
  pending_contract: {
    title: "Hold for Contract",
    description: "Hold this mandate until the customer's agreement is complete. The customer is notified automatically.",
    newStatus: "pending_contract",
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    variant: "default",
  },
  submit_to_provider: {
    title: "Mark Submitted to Provider",
    description: "Record that you have manually submitted this mandate in the provider's portal. Select the provider and enter the portal reference and submission date.",
    newStatus: "submitted_to_provider",
    icon: <ExternalLink className="w-5 h-5 text-purple-500" />,
    variant: "default",
    requiresProvider: true,
  },
  mark_active: {
    title: "Mark as Active",
    description: "Record the provider portal result: the mandate is live and ready for collections. Never set this automatically — only after the portal confirms it.",
    newStatus: "active",
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    variant: "default",
  },
  action_required: {
    title: "Action Needed From Customer",
    description: "Record that the instruction needs something checking before it can be completed. The customer is asked to contact us.",
    newStatus: "action_required",
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    variant: "default",
  },
  reject: {
    title: "Mark as Rejected",
    description: "Record that the provider or bank did not accept the instruction. The customer is notified that no collections will be taken.",
    newStatus: "rejected",
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    variant: "destructive",
  },
  mark_failed: {
    title: "Mark as Failed",
    description: "Mark this mandate as failed. The customer will be notified that action is required.",
    newStatus: "failed",
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
    variant: "destructive",
  },
  cancel: {
    title: "Cancel Mandate",
    description: "Cancel this mandate permanently. The customer will be notified of the cancellation.",
    newStatus: "cancelled",
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    variant: "destructive",
  },
};

/** Statuses that cannot be recorded until a manual provider has been selected. */
const PROVIDER_DEPENDENT = ["submitted_to_provider", "active", "action_required", "rejected", "failed"];

export function DDWorkflowDialog({
  open,
  onOpenChange,
  mandateId,
  mandateRef,
  currentStatus,
  currentProviderCode = null,
  action,
  onSuccess,
}: DDWorkflowDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provider, setProvider] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [submittedAt, setSubmittedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [internalNote, setInternalNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showGuarantee, setShowGuarantee] = useState(false);

  const config = ACTION_CONFIG[action];
  const providerRequired = PROVIDER_DEPENDENT.includes(config.newStatus);

  const { data: providers } = useQuery({
    queryKey: ["dd-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_providers")
        .select("provider_code, display_name, legal_collection_name, service_user_number, advance_notice_working_days, mandate_template_name, guarantee_template_name, submission_mode, enabled")
        .eq("enabled", true)
        .order("provider_code");
      if (error) throw error;
      return (data ?? []) as DDProvider[];
    },
    enabled: open,
  });

  const { data: history } = useQuery({
    queryKey: ["dd-status-history", mandateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_mandate_status_history")
        .select("id, old_status, new_status, provider_code, provider_reference, submitted_at, changed_by, internal_note, created_at")
        .eq("mandate_id", mandateId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Customer notifications queued by the atomic status routine. Only a FAILED
  // notification may be resent; sent and suppressed_test rows are read-only so
  // a customer can never receive the same status email twice.
  const { data: notifications, refetch: refetchNotifications } = useQuery({
    queryKey: ["dd-notifications", mandateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_email_outbox")
        .select("id, subject, status, retry_count, last_error, sent_at, is_test, created_at")
        .eq("mandate_id", mandateId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const [resendingId, setResendingId] = useState<string | null>(null);
  const handleResend = async (outboxId: string) => {
    setResendingId(outboxId);
    try {
      const { data, error } = await supabase.functions.invoke("dd-outbox-worker", {
        body: { outboxId, resend: true },
      });
      const first = (data as { results?: Array<{ status?: string; error?: string }> })?.results?.[0];
      if (error || first?.status !== "sent") {
        toast({
          title: "Resend failed",
          description: first?.error ?? error?.message ?? "The notification could not be sent. It stays queued for retry.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Notification resent", description: "The customer has been emailed the current status." });
      }
      await refetchNotifications();
    } finally {
      setResendingId(null);
    }
  };

  // Pre-select whichever provider the mandate is already allocated to.
  useEffect(() => {
    if (open) setProvider(currentProviderCode ?? "");
  }, [open, currentProviderCode]);

  const selected = useMemo(
    () => (providers ?? []).find((p) => p.provider_code === provider) ?? null,
    [providers, provider],
  );

  const missingProvider = providerRequired && !provider;
  const missingSubmission = config.newStatus === "submitted_to_provider" && (!providerReference.trim() || !submittedAt);

  const handleSubmit = async () => {
    if (missingProvider) {
      toast({
        title: "Provider selection required",
        description: "Choose FastPay or AccessPay — APS Re OCCTA before recording this status.",
        variant: "destructive",
      });
      return;
    }
    if (missingSubmission) {
      toast({
        title: "Missing submission details",
        description: "Enter the provider portal reference and the date you submitted it.",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("dd-mandate-status", {
        body: {
          mandateId,
          newStatus: config.newStatus,
          providerCode: provider || null,
          providerReference: providerReference.trim() || null,
          submittedAt: config.newStatus === "submitted_to_provider" ? new Date(submittedAt).toISOString() : null,
          internalNote: internalNote.trim() || null,
          overrideReason: overrideReason.trim() || null,
        },
      });

      if (error || !data?.success) {
        throw new Error(describeError(data?.error) || error?.message || "Failed to update mandate");
      }

      const suppressed = data?.notification_status === "suppressed_test";
      toast({ 
        title: "Mandate updated", 
        description: suppressed
          ? `Status changed to ${config.newStatus.replace(/_/g, " ")}. Test mandate — notification suppressed.`
          : `Status changed to ${config.newStatus.replace(/_/g, " ")}. Customer notification queued.`,
      });
      
      onSuccess();
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProviderReference("");
    setInternalNote("");
    setOverrideReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-4 border-foreground flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* Mandate Info */}
          <div className="bg-muted p-3 rounded space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mandate Reference:</span>
              <span className="font-mono font-medium">{mandateRef || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Status:</span>
              <span className="font-medium capitalize">{currentStatus.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New Status:</span>
              <span className="font-medium capitalize text-primary">{config.newStatus.replace(/_/g, " ")}</span>
            </div>
          </div>

          {/* Manual provider selection */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="provider">
                Direct Debit provider {providerRequired && <span className="text-destructive">*</span>}
              </Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="provider" className="border-2 border-foreground">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {(providers ?? []).map((p) => (
                    <SelectItem key={p.provider_code} value={p.provider_code}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Both providers are submitted manually in the provider portal — nothing is sent automatically.
              </p>
            </div>

            {/* Read-only provider confirmation */}
            {selected && (
              <div className="border-2 border-foreground p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collection name</span>
                  <span className="font-medium">{selected.legal_collection_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service User Number</span>
                  <span className="font-mono font-medium">{selected.service_user_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance notice</span>
                  <span className="font-medium">{selected.advance_notice_working_days} working days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission</span>
                  <Badge variant="outline" className="border-foreground">Manual portal</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="w-3 h-3" /> Mandate form
                  </span>
                  <span className="font-mono">{selected.mandate_template_name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuarantee((v) => !v)}
                  className="flex items-center gap-1 underline text-muted-foreground"
                >
                  <ShieldCheck className="w-3 h-3" />
                  {showGuarantee ? "Hide" : "Show"} provider Guarantee wording
                </button>
                {showGuarantee && (
                  <p className="whitespace-pre-line leading-relaxed">{providerGuaranteeText(selected)}</p>
                )}
                <p className="text-muted-foreground">
                  Bank account and sort code are never shown here.
                </p>
              </div>
            )}

            {config.newStatus === "submitted_to_provider" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="providerReference">
                    Provider portal reference <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="providerReference"
                    placeholder="Reference shown in the provider portal"
                    value={providerReference}
                    onChange={(e) => setProviderReference(e.target.value)}
                    className="border-2 border-foreground font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submittedAt">
                    Submission date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="submittedAt"
                    type="date"
                    value={submittedAt}
                    onChange={(e) => setSubmittedAt(e.target.value)}
                    className="border-2 border-foreground"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="internalNote">Internal note (optional, never emailed)</Label>
              <Textarea
                id="internalNote"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="border-2 border-foreground"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overrideReason">Super-admin override reason (only for out-of-sequence changes)</Label>
              <Input
                id="overrideReason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Required if this transition is not a normal next step"
                className="border-2 border-foreground"
              />
            </div>
          </div>

          {/* Status history */}
          {!!history?.length && (
            <div className="border-t pt-4 space-y-2">
              <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
                <History className="w-3 h-3" /> Status history
              </p>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="border-2 border-foreground/20 p-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium capitalize">
                        {(h.old_status || "—").replace(/_/g, " ")} → {h.new_status.replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(h.created_at), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {h.provider_code ? `Provider: ${h.provider_code}` : "Provider: not allocated"}
                      {h.provider_reference ? ` · Ref ${h.provider_reference}` : ""}
                      {h.changed_by ? ` · by ${String(h.changed_by).slice(0, 8)}` : ""}
                    </div>
                    {h.internal_note && <p className="italic">{h.internal_note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning for destructive actions */}
          {config.variant === "destructive" && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 rounded text-sm text-destructive">
              <strong>Warning:</strong> This action will notify the customer immediately. 
              {action === "cancel" && " This cannot be undone."}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="border-2 border-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || missingProvider || missingSubmission}
            variant={config.variant}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm {config.title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Turns backend error codes into admin-readable guidance. */
function describeError(code?: string): string | null {
  switch (code) {
    case "provider_selection_required":
      return "Select the Direct Debit provider before recording this status.";
    case "provider_reference_required":
      return "Enter the provider portal reference.";
    case "submission_date_required":
      return "Enter the date the mandate was submitted in the provider portal.";
    case "no_op_status_change":
      return "The mandate is already at that status — nothing was changed and no email was sent.";
    case "invalid_transition":
      return "That is not a valid next step. A super admin can override with a reason.";
    case "provider_not_configured":
      return "That provider is not configured or is disabled.";
    case "forbidden":
      return "You do not have permission to change Direct Debit status.";
    default:
      return code ?? null;
  }
}

export default DDWorkflowDialog;
