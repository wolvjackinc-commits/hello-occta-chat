import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, Save } from "lucide-react";
import { VariableHelper } from "./VariableHelper";

type EmailTemplate = {
  id: string;
  template_name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  category: string;
  is_active: boolean;
};

interface TemplateEditorDialogProps {
  open: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "service", label: "Service" },
  { value: "compliance", label: "Compliance" },
];

export const TemplateEditorDialog = ({
  open,
  onClose,
  template,
}: TemplateEditorDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    template_name: "",
    subject: "",
    html_body: "",
    text_body: "",
    category: "general",
  });

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name,
        subject: template.subject,
        html_body: template.html_body,
        text_body: template.text_body || "",
        category: template.category,
      });
    } else {
      setFormData({
        template_name: "",
        subject: "",
        html_body: "",
        text_body: "",
        category: "general",
      });
    }
    setShowPreview(false);
  }, [template, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();

      if (template) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            template_name: data.template_name,
            subject: data.subject,
            html_body: data.html_body,
            text_body: data.text_body || null,
            category: data.category,
            updated_at: new Date().toISOString(),
          })
          .eq("id", template.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from("email_templates").insert({
          template_name: data.template_name,
          subject: data.subject,
          html_body: data.html_body,
          text_body: data.text_body || null,
          category: data.category,
          is_active: true,
          created_by: user?.user?.id || null,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: template ? "Template updated" : "Template created" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save template",
        description: error.message?.includes("unique")
          ? "A template with this name already exists"
          : error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.template_name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    if (!formData.subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }
    if (!formData.html_body.trim()) {
      toast({ title: "HTML body is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = document.getElementById("html_body") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = formData.html_body.substring(0, start);
      const after = formData.html_body.substring(end);
      setFormData((prev) => ({
        ...prev,
        html_body: before + variable + after,
      }));
      // Restore cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setFormData((prev) => ({
        ...prev,
        html_body: prev.html_body + variable,
      }));
    }
  };

  // Preview with sample data
  const getPreviewHtml = () => {
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

    return formData.html_body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return sampleData[key] || match;
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 overflow-hidden">
          {/* Form */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template_name">Template Name</Label>
                <Input
                  id="template_name"
                  placeholder="e.g. Welcome Email"
                  value={formData.template_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, template_name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Welcome to OCCTA, {{first_name}}!"
                value={formData.subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="html_body">HTML Body</Label>
                <VariableHelper onInsert={handleInsertVariable} />
              </div>
              <Textarea
                id="html_body"
                placeholder="Enter HTML content with {{variables}}..."
                className="min-h-[200px] font-mono text-sm"
                value={formData.html_body}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, html_body: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Use HTML formatting. Variables will be replaced with customer data.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_body">Plain Text Body (Optional)</Label>
              <Textarea
                id="text_body"
                placeholder="Plain text fallback for email clients that don't support HTML..."
                className="min-h-[100px] font-mono text-sm"
                value={formData.text_body}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, text_body: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="flex w-[400px] flex-col border-l pl-6">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline">Preview</Badge>
                <span className="text-xs text-muted-foreground">
                  Sample data shown
                </span>
              </div>
              <div className="flex-1 overflow-auto rounded border bg-muted/20 p-4">
                <div className="mb-2 border-b pb-2">
                  <p className="text-xs text-muted-foreground">Subject:</p>
                  <p className="text-sm font-medium">
                    {formData.subject.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                      const samples: Record<string, string> = {
                        first_name: "John",
                        last_name: "Smith",
                        full_name: "John Smith",
                        account_number: "OCC12345678",
                      };
                      return samples[key] || match;
                    })}
                  </p>
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
