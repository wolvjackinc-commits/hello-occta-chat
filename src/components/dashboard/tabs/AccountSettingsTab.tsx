import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
};

export function AccountSettingsTab({ profile }: { profile: Profile | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Profile>(profile || ({ id: "", full_name: "", email: "", phone: "", address_line1: "", address_line2: "", city: "", postcode: "" } as Profile));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, phone: form.phone,
      address_line1: form.address_line1, address_line2: form.address_line2,
      city: form.city, postcode: form.postcode,
    }).eq("id", form.id);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Your details were updated." });
  };

  const field = (label: string, key: keyof Profile, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={(form[key] as string) || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="border-2 border-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase">Your details</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {field("Full name", "full_name")}
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={form.email || ""} disabled className="border-2 border-foreground" />
          </div>
          {field("Phone", "phone", "tel")}
        </div>
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase">Billing & service address</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {field("Address line 1", "address_line1")}
          {field("Address line 2", "address_line2")}
          {field("City", "city")}
          {field("Postcode", "postcode")}
        </div>
      </div>

      <div className="p-4 border-2 border-dashed border-foreground/30 bg-background text-sm text-muted-foreground">
        Marketing and contact preferences will appear here in a future update.
      </div>

      <Button variant="hero" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}