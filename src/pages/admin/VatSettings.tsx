import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const AdminVatSettings = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platform_settings_admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_settings").select("*").eq("singleton", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const { data: roles } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as string[];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).map((r: any) => r.role);
    },
  });
  const canEdit = (roles ?? []).some((r) => ["admin", "super_admin", "finance_admin"].includes(r));

  if (isLoading || !form) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const vatActive = !!form.vat_number && !!form.vat_effective_date &&
    new Date(form.vat_effective_date).getTime() <= Date.now();

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        vat_number: form.vat_number, vat_effective_date: form.vat_effective_date,
        vat_scheme: "Standard VAT Accounting", vat_default_rate: Number(form.vat_default_rate),
        residential_vat_display: "inclusive", business_vat_display: "dual",
        invoice_prefix: form.invoice_prefix, credit_note_prefix: form.credit_note_prefix,
        api_mode: form.api_mode, sim_checkout_mode: form.sim_checkout_mode,
        rewards_enabled: !!form.rewards_enabled, rewards_unlock_rule: form.rewards_unlock_rule,
        manual_mode_message: form.manual_mode_message,
      };
      const { data, error } = await supabase.functions.invoke("admin-update-vat-settings", { body: payload });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Settings saved", description: `${(data as any).fields_changed?.length ?? 0} field(s) changed` });
      qc.invalidateQueries({ queryKey: ["platform_settings_admin"] });
      qc.invalidateQueries({ queryKey: ["platform_settings"] });
      qc.invalidateQueries({ queryKey: ["is-vat-active"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const F = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display">VAT & Platform Settings</h1>
        <p className="text-muted-foreground text-sm">Required before issuing Contract Summaries or VAT invoices.</p>
      </div>

      {!vatActive && (
        <Card className="border-2 border-warning bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>VAT settings incomplete.</strong> You cannot issue Contract Summaries or VAT invoices until VAT details are active.
          </div>
        </Card>
      )}

      {!canEdit && (
        <Card className="border-2 border-foreground p-4 text-sm bg-muted/30">
          You have read-only access. Only super_admin, admin and finance_admin can edit these settings.
        </Card>
      )}

      <Card className="border-2 border-foreground p-6 space-y-6">
        <section className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>VAT number</Label>
            <Input disabled={!canEdit} value={form.vat_number ?? ""} onChange={(e) => F("vat_number", e.target.value)} />
          </div>
          <div>
            <Label>VAT effective date</Label>
            <Input type="date" disabled={!canEdit} value={form.vat_effective_date ?? ""} onChange={(e) => F("vat_effective_date", e.target.value)} />
          </div>
          <div>
            <Label>VAT scheme</Label>
            <Input value="Standard VAT Accounting" disabled />
          </div>
          <div>
            <Label>Default VAT rate (%)</Label>
            <Input type="number" step="0.01" disabled={!canEdit} value={form.vat_default_rate ?? 20} onChange={(e) => F("vat_default_rate", e.target.value)} />
          </div>
          <div>
            <Label>Residential pricing display</Label>
            <Input value="Inclusive of VAT" disabled />
          </div>
          <div>
            <Label>Business pricing display</Label>
            <Input value="Ex VAT + Incl VAT (dual)" disabled />
          </div>
          <div>
            <Label>Invoice prefix</Label>
            <Input disabled={!canEdit} value={form.invoice_prefix ?? "INV-"} onChange={(e) => F("invoice_prefix", e.target.value)} />
          </div>
          <div>
            <Label>Credit note prefix</Label>
            <Input disabled={!canEdit} value={form.credit_note_prefix ?? "CN-"} onChange={(e) => F("credit_note_prefix", e.target.value)} />
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4 border-t-2 border-foreground pt-4">
          <div>
            <Label>API mode</Label>
            <Select value={form.api_mode} onValueChange={(v) => F("api_mode", v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SIM checkout mode</Label>
            <Select value={form.sim_checkout_mode} onValueChange={(v) => F("sim_checkout_mode", v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote-led</SelectItem>
                <SelectItem value="instant">Instant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!form.rewards_enabled} onCheckedChange={(v) => F("rewards_enabled", v)} disabled={!canEdit} />
            <Label>Rewards enabled</Label>
          </div>
          <div>
            <Label>Rewards unlock rule</Label>
            <Select value={form.rewards_unlock_rule ?? "first_cleared_payment"} onValueChange={(v) => F("rewards_unlock_rule", v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first_cleared_payment">First cleared payment</SelectItem>
                <SelectItem value="second_cleared_payment">Second cleared payment</SelectItem>
                <SelectItem value="custom_rule">Custom rule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Manual-mode customer message</Label>
            <Textarea rows={3} disabled={!canEdit} value={form.manual_mode_message ?? ""} onChange={(e) => F("manual_mode_message", e.target.value)} />
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!canEdit || saving} variant="hero">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save settings
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AdminVatSettings;