import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { format } from "date-fns";

type EmailTemplate = {
  id: string;
  template_name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export const TemplatesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: false })
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template deactivated" });
    },
    onError: () => {
      toast({ title: "Failed to deactivate template", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("email_templates")
        .insert({
          template_name: `${template.template_name} (Copy)`,
          subject: template.subject,
          html_body: template.html_body,
          text_body: template.text_body,
          category: template.category,
          is_active: true,
          created_by: user?.user?.id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Template duplicated" });
    },
    onError: () => {
      toast({ title: "Failed to duplicate template", variant: "destructive" });
    },
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "billing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "service":
        return "bg-green-100 text-green-800 border-green-300";
      case "compliance":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create reusable email templates with variable support
        </p>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      <div className="rounded-lg border-4 border-foreground">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground hover:bg-transparent">
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Subject</TableHead>
              <TableHead className="font-bold">Category</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Updated</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id} className="border-b border-border">
                  <TableCell className="font-medium">{template.template_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {template.subject}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getCategoryColor(template.category)}
                    >
                      {template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(template.updated_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicateMutation.mutate(template)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {template.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(template.id)}
                          title="Deactivate"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TemplateEditorDialog
        open={editorOpen}
        onClose={handleEditorClose}
        template={editingTemplate}
      />
    </div>
  );
};
