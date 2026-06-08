import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

const NUMERIC_FIELDS: [string, string][] = [
  ["minimum_monthly_margin", "Min monthly margin"],
  ["minimum_first_3_month_margin", "Min first-3-month margin"],
  ["minimum_contract_margin", "Min contract margin"],
  ["support_cost_buffer", "Support cost buffer"],
  ["payment_processing_buffer", "Payment processing buffer"],
  ["failed_payment_risk_buffer", "Failed payment risk buffer"],
  ["reward_cost_buffer", "Reward cost buffer"],
  ["router_cost_buffer", "Router cost buffer"],
  ["install_cost_buffer", "Install cost buffer"],
  ["cease_risk_buffer", "Cease risk buffer"],
];

export const AdminMarginRules = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; row?: any }>({ open: false });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["margin-rules"],
    queryFn: async () => (await (supabase as any).from("margin_rules").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-upsert-margin-rule", { body });
    if (error || (data as any)?.error) { toast({ title: "Save failed", description: (data as any)?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: "Margin rule saved" });
    setDialog({ open: false });
    qc.invalidateQueries({ queryKey: ["margin-rules"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Margin Rules</h1>
          <p className="text-muted-foreground text-sm">Minimum margins and cost buffers per plan type.</p>
        </div>
        <Button variant="hero" onClick={() => setDialog({ open: true })}><Plus className="w-4 h-4 mr-2" /> Add rule</Button>
      </div>

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Service / Plan</TableHead>
              <TableHead className="font-display uppercase">Customer</TableHead>
              <TableHead className="font-display uppercase">Min monthly</TableHead>
              <TableHead className="font-display uppercase">Min first 3</TableHead>
              <TableHead className="font-display uppercase">Min contract</TableHead>
              <TableHead className="font-display uppercase">Active</TableHead>
              <TableHead className="font-display uppercase text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">Loading…</TableCell></TableRow>
            ) : rules!.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No margin rules yet.</TableCell></TableRow>
            ) : rules!.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.service_type} / {r.plan_type}</TableCell>
                <TableCell className="text-xs capitalize">{r.customer_type}</TableCell>
                <TableCell className="text-xs">£{Number(r.minimum_monthly_margin).toFixed(2)}</TableCell>
                <TableCell className="text-xs">£{Number(r.minimum_first_3_month_margin).toFixed(2)}</TableCell>
                <TableCell className="text-xs">£{Number(r.minimum_contract_margin).toFixed(2)}</TableCell>
                <TableCell><Badge className="border-2 border-foreground">{r.active ? "Active" : "Off"}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setDialog({ open: true, row: r })}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RuleDialog state={dialog} onClose={() => setDialog({ open: false })} onSave={save} />
    </div>
  );
};

const RuleDialog = ({ state, onClose, onSave }: any) => {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!state.open) return;
    setForm(state.row ?? { service_type: "broadband", plan_type: "flex", customer_type: "residential", active: true });
  }, [state.open, state.row]);
  const F = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.row ? "Edit margin rule" : "Add margin rule"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Service type</Label>
            <Select value={form.service_type} onValueChange={(v) => F("service_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["broadband","sim","digital_voice","business","router","install","other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Plan type</Label>
            <Select value={form.plan_type} onValueChange={(v) => F("plan_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["flex","contract_saver","sim","digital_voice","business"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Customer type</Label>
            <Select value={form.customer_type} onValueChange={(v) => F("customer_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["residential","business","both"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {NUMERIC_FIELDS.map(([k, label]) => (
            <div key={k}><Label>{label}</Label>
              <Input type="number" step="0.01" value={form[k] ?? 0} onChange={(e) => F(k, Number(e.target.value))} />
            </div>
          ))}
          <div className="flex items-end gap-2 col-span-3">
            <Switch checked={!!form.active} onCheckedChange={(v) => F("active", v)} /><Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="hero" disabled={saving} onClick={async () => {
            setSaving(true); await onSave(state.row ? { ...form, id: state.row.id } : form); setSaving(false);
          }}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminMarginRules;