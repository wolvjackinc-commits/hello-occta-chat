import { useState } from "react";
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
import { Plus, Loader2 } from "lucide-react";

type Supplier = any;
type Product = any;

export const AdminSuppliers = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [supplierDialog, setSupplierDialog] = useState<{ open: boolean; row?: Supplier }>({ open: false });
  const [productDialog, setProductDialog] = useState<{ open: boolean; supplierId?: string; row?: Product }>({ open: false });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("supplier_profiles").select("*").order("supplier_name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-supplier-products", expanded],
    enabled: !!expanded,
    queryFn: async () => {
      const { data } = await (supabase as any).from("supplier_products").select("*").eq("supplier_id", expanded).order("product_name");
      return data as Product[];
    },
  });

  const saveSupplier = async (body: Supplier) => {
    const { data, error } = await supabase.functions.invoke("admin-upsert-supplier", { body });
    if (error || (data as any)?.error) {
      toast({ title: "Save failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Supplier saved" });
    setSupplierDialog({ open: false });
    qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
  };

  const saveProduct = async (body: Product) => {
    const { data, error } = await supabase.functions.invoke("admin-upsert-supplier-product", { body });
    if (error || (data as any)?.error) {
      toast({ title: "Save failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Product saved" });
    setProductDialog({ open: false });
    qc.invalidateQueries({ queryKey: ["admin-supplier-products", expanded] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Wholesale supplier profiles and product catalogue.</p>
        </div>
        <Button variant="hero" onClick={() => setSupplierDialog({ open: true })}>
          <Plus className="w-4 h-4 mr-2" /> Add supplier
        </Button>
      </div>

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Supplier</TableHead>
              <TableHead className="font-display uppercase">Type</TableHead>
              <TableHead className="font-display uppercase">Status</TableHead>
              <TableHead className="font-display uppercase">API</TableHead>
              <TableHead className="font-display uppercase">Contact</TableHead>
              <TableHead className="font-display uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6">Loading…</TableCell></TableRow>
            ) : (suppliers ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No suppliers yet.</TableCell></TableRow>
            ) : suppliers!.map((s) => (
              <>
                <TableRow key={s.id} className="border-b border-foreground/10">
                  <TableCell className="font-medium">{s.supplier_name}</TableCell>
                  <TableCell className="capitalize text-xs">{s.supplier_type}</TableCell>
                  <TableCell><Badge className="border-2 border-foreground capitalize">{s.status}</Badge></TableCell>
                  <TableCell className="capitalize text-xs">{s.api_mode}</TableCell>
                  <TableCell className="text-xs">{s.contact_name ?? ""} {s.contact_email ? `· ${s.contact_email}` : ""}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                      {expanded === s.id ? "Hide products" : "Products"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSupplierDialog({ open: true, row: s })}>Edit</Button>
                  </TableCell>
                </TableRow>
                {expanded === s.id && (
                  <TableRow key={`${s.id}-prod`}>
                    <TableCell colSpan={6} className="bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display text-sm">Products</h3>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled title="Coming in Phase 4">Upload price-book</Button>
                          <Button size="sm" variant="hero" onClick={() => setProductDialog({ open: true, supplierId: s.id })}>
                            <Plus className="w-3 h-3 mr-1" /> Add product
                          </Button>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-foreground/40">
                            <TableHead className="text-xs uppercase">Product</TableHead>
                            <TableHead className="text-xs uppercase">Service</TableHead>
                            <TableHead className="text-xs uppercase">Tech</TableHead>
                            <TableHead className="text-xs uppercase">Monthly net</TableHead>
                            <TableHead className="text-xs uppercase">Active</TableHead>
                            <TableHead className="text-xs uppercase text-right">Edit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(products ?? []).length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-xs">No products.</TableCell></TableRow>
                          ) : products!.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{p.product_name}</TableCell>
                              <TableCell className="text-xs">{p.service_type}</TableCell>
                              <TableCell className="text-xs">{p.technology ?? "—"}</TableCell>
                              <TableCell className="text-xs">{p.supplier_monthly_net != null ? `£${Number(p.supplier_monthly_net).toFixed(2)}` : "—"}</TableCell>
                              <TableCell className="text-xs">{p.active ? "Yes" : "Paused"}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => setProductDialog({ open: true, supplierId: s.id, row: p })}>Edit</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>

      <SupplierDialog state={supplierDialog} onClose={() => setSupplierDialog({ open: false })} onSave={saveSupplier} />
      <ProductDialog state={productDialog} onClose={() => setProductDialog({ open: false })} onSave={saveProduct} />
    </div>
  );
};

const SupplierDialog = ({ state, onClose, onSave }: any) => {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useState(() => { setForm(state.row ?? { supplier_type: "broadband", status: "active", api_mode: "manual", reverse_charge_possible: false }); });
  // re-init on open
  if (state.open && form && form.__id !== (state.row?.id ?? "new")) {
    const init = state.row ?? { supplier_type: "broadband", status: "active", api_mode: "manual", reverse_charge_possible: false };
    setForm({ ...init, __id: state.row?.id ?? "new" });
  }
  const F = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.row ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Supplier name</Label><Input value={form.supplier_name ?? ""} onChange={(e) => F("supplier_name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={form.supplier_type} onValueChange={(v) => F("supplier_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["broadband","sim","voice","business","mixed"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => F("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["active","paused","testing","archived"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Contact name</Label><Input value={form.contact_name ?? ""} onChange={(e) => F("contact_name", e.target.value)} /></div>
            <div><Label>Contact email</Label><Input value={form.contact_email ?? ""} onChange={(e) => F("contact_email", e.target.value)} /></div>
            <div><Label>Contact phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => F("contact_phone", e.target.value)} /></div>
            <div><Label>Portal URL</Label><Input value={form.portal_url ?? ""} onChange={(e) => F("portal_url", e.target.value)} /></div>
            <div><Label>API mode</Label>
              <Select value={form.api_mode} onValueChange={(v) => F("api_mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["manual","testing","live"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2"><Switch checked={!!form.reverse_charge_possible} onCheckedChange={(v) => F("reverse_charge_possible", v)} /><Label>Reverse charge possible</Label></div>
          </div>
          <div><Label>VAT treatment notes</Label><Textarea rows={2} value={form.vat_treatment_notes ?? ""} onChange={(e) => F("vat_treatment_notes", e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => F("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="hero" disabled={saving} onClick={async () => {
            setSaving(true); const { __id, ...payload } = form; await onSave(state.row ? { ...payload, id: state.row.id } : payload); setSaving(false);
          }}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProductDialog = ({ state, onClose, onSave }: any) => {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  if (state.open && form.__id !== (state.row?.id ?? `new-${state.supplierId}`)) {
    const init = state.row ?? { supplier_id: state.supplierId, service_type: "broadband", supplier_vat_rate: 20, reverse_charge: false, active: true };
    setForm({ ...init, __id: state.row?.id ?? `new-${state.supplierId}` });
  }
  const F = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.row ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Product name</Label><Input value={form.product_name ?? ""} onChange={(e) => F("product_name", e.target.value)} /></div>
            <div><Label>Service type</Label>
              <Select value={form.service_type} onValueChange={(v) => F("service_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["broadband","sim","digital_voice","business","router","install","other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Supplier product ID</Label><Input value={form.supplier_product_id ?? ""} onChange={(e) => F("supplier_product_id", e.target.value)} /></div>
            <div><Label>Technology</Label>
              <Select value={form.technology ?? "OTHER"} onValueChange={(v) => F("technology", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["FTTP","FTTC","SOGEA","ADSL","SIM","VOIP","OTHER"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Download speed (label)</Label><Input value={form.download_speed_label ?? ""} onChange={(e) => F("download_speed_label", e.target.value)} /></div>
            <div><Label>Upload speed (label)</Label><Input value={form.upload_speed_label ?? ""} onChange={(e) => F("upload_speed_label", e.target.value)} /></div>
            {["supplier_monthly_net","supplier_setup_net","supplier_router_net","supplier_delivery_net","supplier_install_net","supplier_cease_fee_net","supplier_vat_rate"].map((k) => (
              <div key={k}><Label className="capitalize">{k.replace(/_/g," ")}</Label>
                <Input type="number" step="0.01" value={form[k] ?? ""} onChange={(e) => F(k, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            ))}
            <div className="flex items-end gap-2"><Switch checked={!!form.reverse_charge} onCheckedChange={(v) => F("reverse_charge", v)} /><Label>Reverse charge</Label></div>
            <div className="flex items-end gap-2"><Switch checked={!!form.active} onCheckedChange={(v) => F("active", v)} /><Label>Active</Label></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => F("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="hero" disabled={saving} onClick={async () => {
            setSaving(true); const { __id, ...payload } = form; await onSave(state.row ? { ...payload, id: state.row.id } : payload); setSaving(false);
          }}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminSuppliers;