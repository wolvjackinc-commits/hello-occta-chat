import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  MapPin,
  Calendar,
  FileText,
  Upload,
  Loader2,
  Save,
  Key,
  Trash2,
  Download,
  File,
} from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  date_of_birth?: string | null;
  created_at: string;
};

type UserFile = {
  id: string;
  user_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  created_at: string;
};

interface UserManageDialogProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updatedProfile: Profile) => void;
}

export function UserManageDialog({ profile, open, onOpenChange, onUpdate }: UserManageDialogProps) {
  const { toast } = useToast();
  const [editedProfile, setEditedProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditedProfile({ ...profile });
      fetchFiles();
    }
  }, [profile]);

  const fetchFiles = async () => {
    if (!profile) return;
    setIsLoadingFiles(true);
    try {
      const { data, error } = await supabase
        .from("user_files")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      logError("UserManageDialog.fetchFiles", error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFieldChange = (field: keyof Profile, value: string) => {
    if (editedProfile) {
      setEditedProfile({ ...editedProfile, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!editedProfile) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editedProfile.full_name,
          phone: editedProfile.phone,
          address_line1: editedProfile.address_line1,
          address_line2: editedProfile.address_line2,
          city: editedProfile.city,
          postcode: editedProfile.postcode,
          date_of_birth: editedProfile.date_of_birth || null,
        })
        .eq("id", editedProfile.id);

      if (error) throw error;

      toast({ title: "Profile updated successfully" });
      onUpdate(editedProfile);
    } catch (error) {
      logError("UserManageDialog.handleSave", error);
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!editedProfile?.email) return;
    setIsSendingReset(true);

    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "password_reset",
          to: editedProfile.email,
          redirectTo: `${window.location.origin}/auth?mode=reset`,
          data: {
            full_name: editedProfile.full_name || editedProfile.email?.split("@")[0] || "there",
          },
        },
      });

      if (error) throw error;

      toast({ 
        title: "Password reset email sent",
        description: `Reset link sent to ${editedProfile.email}`,
      });
    } catch (error) {
      logError("UserManageDialog.handleSendPasswordReset", error);
      toast({ title: "Failed to send reset email", variant: "destructive" });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editedProfile) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No admin user");

      // Upload to storage
      const filePath = `${editedProfile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("user-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save file record
      const { error: insertError } = await supabase
        .from("user_files")
        .insert({
          user_id: editedProfile.id,
          uploaded_by: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        });

      if (insertError) throw insertError;

      toast({ title: "File uploaded successfully" });
      fetchFiles();
    } catch (error) {
      logError("UserManageDialog.handleFileUpload", error);
      toast({ title: "Failed to upload file", variant: "destructive" });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from("user-files").remove([filePath]);

      // Delete record
      const { error } = await supabase
        .from("user_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast({ title: "File deleted" });
      setFiles(files.filter(f => f.id !== fileId));
    } catch (error) {
      logError("UserManageDialog.handleDeleteFile", error);
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("user-files")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logError("UserManageDialog.handleDownloadFile", error);
      toast({ title: "Failed to download file", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!editedProfile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <User className="w-6 h-6" />
            MANAGE USER
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 border-4 border-foreground bg-background">
            <TabsTrigger value="profile" className="font-display uppercase data-[state=active]:bg-foreground data-[state=active]:text-background">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="files" className="font-display uppercase data-[state=active]:bg-foreground data-[state=active]:text-background">
              <FileText className="w-4 h-4 mr-2" />
              Files ({files.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh] mt-4">
            <TabsContent value="profile" className="space-y-6 pr-4">
              {/* Basic Info */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <User className="w-5 h-5" /> BASIC INFORMATION
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-display uppercase text-sm">Full Name</Label>
                    <Input
                      value={editedProfile.full_name || ""}
                      onChange={(e) => handleFieldChange("full_name", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Email</Label>
                    <Input
                      value={editedProfile.email || ""}
                      disabled
                      className="mt-1 border-2 border-foreground bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Phone</Label>
                    <Input
                      value={editedProfile.phone || ""}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Date of Birth</Label>
                    <Input
                      type="date"
                      value={editedProfile.date_of_birth || ""}
                      onChange={(e) => handleFieldChange("date_of_birth", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> ADDRESS
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label className="font-display uppercase text-sm">Address Line 1</Label>
                    <Input
                      value={editedProfile.address_line1 || ""}
                      onChange={(e) => handleFieldChange("address_line1", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="font-display uppercase text-sm">Address Line 2</Label>
                    <Input
                      value={editedProfile.address_line2 || ""}
                      onChange={(e) => handleFieldChange("address_line2", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">City</Label>
                    <Input
                      value={editedProfile.city || ""}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <div>
                    <Label className="font-display uppercase text-sm">Postcode</Label>
                    <Input
                      value={editedProfile.postcode || ""}
                      onChange={(e) => handleFieldChange("postcode", e.target.value)}
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Password Reset */}
              <div className="border-4 border-foreground p-4 space-y-4">
                <h3 className="font-display flex items-center gap-2">
                  <Key className="w-5 h-5" /> PASSWORD MANAGEMENT
                </h3>
                <p className="text-sm text-muted-foreground">
                  Send a password reset link to the user's email address.
                </p>
                <Button
                  variant="outline"
                  onClick={handleSendPasswordReset}
                  disabled={isSendingReset}
                  className="border-4 border-foreground"
                >
                  {isSendingReset ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Send Password Reset Email
                </Button>
              </div>

              {/* Metadata */}
              <div className="border-4 border-foreground p-4 bg-secondary">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span className="text-muted-foreground">Joined:</span>
                  <span className="font-display">{format(new Date(editedProfile.created_at), "dd MMM yyyy")}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-4 pr-4">
              {/* Upload Section */}
              <div className="border-4 border-dashed border-foreground p-6 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                  <span className="font-display uppercase">
                    {isUploading ? "Uploading..." : "Click to upload file"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    PDF, Images, Text, Word documents (max 10MB)
                  </span>
                </label>
              </div>

              {/* Files List */}
              <div className="space-y-2">
                {isLoadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : files.length > 0 ? (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border-4 border-foreground bg-card"
                    >
                      <File className="w-8 h-8 flex-shrink-0" />
                      <div className="flex-grow min-w-0">
                        <p className="font-display truncate">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)} • {format(new Date(file.created_at), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadFile(file.file_path, file.file_name)}
                          className="border-2 border-foreground"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id, file.file_path)}
                          className="border-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No files uploaded for this user yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t-4 border-foreground">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-4 border-foreground">
            Cancel
          </Button>
          <Button variant="hero" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
