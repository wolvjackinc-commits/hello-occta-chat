import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";

export const AdminPricingRules = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; row?: any }>({ open: false });
  const [catDialog, setCatDialog] = useState(false);

  const { data: vatActive } = useQuery({
    queryKey: ["is-vat-active"],
    queryFn: async () => { const { data } = await (supabase as any).rpc("is_vat_active"); return data === true; },
  });
  const { data: rules, isLoading } = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("pricing_rules").select("*, plan_category:plan_category_id(name), product:supplier_product_id(product_name)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: categories } = useQuery({
    queryKey: ["plan-categories"],
    queryFn: async () => (await (supabase as any).from("plan_categories").select("*").order("display_order")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["sup-products-active"],
    queryFn: async () => (await (supabase as any).from("supplier_products").select("id, product_name, supplier_id").eq("active", true).order("product_name")).data ?? [],
  });

  const save = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-upsert-pricing-rule", { body });
    if (error || (data as any)?.error) {
      toast({ title: "Save failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pricing rule saved" });
    setDialog({ open: false });
    qc.invalidateQueries({ queryKey: ["pricing-rules"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Pricing Rules</h1>
          <p className="text-muted-foreground text-sm">Plan pricing per supplier product and customer type.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatDialog(true)}>Manage categories</Button>
          <Button variant="hero" onClick={() => setDialog({ open: true })}><Plus className="w-4 h-4 mr-2" /> Add rule</Button>
        </div>
      </div>

      {!vatActive && (
        <Card className="border-2 border-warning bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm"><strong>VAT inactive.</strong> Rules cannot be activated until VAT settings are complete.</div>
        </Card>
      )}

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Plan</TableHead>
              <TableHead className="font-display uppercase">Category</TableHead>
              <TableHead className="font-display uppercase">Product</TableHead>
              <TableHead className="font-display uppercase">Customer</TableHead>
              <TableHead className="font-display uppercase">Monthly</TableHead>
              <TableHead className="font-display uppercase">Active</TableHead>
              <TableHead className="font-display uppercase text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">Loading…</TableCell></TableRow>
            ) : rules!.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No pricing rules yet.</TableCell></TableRow>
            ) : rules!.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.public_plan_name}</TableCell>
                <TableCell className="text-xs">{r.plan_category?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.product?.product_name ?? "—"}</TableCell>
                <TableCell className="text-xs capitalize">{r.customer_type}</TableCell>
                <TableCell className="text-xs">
                  {r.customer_type === "business"
                    ? <>£{Number(r.monthly_sell_net).toFixed(2)} ex<br/>£{Number(r.monthly_sell_gross).toFixed(2)} inc</>
                    : <>£{Number(r.monthly_sell_gross).toFixed(2)} inc</>}
                </TableCell>
                <TableCell><Badge className="border-2 border-foreground">{r.active ? "Active" : "Draft"}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setDialog({ open: true, row: r })}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PricingRuleDialog state={dialog} onClose={() => setDialog({ open: false })} onSave={save} categories={categories ?? []} products={products ?? []} vatActive={!!vatActive} />
      <CategoryDialog open={catDialog} onClose={() => setCatDialog(false)} />
    </div>
  );
};

const PricingRuleDialog = ({ state, onClose, onSave, categories, products, vatActive }: any) => {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!state.open) return;
    setForm(state.row ?? {
      customer_type: "residential", monthly_vat_rate: 20, active: false,
      monthly_sell_net: 0, setup_sell_net: 0, router_sell_net: 0, delivery_sell_net: 0, install_sell_net: 0,
    });
  }, [state.open, state.row]);
  const F = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const calc = (net: number) => {
    const rate = Number(form.monthly_vat_rate ?? 20) / 100;
    const vat = +(Number(net || 0) * rate).toFixed(2);
    return { vat, gross: +(Number(net || 0) + vat).toFixed(2) };
  };
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.row ? "Edit pricing rule" : "Add pricing rule"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Public plan name</Label><Input value={form.public_plan_name ?? ""} onChange={(e) => F("public_plan_name", e.target.value)} /></div>
            <div><Label>Plan category</Label>
              <Select value={form.plan_category_id ?? ""} onValueChange={(v) => F("plan_category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Supplier product (optional)</Label>
              <Select value={form.supplier_product_id ?? "none"} onValueChange={(v) => F("supplier_product_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Customer type</Label>
              <Select value={form.customer_type} onValueChange={(v) => F("customer_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["residential","business","both"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Contract length (months)</Label><Input type="number" value={form.contract_length_months ?? ""} onChange={(e) => F("contract_length_months", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div><Label>Monthly VAT rate (%)</Label><Input type="number" step="0.01" value={form.monthly_vat_rate ?? 20} onChange={(e) => F("monthly_vat_rate", Number(e.target.value))} /></div>
            {[
              ["monthly_sell_net","Monthly net"],
              ["setup_sell_net","Setup net"],
              ["router_sell_net","Router net"],
              ["delivery_sell_net","Delivery net"],
              ["install_sell_net","Install net"],
            ].map(([k,label]) => (
              <div key={k}><Label>{label}</Label>
                <Input type="number" step="0.01" value={form[k] ?? 0} onChange={(e) => F(k, Number(e.target.value))} />
                <div className="text-xs text-muted-foreground mt-1">VAT £{calc(form[k] ?? 0).vat.toFixed(2)} · Gross £{calc(form[k] ?? 0).gross.toFixed(2)}</div>
              </div>
            ))}
            <div><Label>Cease fee gross</Label><Input type="number" step="0.01" value={form.cease_fee_gross ?? ""} onChange={(e) => F("cease_fee_gross", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div><Label>Notice period</Label><Input value={form.notice_period ?? ""} onChange={(e) => F("notice_period", e.target.value)} /></div>
            <div className="col-span-2"><Label>Price rise policy</Label><Textarea rows={2} value={form.price_rise_policy ?? ""} onChange={(e) => F("price_rise_policy", e.target.value)} /></div>
            <div className="flex items-end gap-2">
              <Switch checked={!!form.active} onCheckedChange={(v) => F("active", v)} disabled={!vatActive} />
              <Label>Active {!vatActive && <span className="text-xs text-warning">(VAT incomplete)</span>}</Label>
            </div>
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

const CategoryDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: cats, refetch } = useQuery({
    queryKey: ["plan-categories-manage"], enabled: open,
    queryFn: async () => (await (supabase as any).from("plan_categories").select("*").order("display_order")).data ?? [],
  });
  const [form, setForm] = useState<any>({ service_type: "broadband", plan_type: "flex", active: true, display_order: 0 });
  const add = async () => {
    if (!form.name) return;
    const { error } = await (supabase as any).from("plan_categories").insert(form);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category added" });
    setForm({ ...form, name: "" });
    refetch();
    qc.invalidateQueries({ queryKey: ["plan-categories"] });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Plan categories</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">
            {(cats ?? []).map((c: any) => <li key={c.id} className="border-2 border-foreground/30 px-3 py-1.5">{c.name} <span className="text-xs text-muted-foreground">· {c.service_type}/{c.plan_type}</span></li>)}
          </ul>
          <div className="grid grid-cols-2 gap-2 border-t-2 border-foreground pt-3">
            <Input placeholder="Name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["broadband","sim","digital_voice","business","router","install","other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.plan_type} onValueChange={(v) => setForm({ ...form, plan_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["flex","contract_saver","sim","digital_voice","business"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="hero" onClick={add}>Add category</Button>
        </div>
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPricingRules;