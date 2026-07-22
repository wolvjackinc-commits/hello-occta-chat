import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Play, Search, Download, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Delivery = {
  id: string;
  source: string;
  event_type: string | null;
  external_reference: string | null;
  status: string;
  http_status: number | null;
  error_message: string | null;
  payload: unknown;
  headers: unknown;
  result: unknown;
  replay_count: number;
  last_replayed_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  received: "bg-slate-100 text-slate-800 border-slate-400",
  processed: "bg-emerald-100 text-emerald-900 border-emerald-600",
  failed: "bg-red-100 text-red-900 border-red-600",
  unauthorized: "bg-amber-100 text-amber-900 border-amber-600",
};

export default function AdminWebhookMonitor() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<Record<string, { before: string; after: string; http?: number; error?: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as Delivery[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        r.source.toLowerCase().includes(q) ||
        (r.event_type ?? "").toLowerCase().includes(q) ||
        (r.external_reference ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    const acc = { total: rows.length, processed: 0, failed: 0, unauthorized: 0, received: 0 };
    rows.forEach((r) => {
      if (r.status in acc) (acc as any)[r.status]++;
    });
    return acc;
  }, [rows]);

  const replay = async (row: Delivery) => {
    if (!confirm(`Replay ${row.source} event ${row.external_reference || row.id}? This will reprocess the stored payload.`)) return;
    setReplaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-webhook-replay", {
        body: { delivery_id: row.id },
      });
      if (error) throw error;
      toast({ title: "Replay submitted", description: `Result: ${(data as any)?.status ?? "ok"}` });
      await load();
    } catch (e: any) {
      toast({ title: "Replay failed", description: e.message, variant: "destructive" });
    } finally {
      setReplaying(false);
    }
  };

  const exportCsv = () => {
    const rows = filtered;
    const headers = ["id","source","event_type","external_reference","status","http_status","replay_count","last_replayed_at","error_message","created_at"];
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhook-deliveries-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group only FAILED (or unauthorized) deliveries by event_type for bulk replay.
  const failedGroups = useMemo(() => {
    const groups: Record<string, Delivery[]> = {};
    rows.forEach((r) => {
      if (r.status !== "failed" && r.status !== "unauthorized") return;
      const key = `${r.source}::${r.event_type || "unknown"}`;
      (groups[key] ||= []).push(r);
    });
    return groups;
  }, [rows]);

  const runBulkReplay = async (groupKey: string) => {
    const group = failedGroups[groupKey] || [];
    if (group.length === 0) return;
    if (!confirm(`Replay ${group.length} failed ${groupKey} deliveries?`)) return;
    setBulkRunning(true);
    const next = { ...bulkResults };
    for (const row of group) {
      next[row.id] = { before: row.status, after: "…" };
      setBulkResults({ ...next });
      try {
        const { data, error } = await supabase.functions.invoke("admin-webhook-replay", { body: { delivery_id: row.id } });
        if (error) throw error;
        const http = (data as any)?.status;
        // Fetch fresh row to see new status.
        const { data: fresh } = await supabase.from("webhook_deliveries").select("status").eq("id", row.id).maybeSingle();
        next[row.id] = { before: row.status, after: (fresh?.status as string) || "unknown", http };
      } catch (e: any) {
        next[row.id] = { before: row.status, after: "error", error: e.message };
      }
      setBulkResults({ ...next });
    }
    setBulkRunning(false);
    await load();
    toast({ title: "Bulk replay complete", description: `${group.length} deliveries reprocessed` });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Webhook Monitor</h1>
          <p className="text-sm text-muted-foreground">Every incoming webhook (Worldpay etc.) with replay for debugging.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={Object.keys(failedGroups).length === 0}>
            <Layers className="w-4 h-4 mr-1" /> Bulk replay
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["total","processed","received","failed","unauthorized"] as const).map((k) => (
          <Card key={k} className="border-2 border-foreground p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
            <div className="text-2xl font-black">{(stats as any)[k]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search source, event, reference…" className="pl-8" />
        </div>
        {(["all","received","processed","failed","unauthorized"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="uppercase"
          >{s}</Button>
        ))}
      </div>

      <Card className="border-2 border-foreground overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px_140px] px-3 py-2 border-b-2 border-foreground bg-muted/40 text-xs uppercase font-black tracking-wider">
          <div>Source · Event · Reference</div>
          <div>Status</div>
          <div>HTTP</div>
          <div>Replays</div>
          <div>Received</div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No deliveries to show.</div>
          ) : filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full grid grid-cols-[minmax(0,1fr)_120px_120px_120px_140px] px-3 py-2 border-b border-border hover:bg-muted text-left text-sm"
            >
              <div className="min-w-0">
                <div className="font-bold truncate">{r.source} · {r.event_type || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{r.external_reference || r.id}</div>
              </div>
              <div><Badge className={`border-2 ${STATUS_STYLES[r.status] || "bg-muted"}`}>{r.status}</Badge></div>
              <div className="text-xs">{r.http_status ?? "—"}</div>
              <div className="text-xs">{r.replay_count}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GB")}</div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">
              {selected?.source} · {selected?.event_type || "event"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="flex-1 overflow-auto pr-4">
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Reference:</span> <span className="font-mono">{selected.external_reference || "—"}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> {selected.status} ({selected.http_status ?? "—"})</div>
                  <div><span className="text-muted-foreground">Replays:</span> {selected.replay_count}</div>
                  <div><span className="text-muted-foreground">Received:</span> {new Date(selected.created_at).toLocaleString("en-GB")}</div>
                </div>
                {selected.error_message && (
                  <div className="border-2 border-red-500 bg-red-50 p-2 text-red-900">{selected.error_message}</div>
                )}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider mb-1">Payload</div>
                  <pre className="bg-muted p-3 border-2 border-foreground text-xs overflow-auto max-h-64">{JSON.stringify(selected.payload, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider mb-1">Result</div>
                  <pre className="bg-muted p-3 border-2 border-foreground text-xs overflow-auto max-h-40">{JSON.stringify(selected.result, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider mb-1">Headers</div>
                  <pre className="bg-muted p-3 border-2 border-foreground text-xs overflow-auto max-h-40">{JSON.stringify(selected.headers, null, 2)}</pre>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {selected && (
              <Button onClick={() => replay(selected)} disabled={replaying}>
                {replaying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Replay event
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Bulk replay failed deliveries</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto pr-4">
            {Object.keys(failedGroups).length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No failed or unauthorized deliveries in the current window.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(failedGroups).map(([key, group]) => (
                  <div key={key} className="border-2 border-foreground">
                    <div className="flex items-center justify-between p-3 bg-muted/40 border-b-2 border-foreground">
                      <div>
                        <div className="font-black uppercase text-sm tracking-tight">{key}</div>
                        <div className="text-xs text-muted-foreground">{group.length} failed deliver{group.length === 1 ? "y" : "ies"}</div>
                      </div>
                      <Button size="sm" onClick={() => runBulkReplay(key)} disabled={bulkRunning}>
                        {bulkRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                        Replay group
                      </Button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_60px] px-3 py-1 border-b border-border text-[10px] uppercase tracking-widest font-black bg-background">
                      <div>Reference</div>
                      <div>Before</div>
                      <div>After</div>
                      <div>HTTP</div>
                    </div>
                    {group.map((r) => {
                      const res = bulkResults[r.id];
                      const after = res?.after ?? "—";
                      const improved = res && res.before !== "processed" && after === "processed";
                      return (
                        <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_100px_100px_60px] px-3 py-1.5 border-b border-border text-xs">
                          <div className="truncate font-mono">{r.external_reference || r.id}</div>
                          <div><Badge className={`border-2 text-[10px] ${STATUS_STYLES[res?.before ?? r.status] || "bg-muted"}`}>{res?.before ?? r.status}</Badge></div>
                          <div>
                            {after === "…" ? <Loader2 className="w-3 h-3 animate-spin" /> :
                              <Badge className={`border-2 text-[10px] ${STATUS_STYLES[after] || "bg-muted"} ${improved ? "font-black" : ""}`}>{after}</Badge>}
                          </div>
                          <div className="text-xs">{res?.http ?? "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkResults({}); setBulkOpen(false); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}