import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminEmptyState, IncludeArchivedToggle } from "@/components/admin/primitives";
import { Package } from "lucide-react";

type SimSettings = { standalone_enabled: boolean; esim_enabled: boolean; physical_sim_enabled: boolean; direct_debit_enabled: boolean; dispatch_lead_time_days: number };
type SimPlan = {
  id?: string;
  slug: string;
  name: string;
  network_display_name: string | null;
  data_label: string;
  calls_label: string;
  texts_label: string;
  monthly_price_minor: number;
  first_payment_minor: number;
  delivery_fee_minor: number;
  min_term_months: number;
  is_rolling: boolean;
  esim_available: boolean;
  physical_sim_available: boolean;
  vat_mode: "included" | "excluded";
  vat_rate: number;
  is_active: boolean;
  checkout_visible: boolean;
  sort_order: number;
};

const emptyPlan: SimPlan = {
  slug: "", name: "", network_display_name: null,
  data_label: "10GB", calls_label: "Unlimited calls", texts_label: "Unlimited texts",
  monthly_price_minor: 999, first_payment_minor: 0, delivery_fee_minor: 0,
  min_term_months: 1, is_rolling: true, esim_available: true, physical_sim_available: true,
  vat_mode: "included", vat_rate: 0.2, is_active: false, checkout_visible: false, sort_order: 100,
};

export function AdminSimPlans() {
  const [settings, setSettings] = useState<SimSettings | null>(null);
  const [plans, setPlans] = useState<SimPlan[]>([]);
  const [editing, setEditing] = useState<SimPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const s = await (supabase as any).from("sim_settings").select("*").eq("singleton", true).maybeSingle();
    setSettings(s.data);
    const p = await (supabase as any).from("sim_plans").select("*").order("sort_order", { ascending: true });
    setPlans((p.data as SimPlan[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async (patch: Partial<SimSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    const { error } = await (supabase as any).from("sim_settings").update(next).eq("singleton", true);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setSettings(next);
  };

  const savePlan = async () => {
    if (!editing) return;
    setSaving(true);
    const { id, ...rest } = editing;
    const query = id
      ? (supabase as any).from("sim_plans").update(rest).eq("id", id)
      : (supabase as any).from("sim_plans").insert(rest);
    const { error } = await query;
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved" });
    setEditing(null);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-display uppercase">SIM plans &amp; settings</h1>

      {settings && (
        <div className="card-brutal bg-card p-4">
          <h2 className="font-display uppercase mb-3">Global SIM settings</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={settings.standalone_enabled} onCheckedChange={(v) => saveSettings({ standalone_enabled: !!v })} />Standalone SIM enabled</label>
            <label className="flex items-center gap-2"><Checkbox checked={settings.esim_enabled} onCheckedChange={(v) => saveSettings({ esim_enabled: !!v })} />eSIM enabled</label>
            <label className="flex items-center gap-2"><Checkbox checked={settings.physical_sim_enabled} onCheckedChange={(v) => saveSettings({ physical_sim_enabled: !!v })} />Physical SIM enabled</label>
            <label className="flex items-center gap-2"><Checkbox checked={settings.direct_debit_enabled} onCheckedChange={(v) => saveSettings({ direct_debit_enabled: !!v })} />Direct Debit enabled</label>
            <div className="col-span-2 md:col-span-1">
              <Label>Dispatch lead time (days)</Label>
              <Input type="number" value={settings.dispatch_lead_time_days} onChange={(e) => saveSettings({ dispatch_lead_time_days: Number(e.target.value) })} />
            </div>
          </div>
          {!settings.standalone_enabled && (
            <p className="text-xs text-muted-foreground mt-3">SIM checkout is currently disabled — /sim shows an empty state.</p>
          )}
        </div>
      )}

      <div className="card-brutal bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display uppercase">Plans</h2>
          <div className="flex items-center gap-3">
            <IncludeArchivedToggle
              checked={showInactive}
              onCheckedChange={setShowInactive}
              id="sim-plans-show-inactive"
              label="Show inactive plans"
            />
            <Button variant="hero" onClick={() => setEditing({ ...emptyPlan })}>+ New plan</Button>
          </div>
        </div>
        {(() => {
          const visible = plans.filter((p) => showInactive || p.is_active);
          if (visible.length === 0) {
            return (
              <AdminEmptyState
                icon={<Package className="h-8 w-8" />}
                title={plans.length === 0 ? "No SIM plans yet" : "No active plans"}
                message={plans.length === 0 ? "Add one to enable checkout." : "Toggle above to show inactive plans."}
              />
            );
          }
          return (
            <div className="grid gap-2">
              {visible.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-2 border-foreground p-3 text-sm">
                  <div>
                    <p className="font-display uppercase">{p.name} <span className="text-xs text-muted-foreground">({p.slug})</span></p>
                    <p className="text-xs text-muted-foreground">{p.data_label} · £{(p.monthly_price_minor / 100).toFixed(2)}/mo · {p.is_active ? "active" : "inactive"} · {p.checkout_visible ? "visible" : "hidden"}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit SIM plan" : "New SIM plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Slug *</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Network display</Label><Input value={editing.network_display_name ?? ""} onChange={(e) => setEditing({ ...editing, network_display_name: e.target.value || null })} /></div>
              <div><Label>Data label</Label><Input value={editing.data_label} onChange={(e) => setEditing({ ...editing, data_label: e.target.value })} /></div>
              <div><Label>Calls label</Label><Input value={editing.calls_label} onChange={(e) => setEditing({ ...editing, calls_label: e.target.value })} /></div>
              <div><Label>Texts label</Label><Input value={editing.texts_label} onChange={(e) => setEditing({ ...editing, texts_label: e.target.value })} /></div>
              <div><Label>Monthly price (pence)</Label><Input type="number" value={editing.monthly_price_minor} onChange={(e) => setEditing({ ...editing, monthly_price_minor: Number(e.target.value) })} /></div>
              <div><Label>First payment (pence)</Label><Input type="number" value={editing.first_payment_minor} onChange={(e) => setEditing({ ...editing, first_payment_minor: Number(e.target.value) })} /></div>
              <div><Label>Delivery fee (pence)</Label><Input type="number" value={editing.delivery_fee_minor} onChange={(e) => setEditing({ ...editing, delivery_fee_minor: Number(e.target.value) })} /></div>
              <div><Label>Min term (months)</Label><Input type="number" value={editing.min_term_months} onChange={(e) => setEditing({ ...editing, min_term_months: Number(e.target.value) })} /></div>
              <div><Label>VAT mode</Label>
                <select className="w-full border-2 border-foreground p-2" value={editing.vat_mode} onChange={(e) => setEditing({ ...editing, vat_mode: e.target.value as "included" | "excluded" })}>
                  <option value="included">included</option><option value="excluded">excluded</option>
                </select>
              </div>
              <div><Label>VAT rate</Label><Input type="number" step="0.01" value={editing.vat_rate} onChange={(e) => setEditing({ ...editing, vat_rate: Number(e.target.value) })} /></div>
              <div><Label>Sort order</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
              <div className="col-span-2 flex flex-wrap gap-4 pt-2 border-t-2 border-foreground/20">
                <label className="flex items-center gap-2"><Checkbox checked={editing.is_rolling} onCheckedChange={(v) => setEditing({ ...editing, is_rolling: !!v })} />Rolling monthly</label>
                <label className="flex items-center gap-2"><Checkbox checked={editing.esim_available} onCheckedChange={(v) => setEditing({ ...editing, esim_available: !!v })} />eSIM available</label>
                <label className="flex items-center gap-2"><Checkbox checked={editing.physical_sim_available} onCheckedChange={(v) => setEditing({ ...editing, physical_sim_available: !!v })} />Physical SIM</label>
                <label className="flex items-center gap-2"><Checkbox checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: !!v })} />Active</label>
                <label className="flex items-center gap-2"><Checkbox checked={editing.checkout_visible} onCheckedChange={(v) => setEditing({ ...editing, checkout_visible: !!v })} />Checkout visible</label>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="hero" onClick={savePlan} disabled={saving || !editing.slug || !editing.name}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminSimPlans;