import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

type Row = any;

const BUCKETS = ["essential","superfast","ultrafast","gigabit"] as const;

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; continue; }
      if (ch === "," && !q) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h] = (cells[i] ?? "").trim());
    return row;
  });
}

export function AdminSuppliersGiacomImport() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNetwork, setFilterNetwork] = useState("");
  const [filterBucket, setFilterBucket] = useState("");
  const [filterActive, setFilterActive] = useState<"all"|"active"|"inactive">("all");
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profile } = await (supabase as any).from("supplier_profiles").select("id").eq("supplier_name","Giacom").maybeSingle();
    if (!profile) { setRows([]); setLoading(false); return; }
    const { data } = await (supabase as any).from("supplier_products").select("*").eq("supplier_id", profile.id).order("network").order("download_speed_mbps");
    setRows(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (!filterNetwork || (r.network ?? "").toLowerCase().includes(filterNetwork.toLowerCase())) &&
    (!filterBucket || r.bucket_hint === filterBucket) &&
    (filterActive === "all" || (filterActive === "active" ? r.active : !r.active))
  ), [rows, filterNetwork, filterBucket, filterActive]);

  const toggle = async (id: string, field: "active"|"quote_only", value: boolean) => {
    const { error } = await (supabase as any).from("supplier_products").update({ [field]: value }).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: `${field} = ${value}` }); load(); }
  };

  const updateNote = async (id: string, notes: string) => {
    await (supabase as any).from("supplier_products").update({ notes }).eq("id", id);
    toast({ title: "Notes saved" });
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const parsed = parseCsv(csv);
      if (!parsed.length) throw new Error("No rows parsed");
      const { data, error } = await supabase.functions.invoke("admin-import-supplier-products", {
        body: { supplier_name: "Giacom", rows: parsed },
      });
      if (error) throw error;
      toast({ title: "Import complete", description: `Inserted ${(data as any).inserted}, updated ${(data as any).updated}` });
      setCsv(""); load();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Giacom Broadband Products</h1>
        <p className="text-sm text-muted-foreground mt-1">Internal supplier catalogue. Rows imported as <strong>inactive</strong>. Activate explicitly to expose to the resolver. Supplier costs and IDs never appear on customer-facing pages.</p>
      </header>

      <section className="border-4 border-foreground p-5 space-y-3">
        <h2 className="font-display uppercase">Filters</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>Network</Label><Input value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)} placeholder="BT, CityFibre…" className="mt-1" /></div>
          <div><Label>Bucket</Label>
            <select value={filterBucket} onChange={(e) => setFilterBucket(e.target.value)} className="mt-1 w-full border-2 border-foreground bg-background p-2">
              <option value="">All</option>{BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div><Label>Status</Label>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="mt-1 w-full border-2 border-foreground bg-background p-2">
              <option value="all">All</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="border-4 border-foreground p-5 space-y-3">
        <h2 className="font-display uppercase">CSV import</h2>
        <p className="text-xs text-muted-foreground">Allowlist headers: supplier_product_id, product_name, network, technology, download_speed_mbps, upload_speed_mbps, min_term_months, supplier_monthly_net, connection_fee_net, migration_fee_net, care_level, care_level_uplift_net, router_compatible, router_required, router_notes, etf_applies, disconnect_fee_in_12m_net, disconnect_fee_after_12m_net, bucket_hint, notes, source_document, source_page, source_section. Imported rows are always inactive until reviewed.</p>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} placeholder="Paste CSV here…" className="font-mono text-xs" />
        <Button onClick={runImport} disabled={!csv.trim() || importing}>{importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</> : "Import CSV"}</Button>
      </section>

      <section className="border-4 border-foreground">
        <div className="p-4 border-b-2 border-foreground/20 flex items-center justify-between">
          <h2 className="font-display uppercase">Products ({filtered.length})</h2>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        </div>
        {loading ? (
          <div className="p-6 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No products. Import the Giacom ratecard CSV above to begin.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-foreground/20">
                <tr className="text-left">
                  <th className="p-3">Network</th><th className="p-3">Product</th><th className="p-3">Speed</th>
                  <th className="p-3">Tech</th><th className="p-3">Term</th><th className="p-3">Bucket</th>
                  <th className="p-3">Risk</th><th className="p-3">Active</th><th className="p-3">Quote-only</th><th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/10">
                    <td className="p-3">{r.network ?? "—"}</td>
                    <td className="p-3"><div className="font-medium">{r.product_name}</div><div className="text-xs text-muted-foreground">{r.supplier_product_id}</div></td>
                    <td className="p-3 font-mono">{r.download_speed_mbps ?? "?"}/{r.upload_speed_mbps ?? "?"}</td>
                    <td className="p-3">{r.technology ?? "—"}</td>
                    <td className="p-3">{r.min_term_months ?? "—"}m</td>
                    <td className="p-3">{r.bucket_hint ? <Badge variant="outline">{r.bucket_hint}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3">{(r.etf_applies || (r.disconnect_fee_in_12m_net ?? 0) > 0) ? <Badge className="bg-red-500/10 text-red-700 border-red-500"><AlertTriangle className="w-3 h-3 mr-1" />ETF</Badge> : "—"}</td>
                    <td className="p-3"><Button size="sm" variant={r.active ? "default" : "outline"} onClick={() => toggle(r.id, "active", !r.active)}>{r.active ? "Active" : "Inactive"}</Button></td>
                    <td className="p-3"><Button size="sm" variant={r.quote_only ? "default" : "outline"} onClick={() => toggle(r.id, "quote_only", !r.quote_only)}>{r.quote_only ? "Quote-only" : "Standard"}</Button></td>
                    <td className="p-3 min-w-[240px]"><Input defaultValue={r.notes ?? ""} onBlur={(e) => updateNote(r.id, e.target.value)} placeholder="Add note…" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}