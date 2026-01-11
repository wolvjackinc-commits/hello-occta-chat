import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { UserCog, Plus, Edit2, Trash2, Phone, Mail, Loader2, Wrench } from "lucide-react";

interface Technician {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  specializations: string[];
  notes: string | null;
  created_at: string;
}

export function TechnicianManager() {
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    specializations: "",
    notes: "",
  });

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      toast({ title: "Failed to load technicians", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (technician?: Technician) => {
    if (technician) {
      setEditingTechnician(technician);
      setFormData({
        full_name: technician.full_name,
        email: technician.email,
        phone: technician.phone,
        specializations: technician.specializations?.join(", ") || "",
        notes: technician.notes || "",
      });
    } else {
      setEditingTechnician(null);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        specializations: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email || !formData.phone) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const specializations = formData.specializations
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      const techData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        specializations,
        notes: formData.notes || null,
      };

      if (editingTechnician) {
        const { error } = await supabase
          .from("technicians")
          .update(techData)
          .eq("id", editingTechnician.id);

        if (error) throw error;
        toast({ title: "Technician updated" });
      } else {
        const { error } = await supabase
          .from("technicians")
          .insert(techData);

        if (error) throw error;
        toast({ title: "Technician added" });
      }

      setIsDialogOpen(false);
      fetchTechnicians();
    } catch (error: any) {
      console.error("Error saving technician:", error);
      if (error.code === "23505") {
        toast({ title: "A technician with this email already exists", variant: "destructive" });
      } else {
        toast({ title: "Failed to save technician", variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (technician: Technician) => {
    try {
      const { error } = await supabase
        .from("technicians")
        .update({ is_active: !technician.is_active })
        .eq("id", technician.id);

      if (error) throw error;

      setTechnicians(technicians.map(t =>
        t.id === technician.id ? { ...t, is_active: !t.is_active } : t
      ));
      toast({ title: `Technician ${!technician.is_active ? "activated" : "deactivated"}` });
    } catch (error) {
      console.error("Error toggling technician:", error);
      toast({ title: "Failed to update technician", variant: "destructive" });
    }
  };

  const handleDelete = async (technicianId: string) => {
    if (!confirm("Are you sure you want to delete this technician?")) return;

    try {
      const { error } = await supabase
        .from("technicians")
        .delete()
        .eq("id", technicianId);

      if (error) throw error;

      toast({ title: "Technician deleted" });
      fetchTechnicians();
    } catch (error) {
      console.error("Error deleting technician:", error);
      toast({ title: "Failed to delete technician", variant: "destructive" });
    }
  };

  return (
    <Card className="border-4 border-foreground">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              TECHNICIANS
            </CardTitle>
            <CardDescription>
              Manage installation technicians and their assignments
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="border-4 border-foreground gap-2">
                <Plus className="w-4 h-4" />
                ADD TECHNICIAN
              </Button>
            </DialogTrigger>
            <DialogContent className="border-4 border-foreground">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingTechnician ? "EDIT TECHNICIAN" : "ADD TECHNICIAN"}
                </DialogTitle>
                <DialogDescription>
                  {editingTechnician ? "Update technician details" : "Add a new installation technician"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="font-display uppercase">Full Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1 border-2 border-foreground"
                  />
                </div>
                <div>
                  <Label className="font-display uppercase">Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="mt-1 border-2 border-foreground"
                  />
                </div>
                <div>
                  <Label className="font-display uppercase">Phone *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07700 900000"
                    className="mt-1 border-2 border-foreground"
                  />
                </div>
                <div>
                  <Label className="font-display uppercase">Specializations</Label>
                  <Input
                    value={formData.specializations}
                    onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                    placeholder="Broadband, Fibre, Landline (comma separated)"
                    className="mt-1 border-2 border-foreground"
                  />
                </div>
                <div>
                  <Label className="font-display uppercase">Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="mt-1 border-2 border-foreground"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full border-4 border-foreground"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      SAVING...
                    </>
                  ) : (
                    editingTechnician ? "UPDATE TECHNICIAN" : "ADD TECHNICIAN"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : technicians.length === 0 ? (
          <div className="text-center py-12 border-4 border-dashed border-muted-foreground rounded">
            <UserCog className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-display text-lg">NO TECHNICIANS</p>
            <p className="text-muted-foreground text-sm mt-1">
              Add technicians to assign them to installations
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-b-4 border-foreground">
                  <TableHead className="font-display uppercase">Technician</TableHead>
                  <TableHead className="font-display uppercase">Contact</TableHead>
                  <TableHead className="font-display uppercase">Specializations</TableHead>
                  <TableHead className="font-display uppercase">Status</TableHead>
                  <TableHead className="font-display uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicians.map((tech) => (
                  <TableRow key={tech.id} className="border-b-2 border-foreground/20">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-display">{tech.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Added {format(new Date(tech.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 text-sm">
                          <Mail className="w-3 h-3" /> {tech.email}
                        </p>
                        <p className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3" /> {tech.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tech.specializations?.map((spec, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {spec}
                          </Badge>
                        )) || <span className="text-muted-foreground text-sm">None</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tech.is_active}
                          onCheckedChange={() => handleToggleActive(tech)}
                        />
                        <Badge variant={tech.is_active ? "default" : "secondary"}>
                          {tech.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(tech)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tech.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
