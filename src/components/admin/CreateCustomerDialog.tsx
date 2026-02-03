import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Loader2 } from "lucide-react";

interface FormData {
  email: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  date_of_birth: string;
  admin_notes: string;
}

interface CreateCustomerDialogProps {
  onCreated?: (userId: string, accountNumber: string) => void;
  trigger?: React.ReactNode;
}

export const CreateCustomerDialog = ({ onCreated, trigger }: CreateCustomerDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      address_line1: "",
      address_line2: "",
      city: "",
      postcode: "",
      date_of_birth: "",
      admin_notes: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-create-customer", {
        body: {
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || undefined,
          address_line1: data.address_line1 || undefined,
          address_line2: data.address_line2 || undefined,
          city: data.city || undefined,
          postcode: data.postcode || undefined,
          date_of_birth: data.date_of_birth || undefined,
          admin_notes: data.admin_notes || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create customer");
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || "Failed to create customer");
      }

      toast({
        title: "Customer created",
        description: `Account ${result.account_number} created for ${data.full_name}`,
      });

      setOpen(false);
      reset();
      onCreated?.(result.user_id, result.account_number);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Failed to create customer",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) reset();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="border-2 border-foreground">
            <UserPlus className="w-4 h-4 mr-2" />
            Create Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-4 border-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">CREATE NEW CUSTOMER</DialogTitle>
          <DialogDescription>
            Create a new customer account. An account number will be automatically assigned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="email" className="font-display text-sm">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                {...register("email", { required: "Email is required" })}
                className="border-2 border-foreground mt-1"
                placeholder="customer@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="full_name" className="font-display text-sm">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                {...register("full_name", { required: "Full name is required" })}
                className="border-2 border-foreground mt-1"
                placeholder="John Smith"
              />
              {errors.full_name && (
                <p className="text-sm text-destructive mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone" className="font-display text-sm">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                className="border-2 border-foreground mt-1"
                placeholder="01onal 234 567890"
              />
            </div>

            <div>
              <Label htmlFor="date_of_birth" className="font-display text-sm">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...register("date_of_birth")}
                className="border-2 border-foreground mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address_line1" className="font-display text-sm">Address Line 1</Label>
              <Input
                id="address_line1"
                {...register("address_line1")}
                className="border-2 border-foreground mt-1"
                placeholder="14 Manor Road"
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
                  placeholder="Rugby"
                />
              </div>
              <div>
                <Label htmlFor="postcode" className="font-display text-sm">Postcode</Label>
                <Input
                  id="postcode"
                  {...register("postcode")}
                  className="border-2 border-foreground mt-1 uppercase"
                  placeholder="CV21 2SX"
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
            <Button type="submit" disabled={creating} className="border-2 border-foreground">
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Customer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
