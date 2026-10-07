import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";

type Row = {
  id: string; created_at: string; postcode: string | null; address: string; speed_bucket: string | null;
  plan_term: string | null; customer_name: string | null; account_number: string | null; reason: string | null; test_session: boolean;
};

const SPEED_FIELDS = [
  ["minimum_download_mbps", "Min download"], ["normally_available_download_mbps", "Normal download"],
  ["maximum_download_mbps", "Max download"], ["advertised_download_mbps", "Advertised download"],
  ["minimum_upload_mbps", "Min upload"], ["normally_available_upload_mbps", "Normal upload"],
  ["maximum_upload_mbps", "Max upload"], ["advertised_upload_mbps", "Advertised upload"],
] as const;

function EvidenceForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, string>>({
    technology: "", retrieved_at: new Date().toISOString().slice(0, 16), provider_reference: "", staff_note: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    const evidence: Record<string, unknown> = {
      technology: f.technology, eligible_plan: row.speed_bucket,
      retrieved_at: new Date(f.retrieved_at).toISOString(),
      provider_reference: f.provider_reference || null, staff_note: f.staff_note || null,
    };
    for (const [k] of SPEED_FIELDS) evidence[k] = Number(f[k]);
    const { data, error } = await supabase.functions.invoke("admin-network-validation", {
      body: { action: "record", session_id: row.id, evidence },
    });
    setBusy(false);
    const code = (data as any)?.error ?? (error ? "request_failed" : null);
    if (code) { toast({ title: "Evidence not saved", description: String(code), variant: "destructive" }); return; }
    toast({ title: "Network verified", description: `Evidence hash ${String((data as any).evidence_sha256).slice(0, 12)}…` });
    onDone();
  };

  return (
    <div className="mt-3 grid gap-3 border-t border-border pt-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><Label>Technology</Label><Input value={f.technology} onChange={set("technology")} placeholder="FTTP / SOGEA" /></div>
        <div><Label>Eligible OCCTA plan</Label><Input value={row.speed_bucket ?? ""} readOnly /></div>
        <div className="col-span-2"><Label>Checked at</Label><Input type="datetime-local" value={f.retrieved_at} onChange={set("retrieved_at")} /></div>
        {SPEED_FIELDS.map(([k, l]) => (
          <div key={k}><Label>{l} (Mbps)</Label><Input type="number" min={0} step="0.1" value={f[k] ?? ""} onChange={set(k)} /></div>
        ))}
        <div className="col-span-2"><Label>External reference (optional)</Label><Input value={f.provider_reference} onChange={set("provider_reference")} /></div>
      </div>
      <div><Label>Staff note</Label><Textarea value={f.staff_note} onChange={set("staff_note")} rows={2} /></div>
      <Button onClick={submit} disabled={busy} className="w-fit">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record verified evidence</Button>
    </div>
  );
}

export default function NetworkValidation() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const { data, error } = await supabase.functions.invoke("admin-network-validation", { body: { action: "list" } });
    if (error || (data as any)?.error) { setErr("Could not load pending validations."); setRows([]); return; }
    setRows((data as any).sessions ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase">Network validation</h1>
          <p className="text-sm text-muted-foreground">Orders waiting for verified network evidence before contract documents can be issued.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {rows === null ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders pending network validation.</p>
      ) : rows.map((r) => (
        <div key={r.id} className="border-2 border-foreground p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="text-sm">
              <p className="font-semibold">{r.customer_name ?? "Unnamed"} {r.account_number ? `· ${r.account_number}` : ""} {r.test_session ? "· TEST" : ""}</p>
              <p>{r.address}{r.postcode ? `, ${r.postcode}` : ""}</p>
              <p className="text-muted-foreground">Plan {r.speed_bucket ?? "—"} · {r.plan_term ?? "—"} · created {new Date(r.created_at).toLocaleString("en-GB")}</p>
            </div>
            <Button size="sm" variant={open === r.id ? "secondary" : "default"} onClick={() => setOpen(open === r.id ? null : r.id)}>
              {open === r.id ? "Close" : "Record evidence"}
            </Button>
          </div>
          {open === r.id && <EvidenceForm row={r} onDone={() => { setOpen(null); load(); }} />}
        </div>
      ))}
    </div>
  );
}
