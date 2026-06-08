import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Benefit = {
  id: string; benefit_name: string; benefit_type: string;
  plan_type: string; customer_type: string; description: string | null;
  value_label: string | null; terms_text: string | null;
  active: boolean; requires_margin_green: boolean; internal_cost_estimate: number | null;
};

const TYPES = ["streaming_reward","bill_credit","extra_points","setup_discount","router_delivery","digital_voice_setup","bundle_discount","custom"];

export const AdminContractBenefits = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Benefit[]>([]);
  const [edit, setEdit] = useState<Partial<Benefit> | null>(null);

  async function load() {
    const { data } = await supabase.from("contract_benefits").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Benefit[]);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit?.benefit_name || !edit?.benefit_type) return;
    const payload: any = {
      benefit_name: edit.benefit_name,
      benefit_type: edit.benefit_type,
      plan_type: edit.plan_type ?? "both",
      customer_type: edit.customer_type ?? "both",
      description: edit.description ?? null,
      value_label: edit.value_label ?? null,
      terms_text: edit.terms_text ?? null,
      internal_cost_estimate: edit.internal_cost_estimate ?? null,
      active: !!edit.active,
      requires_margin_green: edit.requires_margin_green ?? true,
    };
    const { error } = edit.id
      ? await supabase.from("contract_benefits").update(payload).eq("id", edit.id)
      : await supabase.from("contract_benefits").insert(payload);
    if (error) return toast({ variant: "destructive", title: "Failed", description: error.message });
    toast({ title: "Saved" });
    setEdit(null); load();
  }

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display uppercase text-3xl">Contract benefits</h1>
          <p className="text-sm text-muted-foreground">New benefits are inactive by default.</p>
        </div>
        <Button onClick={() => setEdit({ active: false, requires_margin_green: true, plan_type: "both", customer_type: "both" })}>+ New benefit</Button>
      </div>
      <div className="border-4 border-foreground">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground"><tr><th className="text-left p-2">Name</th><th className="text-left p-2">Type</th><th className="text-left p-2">Plan</th><th className="text-left p-2">Active</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No benefits configured.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="border-t-2 border-foreground">
                <td className="p-2">{b.benefit_name}</td>
                <td className="p-2"><Badge variant="outline">{b.benefit_type}</Badge></td>
                <td className="p-2">{b.plan_type}</td>
                <td className="p-2">{b.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</td>
                <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => setEdit(b)}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit benefit" : "New benefit"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm overflow-y-auto">
            <Input placeholder="Name" value={edit?.benefit_name ?? ""} onChange={(e) => setEdit({ ...edit!, benefit_name: e.target.value })} />
            <select className="w-full border-2 border-foreground p-2 bg-background" value={edit?.benefit_type ?? ""} onChange={(e) => setEdit({ ...edit!, benefit_type: e.target.value })}>
              <option value="">Select type…</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select className="border-2 border-foreground p-2 bg-background" value={edit?.plan_type ?? "both"} onChange={(e) => setEdit({ ...edit!, plan_type: e.target.value })}>
                <option value="flex">flex</option><option value="contract_saver">contract_saver</option><option value="both">both</option>
              </select>
              <select className="border-2 border-foreground p-2 bg-background" value={edit?.customer_type ?? "both"} onChange={(e) => setEdit({ ...edit!, customer_type: e.target.value })}>
                <option value="residential">residential</option><option value="business">business</option><option value="both">both</option>
              </select>
            </div>
            <Input placeholder="Value label (e.g. £5/mo credit)" value={edit?.value_label ?? ""} onChange={(e) => setEdit({ ...edit!, value_label: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Internal cost estimate" value={edit?.internal_cost_estimate ?? ""} onChange={(e) => setEdit({ ...edit!, internal_cost_estimate: e.target.value ? parseFloat(e.target.value) : null })} />
            <Textarea placeholder="Description" value={edit?.description ?? ""} onChange={(e) => setEdit({ ...edit!, description: e.target.value })} />
            <Textarea placeholder="Customer-facing terms text" value={edit?.terms_text ?? ""} onChange={(e) => setEdit({ ...edit!, terms_text: e.target.value })} />
            <label className="flex items-center gap-2"><Switch checked={!!edit?.requires_margin_green} onCheckedChange={(v) => setEdit({ ...edit!, requires_margin_green: v })} /> Requires green margin</label>
            <label className="flex items-center gap-2"><Switch checked={!!edit?.active} onCheckedChange={(v) => setEdit({ ...edit!, active: v })} /> Active (visible to customers)</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default AdminContractBenefits;