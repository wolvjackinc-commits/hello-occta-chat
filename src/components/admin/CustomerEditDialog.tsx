import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Save } from "lucide-react";

interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  admin_notes: string | null;
}

interface FormData {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  admin_notes: string;
}

interface CustomerEditDialogProps {
  customer: CustomerProfile;
  onSaved?: () => void;
  trigger?: React.ReactNode;
}

export const CustomerEditDialog = ({ customer, onSaved, trigger }: CustomerEditDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      full_name: customer.full_name || "",
      phone: customer.phone || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      postcode: customer.postcode || "",
      admin_notes: customer.admin_notes || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name || null,
          phone: data.phone || null,
          address_line1: data.address_line1 || null,
          address_line2: data.address_line2 || null,
          city: data.city || null,
          postcode: data.postcode.toUpperCase() || null,
          admin_notes: data.admin_notes || null,
        })
        .eq("id", customer.id);

      if (error) throw error;

      await logAudit({
        action: "update",
        entity: "profile",
        entityId: customer.id,
        metadata: {
          updatedFields: Object.keys(data).filter(
            (k) => data[k as keyof FormData] !== (customer[k as keyof CustomerProfile] || "")
          ),
        },
      });

      toast({ title: "Customer updated" });
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      toast({
        title: "Failed to update customer",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        reset({
          full_name: customer.full_name || "",
          phone: customer.phone || "",
          address_line1: customer.address_line1 || "",
          address_line2: customer.address_line2 || "",
          city: customer.city || "",
          postcode: customer.postcode || "",
          admin_notes: customer.admin_notes || "",
        });
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-2 border-foreground">
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-4 border-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">EDIT CUSTOMER</DialogTitle>
          <DialogDescription>
            Update customer details and add internal notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="full_name" className="font-display text-sm">Full Name</Label>
              <Input
                id="full_name"
                {...register("full_name")}
                className="border-2 border-foreground mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="font-display text-sm">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                className="border-2 border-foreground mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address_line1" className="font-display text-sm">Address Line 1</Label>
              <Input
                id="address_line1"
                {...register("address_line1")}
                className="border-2 border-foreground mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address_line2" className="font-display text-sm">Address Line 2</Label>
              <Input
                id="address_line2"
                {...register("address_line2")}
                className="border-2 border-foreground mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="font-display text-sm">City</Label>
                <Input
                  id="city"
                  {...register("city")}
                  className="border-2 border-foreground mt-1"
                />
              </div>
              <div>
                <Label htmlFor="postcode" className="font-display text-sm">Postcode</Label>
                <Input
                  id="postcode"
                  {...register("postcode")}
                  className="border-2 border-foreground mt-1 uppercase"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin_notes" className="font-display text-sm">
                Internal Notes
                <span className="text-muted-foreground font-normal ml-2">(Only visible to staff)</span>
              </Label>
              <Textarea
                id="admin_notes"
                {...register("admin_notes")}
                placeholder="Add internal notes about this customer..."
                className="border-2 border-foreground mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-2 border-foreground"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="border-2 border-foreground">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
