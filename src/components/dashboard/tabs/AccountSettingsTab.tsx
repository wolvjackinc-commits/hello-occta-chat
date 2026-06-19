import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  date_of_birth?: string | null;
  updated_at?: string | null;
};

export function AccountSettingsTab({ profile }: { profile: Profile | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Profile>(profile || ({ id: "", full_name: "", email: "", phone: "", address_line1: "", address_line2: "", city: "", postcode: "", date_of_birth: "" } as Profile));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.id) return;
    // Light client-side validation — server still enforces RLS scoped to auth.uid().
    if (form.phone && !/^[+\d\s()-]{7,20}$/.test(form.phone)) {
      toast({ title: "Check your phone number", description: "Use digits, spaces, +, -, () only.", variant: "destructive" });
      return;
    }
    if (form.postcode && form.postcode.length > 10) {
      toast({ title: "Postcode looks wrong", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      postcode: form.postcode?.trim().toUpperCase() || null,
      date_of_birth: form.date_of_birth || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    await logAudit({ action: "update", entity: "profile", entityId: form.id, metadata: { source: "customer_self_serve", updatedFields: Object.keys(payload) } }).catch(() => {});
    toast({ title: "Saved", description: "Your details are updated — our team sees the same info." });
  };

  const field = (label: string, key: keyof Profile, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={(form[key] as string) || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="border-2 border-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="p-3 border-2 border-foreground/30 bg-muted/40 text-xs">
        Any change you make here is the single source of truth — our support team sees the same details instantly. To change your email, please contact us.
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase">Your details</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {field("Full name", "full_name")}
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={form.email || ""} disabled className="border-2 border-foreground" />
          </div>
          {field("Phone", "phone", "tel")}
          {field("Date of birth", "date_of_birth", "date")}
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