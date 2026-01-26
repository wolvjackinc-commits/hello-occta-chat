import { useState } from "react";
import { Loader2, CheckCircle, ExternalLink, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type WorkflowAction = 
  | "verify" 
  | "submit_to_provider" 
  | "mark_active" 
  | "mark_failed" 
  | "cancel";

interface DDWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandateId: string;
  mandateRef: string | null;
  currentStatus: string;
  action: WorkflowAction;
  onSuccess: () => void;
}

const ACTION_CONFIG: Record<WorkflowAction, { 
  title: string; 
  description: string; 
  newStatus: string;
  icon: React.ReactNode;
  variant: "default" | "destructive";
  requiresProvider?: boolean;
}> = {
  verify: {
    title: "Verify Mandate",
    description: "Mark this mandate as verified. The customer will be notified that their bank details have been validated.",
    newStatus: "verified",
    icon: <CheckCircle className="w-5 h-5 text-blue-500" />,
    variant: "default",
  },
  submit_to_provider: {
    title: "Submit to Provider",
    description: "Record that this mandate has been submitted to a DD provider (e.g., GoCardless, Bacs). Enter the provider details below.",
    newStatus: "submitted_to_provider",
    icon: <ExternalLink className="w-5 h-5 text-purple-500" />,
    variant: "default",
    requiresProvider: true,
  },
  mark_active: {
    title: "Mark as Active",
    description: "Confirm the mandate is now active and ready for collections. The customer will be notified their Direct Debit is ready.",
    newStatus: "active",
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    variant: "default",
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

const DD_PROVIDERS = [
  { value: "gocardless", label: "GoCardless" },
  { value: "bacs", label: "Bacs Direct" },
  { value: "stripe", label: "Stripe" },
  { value: "bottomline", label: "Bottomline" },
  { value: "smart_debit", label: "SmartDebit" },
  { value: "other", label: "Other" },
];

export function DDWorkflowDialog({
  open,
  onOpenChange,
  mandateId,
  mandateRef,
  currentStatus,
  action,
  onSuccess,
}: DDWorkflowDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provider, setProvider] = useState("");
  const [providerReference, setProviderReference] = useState("");

  const config = ACTION_CONFIG[action];

  const handleSubmit = async () => {
    if (config.requiresProvider && (!provider || !providerReference)) {
      toast({ 
        title: "Missing provider details", 
        description: "Please enter both provider and reference.",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "verify-dd-mandate",
          mandateId,
          status: config.newStatus,
          adminUserId: userData?.user?.id,
          ...(config.requiresProvider && { provider, providerReference }),
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Failed to update mandate");
      }

      toast({ 
        title: "Mandate updated", 
        description: `Status changed to ${config.newStatus.replace(/_/g, " ")}. Customer will be notified.`
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
    setProvider("");
    setProviderReference("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          {/* Provider Fields */}
          {config.requiresProvider && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="provider">DD Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="provider" className="border-2 border-foreground">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {DD_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="providerReference">Provider Reference</Label>
                <Input
                  id="providerReference"
                  placeholder="e.g., MD001234567890"
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  className="border-2 border-foreground font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The unique reference assigned by the DD provider
                </p>
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
            disabled={isSubmitting || (config.requiresProvider && (!provider || !providerReference))}
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

export default DDWorkflowDialog;
