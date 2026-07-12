import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";

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
  marketing_email_consent?: boolean | null;
  marketing_sms_consent?: boolean | null;
  service_updates_consent?: boolean | null;
  consent_updated_at?: string | null;
  updated_at?: string | null;
};

export function AccountSettingsTab({ profile }: { profile: Profile | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Profile>(
    profile ||
      ({
        id: "",
        full_name: "",
        email: "",
        phone: "",
        address_line1: "",
        address_line2: "",
        city: "",
        postcode: "",
        date_of_birth: "",
        marketing_email_consent: false,
        marketing_sms_consent: false,
        service_updates_consent: true,
      } as Profile)
  );
  const [saving, setSaving] = useState(false);

  // Consent columns are not exposed on the customer_profile view, so fetch them
  // directly from profiles (RLS restricts to the caller's own row).
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("marketing_email_consent, marketing_sms_consent, service_updates_consent, consent_updated_at")
        .eq("id", profile.id)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          marketing_email_consent: (data as any).marketing_email_consent ?? false,
          marketing_sms_consent: (data as any).marketing_sms_consent ?? false,
          service_updates_consent: (data as any).service_updates_consent ?? true,
          consent_updated_at: (data as any).consent_updated_at ?? null,
        }));
      }
    })();
  }, [profile?.id]);

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
    const payload: any = {
      full_name: form.full_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      postcode: form.postcode?.trim().toUpperCase() || null,
      date_of_birth: form.date_of_birth || null,
      marketing_email_consent: !!form.marketing_email_consent,
      marketing_sms_consent: !!form.marketing_sms_consent,
      service_updates_consent: !!form.service_updates_consent,
      consent_updated_at: new Date().toISOString(),
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

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="font-display uppercase">Communication preferences</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          We only use your details to run your services. You can change these at any time — we honour your choices under UK GDPR.
        </p>

        <div className="divide-y-2 divide-foreground/10 border-2 border-foreground/20">
          <ConsentRow
            title="Service updates & notices"
            description="Outages, planned maintenance, billing changes, and other operational messages. Required to keep your service running smoothly."
            checked={!!form.service_updates_consent}
            onChange={(v) => setForm({ ...form, service_updates_consent: v })}
          />
          <ConsentRow
            title="Marketing emails"
            description="Occasional offers, product news and tips. No spam — one-click unsubscribe on every email."
            checked={!!form.marketing_email_consent}
            onChange={(v) => setForm({ ...form, marketing_email_consent: v })}
          />
          <ConsentRow
            title="Marketing text messages"
            description="Time-limited deals sent to your mobile. We'll only use the number on your account."
            checked={!!form.marketing_sms_consent}
            onChange={(v) => setForm({ ...form, marketing_sms_consent: v })}
          />
        </div>

        {form.consent_updated_at && (
          <p className="text-xs text-muted-foreground">
            Preferences last updated {format(new Date(form.consent_updated_at), "dd MMM yyyy 'at' HH:mm")}.
          </p>
        )}
      </div>

      <Button variant="hero" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 p-3 cursor-pointer">
      <div className="min-w-0">
        <p className="font-display uppercase text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1" />
    </label>
  );
}