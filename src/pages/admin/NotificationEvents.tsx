import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";

type Row = {
  id: string;
  event_type: string;
  subject: string | null;
  recipients: string[] | null;
  success: boolean;
  error_message: string | null;
  reference_url: string | null;
  metadata: any;
  created_at: string;
};

export default function AdminNotificationEvents() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_notification_events" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => { load(); }, []);

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.event_type))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.event_type !== typeFilter) return false;
      if (statusFilter === "success" && !r.success) return false;
      if (statusFilter === "failed" && r.success) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (r.subject ?? "").toLowerCase().includes(q) ||
        r.event_type.toLowerCase().includes(q) ||
        (r.recipients ?? []).some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [rows, typeFilter, statusFilter, query]);

  const stats = useMemo(() => ({
    total: filtered.length,
    success: filtered.filter((r) => r.success).length,
    failed: filtered.filter((r) => !r.success).length,
    uniqueTypes: new Set(filtered.map((r) => r.event_type)).size,
  }), [filtered]);

  const exportCsv = () => {
    const headers = ["created_at","event_type","subject","recipients","success","error_message","reference_url"];
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join(";") : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers.join(","),
      ...filtered.map((r) => headers.map((h) => esc((r as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notification-events-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Notification Events</h1>
          <p className="text-sm text-muted-foreground">Every admin alert email dispatched, with recipients and status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["total","success","failed","uniqueTypes"] as const).map((k) => (
          <Card key={k} className="border-2 border-foreground p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
            <div className="text-2xl font-black">{(stats as any)[k]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, type, recipient…" className="pl-8" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border-2 border-foreground bg-background px-2 py-1 text-sm uppercase">
          <option value="all">All types</option>
          {types.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        {(["all","success","failed"] as const).map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="uppercase">{s}</Button>
        ))}
      </div>

      <Card className="border-2 border-foreground overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_160px_140px] px-3 py-2 border-b-2 border-foreground bg-muted/40 text-xs uppercase font-black tracking-wider">
          <div>Event · Subject</div>
          <div>Status</div>
          <div>Recipients</div>
          <div>Sent</div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No notification events.</div>
          ) : filtered.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_120px_160px_140px] px-3 py-2 border-b border-border text-sm items-center">
              <div className="min-w-0">
                <div className="font-bold truncate">{r.event_type}</div>
                <div className="text-xs text-muted-foreground truncate">{r.subject || "—"}</div>
                {r.reference_url && (
                  <a href={r.reference_url} className="text-[10px] underline text-muted-foreground truncate block">{r.reference_url}</a>
                )}
              </div>
              <div>
                <Badge className={`border-2 ${r.success ? "bg-emerald-100 text-emerald-900 border-emerald-600" : "bg-red-100 text-red-900 border-red-600"}`}>
                  {r.success ? "sent" : "failed"}
                </Badge>
                {r.error_message && <div className="text-[10px] text-red-700 mt-1 truncate">{r.error_message}</div>}
              </div>
              <div className="text-xs truncate">{(r.recipients ?? []).join(", ") || "—"}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </ScrollArea>
      </Card>
    </div>
  );
}