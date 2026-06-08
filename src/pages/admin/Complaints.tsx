import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type Row = {
  id: string;
  complaint_reference: string;
  category: string;
  status: string;
  priority: string;
  summary: string;
  opened_at: string;
  six_week_adr_eligible_at: string;
  deadlock_issued_at: string | null;
  resolved_at: string | null;
};

export const AdminComplaints = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const q = supabase.from("complaints")
      .select("id, complaint_reference, category, status, priority, summary, opened_at, six_week_adr_eligible_at, deadlock_issued_at, resolved_at")
      .order("opened_at", { ascending: false }).limit(200);
    const { data } = await q;
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? rows : rows.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Complaints register</h1>
          <p className="text-sm text-muted-foreground">Formal complaints with six-week ADR tracking.</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all","open","investigating","waiting_customer","resolved","deadlock_issued","referred_to_adr","closed"].map(s => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} className="capitalize" onClick={() => setFilter(s)}>
              {s.replace(/_/g," ")}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No complaints match.</p>
      ) : (
        <div className="space-y-2">
          {visible.map(r => {
            const eligible = new Date(r.six_week_adr_eligible_at) < new Date();
            return (
              <div key={r.id} className="p-3 border-4 border-foreground bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-xs">{r.complaint_reference}</p>
                    <Badge className="capitalize border-2 border-foreground">{r.status.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className="capitalize">{r.category.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className="capitalize">{r.priority}</Badge>
                    {eligible && !r.resolved_at && <Badge className="border-2 border-foreground bg-destructive text-destructive-foreground">ADR-eligible</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.opened_at), "dd MMM yyyy")}</p>
                </div>
                <p className="text-sm mt-2 line-clamp-3">{r.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ADR eligible {format(new Date(r.six_week_adr_eligible_at), "dd MMM yyyy")}
                  {r.deadlock_issued_at && ` · Deadlock ${format(new Date(r.deadlock_issued_at), "dd MMM yyyy")}`}
                  {r.resolved_at && ` · Resolved ${format(new Date(r.resolved_at), "dd MMM yyyy")}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};