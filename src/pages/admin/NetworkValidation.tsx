import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type QueueRow = {
  id: string;
  session_id: string;
  quote_request_id: string | null;
  status: string;
  address_snapshot: Record<string, unknown>;
  speed_bucket: string | null;
  plan_term: string | null;
  requested_at: string;
  quote_request_reference: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
};

type Supplier = { supplier_name: string };

type FormState = {
  source_label: string;
  source_reference: string;
  address_reference: string;
  technology: string;
  min_down: string;
  normal_down: string;
  max_down: string;
  advertised_down: string;
  min_up: string;
  normal_up: string;
  max_up: string;
  advertised_up: string;
};

const emptyForm: FormState = {
  source_label: "",
  source_reference: "",
  address_reference: "",
  technology: "",
  min_down: "",
  normal_down: "",
  max_down: "",
  advertised_down: "",
  min_up: "",
  normal_up: "",
  max_up: "",
  advertised_up: "",
};

export default function NetworkValidation() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const addressLabel = useMemo(() => {
    if (!selected) return "";
    const a = selected.address_snapshot ?? {};
    return [
      a.address_line_1,
      a.address_line_2,
      a.town,
      a.county,
      selected.postcode,
    ].filter(Boolean).join(", ");
  }, [selected]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: queue, error: queueError }, { data: supplierRows, error: supplierError }] = await Promise.all([
        (supabase as any).from("network_validation_queue").select("*").order("requested_at", { ascending: true }),
        (supabase as any)
          .from("supplier_profiles")
          .select("supplier_name,id,status,supplier_products!inner(id,service_type,active)")
          .eq("status", "active")
          .eq("supplier_products.service_type", "broadband")
          .eq("supplier_products.active", true)
          .order("supplier_name"),
      ]);
      if (queueError) throw queueError;
      if (supplierError) throw supplierError;
      setRows((queue ?? []) as QueueRow[]);
      const seen = new Set<string>();
      setSuppliers(((supplierRows ?? []) as any[])
        .filter((x) => x?.supplier_name && !seen.has(x.supplier_name) && seen.add(x.supplier_name))
        .map((x) => ({ supplier_name: x.supplier_name })));
    } catch (e) {
      toast({ title: "Could not load network validation queue", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const choose = (row: QueueRow) => {
    setSelected(row);
    setForm({
      ...emptyForm,
      source_label: suppliers[0]?.supplier_name ?? "",
      technology: row.speed_bucket === "essential" ? "SOGEA / FTTP" : "FTTP",
    });
  };

  const set = (key: keyof FormState, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const num = (value: string) => Number(value);

  const submit = async () => {
    if (!selected) return;
    const required = [
      form.source_label, form.source_reference, form.technology,
      form.min_down, form.normal_down, form.max_down, form.advertised_down,
      form.min_up, form.normal_up, form.max_up, form.advertised_up,
    ];
    if (required.some((v) => !String(v).trim())) {
      toast({ title: "Complete every required evidence field", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-record-network-validation", {
        body: {
          session_id: selected.session_id,
          source_label: form.source_label,
          source_reference: form.source_reference,
          address_reference: form.address_reference || null,
          technology: form.technology,
          speed_matrix: {
            minimum_download_mbps: num(form.min_down),
            normally_available_download_mbps: num(form.normal_down),
            maximum_download_mbps: num(form.max_down),
            advertised_download_mbps: num(form.advertised_down),
            minimum_upload_mbps: num(form.min_up),
            normally_available_upload_mbps: num(form.normal_up),
            maximum_upload_mbps: num(form.max_up),
            advertised_upload_mbps: num(form.advertised_up),
          },
        },
      });
      if (error || !data?.ok) throw new Error(data?.message || data?.error || error?.message || "validation_failed");

      toast({ title: "Network evidence recorded", description: "This order can now continue to contract generation." });
      setSelected(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast({ title: "Validation could not be recorded", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Network Validation</h1>
          <p className="text-sm text-muted-foreground">
            Orders waiting for exact-address network evidence before a binding broadband contract can be issued.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm">
            Do not enter estimates or marketing speeds. Record only current evidence obtained for the customer's exact installation address.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" /> No orders are waiting for network validation.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <button key={row.id} onClick={() => choose(row)}
                className="w-full border-2 border-foreground/20 p-3 text-left hover:border-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{row.full_name || "Customer"} · {row.quote_request_reference || row.session_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.postcode, row.speed_bucket, row.plan_term].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <Card className="border-4 border-foreground p-5 space-y-4">
          <div>
            <h2 className="font-display text-xl">Record verified network evidence</h2>
            <p className="text-sm text-muted-foreground mt-1">{addressLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Requested plan: {selected.speed_bucket || "—"} · {selected.plan_term || "—"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Active supplier
              <select value={form.source_label} onChange={(e) => set("source_label", e.target.value)}
                className="mt-1 h-10 w-full border-2 border-foreground bg-background px-3">
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.supplier_name} value={s.supplier_name}>{s.supplier_name}</option>)}
              </select>
            </label>
            <label className="text-sm">Supplier / network evidence reference
              <Input className="mt-1" value={form.source_reference} onChange={(e) => set("source_reference", e.target.value)} placeholder="Availability/orderability reference" />
            </label>
            <label className="text-sm">Address reference (optional)
              <Input className="mt-1" value={form.address_reference} onChange={(e) => set("address_reference", e.target.value)} placeholder="UPRN / NAD / supplier address reference" />
            </label>
            <label className="text-sm">Technology
              <Input className="mt-1" value={form.technology} onChange={(e) => set("technology", e.target.value)} placeholder="FTTP / SOGEA / other verified technology" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["min_down","Minimum download"],
              ["normal_down","Normally available download"],
              ["max_down","Maximum download"],
              ["advertised_down","Advertised download"],
              ["min_up","Minimum upload"],
              ["normal_up","Normally available upload"],
              ["max_up","Maximum upload"],
              ["advertised_up","Advertised upload"],
            ].map(([key,label]) => (
              <label key={key} className="text-sm">{label} (Mbps)
                <Input className="mt-1" type="number" min="0.1" step="0.1"
                  value={form[key as keyof FormState]}
                  onChange={(e) => set(key as keyof FormState, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving…" : "Record evidence"}</Button>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
