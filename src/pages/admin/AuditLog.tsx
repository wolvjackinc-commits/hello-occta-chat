import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
  actor_email?: string | null;
  target_email?: string | null;
};

const csvEscape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const AuditLog = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .in("entity", ["user_roles"])
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as Row[];

      const actorIds = Array.from(new Set(list.map(r => r.actor_user_id).filter(Boolean))) as string[];
      const targetIds = Array.from(new Set(list.map(r => r.entity_id).filter(Boolean))) as string[];
      const ids = Array.from(new Set([...actorIds, ...targetIds]));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, email").in("id", ids)
        : { data: [] as any[] };
      const emailById = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.email]));

      setRows(list.map(r => ({
        ...r,
        actor_email: r.actor_user_id ? emailById.get(r.actor_user_id) ?? null : null,
        target_email: r.entity_id ? emailById.get(r.entity_id) ?? null : null,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.actor_email ?? ""} ${r.target_email ?? ""} ${r.action} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, actionFilter, search, from, to]);

  const exportCsv = () => {
    const headers = ["Timestamp", "Action", "Actor", "Target", "Role", "Before roles", "After roles"];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach(r => {
      const m = r.metadata ?? {};
      lines.push([
        r.created_at,
        r.action,
        r.actor_email ?? r.actor_user_id ?? "",
        r.target_email ?? r.entity_id ?? "",
        m.role ?? "",
        Array.isArray(m.before_roles) ? m.before_roles.join("|") : "",
        Array.isArray(m.after_roles) ? m.after_roles.join("|") : "",
      ].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `role-audit-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl uppercase flex items-center gap-2">
            <ShieldCheck className="w-7 h-7" /> Audit log
          </h1>
          <p className="text-muted-foreground mt-1">Role and permission changes — who did what, and when.</p>
        </div>
        <Button onClick={exportCsv} disabled={!filtered.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input placeholder="Search actor, target, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="role.grant">Grant</SelectItem>
            <SelectItem value="role.revoke">Revoke</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <div className="border-4 border-foreground overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading audit entries
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No entries match your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Target</th>
                <th className="p-3">Role</th>
                <th className="p-3">Before → After</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const m = r.metadata ?? {};
                const before: string[] = Array.isArray(m.before_roles) ? m.before_roles : [];
                const after: string[] = Array.isArray(m.after_roles) ? m.after_roles : [];
                return (
                  <tr key={r.id} className="border-t-2 border-foreground/10 align-top">
                    <td className="p-3 whitespace-nowrap">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</td>
                    <td className="p-3">
                      <Badge variant={r.action === "role.grant" ? "default" : "destructive"}>{r.action.replace("role.", "")}</Badge>
                    </td>
                    <td className="p-3 break-all">{r.actor_email ?? r.actor_user_id ?? "system"}</td>
                    <td className="p-3 break-all">{r.target_email ?? r.entity_id}</td>
                    <td className="p-3"><code className="text-xs">{m.role ?? ""}</code></td>
                    <td className="p-3 text-xs">
                      <span className="text-muted-foreground">{before.join(", ") || "—"}</span>
                      <span className="mx-2">→</span>
                      <span>{after.join(", ") || "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
export { AuditLog as AdminAuditLog };