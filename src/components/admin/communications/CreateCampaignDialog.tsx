import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Send, Users, FileText, CheckCircle } from "lucide-react";
import { RecipientPicker } from "./RecipientPicker";

type EmailTemplate = {
  id: string;
  template_name: string;
  subject: string;
  html_body: string;
  category: string;
};

interface CreateCampaignDialogProps {
  open: boolean;
  onClose: () => void;
}

type RecipientMode = "all" | "active" | "suspended" | "individual";

export const CreateCampaignDialog = ({ open, onClose }: CreateCampaignDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setRecipientMode("all");
      setSelectedUserIds([]);
      setSelectedTemplateId("");
      setCampaignName("");
    }
  }, [open]);

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, template_name, subject, html_body, category")
        .eq("is_active", true)
        .order("template_name");

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: open,
  });

  // Get recipient count based on mode
  const { data: recipientCount = 0 } = useQuery({
    queryKey: ["recipient-count", recipientMode, selectedUserIds],
    queryFn: async () => {
      if (recipientMode === "individual") {
        return selectedUserIds.length;
      }

      if (recipientMode === "all") {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("email", "is", null);
        return count || 0;
      }

      // Filter by service status
      const { data: serviceUsers } = await supabase
        .from("services")
        .select("user_id")
        .eq("status", recipientMode);

      const uniqueUserIds = [...new Set(serviceUsers?.map((s) => s.user_id) || [])];
      return uniqueUserIds.length;
    },
    enabled: open,
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Send campaign mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const body: Record<string, unknown> = {
        template_id: selectedTemplateId,
        campaign_name: campaignName,
      };

      if (recipientMode === "individual") {
        body.recipient_user_ids = selectedUserIds;
      } else if (recipientMode === "all") {
        body.filter = { all: true };
      } else {
        body.filter = { status: recipientMode };
      }

      const { data, error } = await supabase.functions.invoke("bulk-send-email", {
        body,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Campaign sent!",
        description: `Sent to ${data.sent} recipients. ${data.failed} failed.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canProceedStep1 = recipientMode === "individual" ? selectedUserIds.length > 0 : true;
  const canProceedStep2 = !!selectedTemplateId;
  const canSend = !!campaignName.trim() && canProceedStep2;

  const handleSend = () => {
    if (!canSend) return;
    sendMutation.mutate();
  };

  // Preview HTML with sample data
  const getPreviewHtml = () => {
    if (!selectedTemplate) return "";
    const sampleData: Record<string, string> = {
      first_name: "John",
      last_name: "Smith",
      full_name: "John Smith",
      account_number: "OCC12345678",
      email: "john.smith@example.com",
      phone: "07700 900123",
      support_email: "support@occta.co.uk",
      support_phone: "0800 260 6626",
      company_name: "OCCTA Limited",
      tracking_pixel: "",
    };

    return selectedTemplate.html_body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return sampleData[key] || match;
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden bg-background">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Send className="h-5 w-5" />
            New Campaign
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex flex-shrink-0 items-center justify-center gap-2 border-b pb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  step >= s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`mx-2 h-0.5 w-12 ${
                    step > s ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {/* Step 1: Recipients */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Select Recipients</h3>
              </div>

              <RadioGroup
                value={recipientMode}
                onValueChange={(v) => setRecipientMode(v as RecipientMode)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex-1 cursor-pointer">
                    <div className="font-medium">All Customers</div>
                    <div className="text-sm text-muted-foreground">
                      Send to all customers with an email address
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="active" id="active" />
                  <Label htmlFor="active" className="flex-1 cursor-pointer">
                    <div className="font-medium">Active Customers Only</div>
                    <div className="text-sm text-muted-foreground">
                      Customers with at least one active service
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="suspended" id="suspended" />
                  <Label htmlFor="suspended" className="flex-1 cursor-pointer">
                    <div className="font-medium">Suspended Customers Only</div>
                    <div className="text-sm text-muted-foreground">
                      Customers with suspended services
                    </div>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="individual" id="individual" className="mt-1" />
                  <Label htmlFor="individual" className="flex-1 cursor-pointer">
                    <div className="font-medium">Select Individual Customers</div>
                    <div className="text-sm text-muted-foreground">
                      Choose specific customers to send to
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {recipientMode === "individual" && (
                <RecipientPicker
                  selectedIds={selectedUserIds}
                  onChange={setSelectedUserIds}
                />
              )}

              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">Selected recipients:</span>
                <Badge variant="secondary" className="text-lg">
                  {recipientCount}
                </Badge>
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Choose Template</h3>
              </div>

              <div className="space-y-2">
                <Label>Email Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.template_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="max-h-[300px] overflow-auto rounded-lg border bg-muted/20 p-4">
                    <div className="mb-2 border-b pb-2">
                      <p className="text-xs text-muted-foreground">Subject:</p>
                      <p className="font-medium">{selectedTemplate.subject}</p>
                    </div>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm & Send */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Confirm & Send</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  placeholder="e.g. February Newsletter"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="mb-3 font-medium">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipients:</span>
                    <span className="font-medium">{recipientCount} customers</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-medium">
                      {selectedTemplate?.template_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subject:</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {selectedTemplate?.subject || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
                <p className="text-sm text-foreground">
                  <strong>Warning:</strong> This will send {recipientCount} emails immediately.
                  Make sure you've reviewed the template and recipient list.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation - sticky at bottom */}
        <div className="flex flex-shrink-0 items-center justify-between border-t bg-background pt-4">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            disabled={sendMutation.isPending}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!canSend || sendMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? "Sending..." : "Send Campaign"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
