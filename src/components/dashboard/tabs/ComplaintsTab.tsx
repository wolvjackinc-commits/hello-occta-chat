import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ComplaintForm } from "@/components/dashboard/ComplaintForm";
import { format } from "date-fns";

type Row = {
  id: string;
  complaint_reference: string;
  category: string;
  status: string;
  summary: string;
  opened_at: string;
  six_week_adr_eligible_at: string;
};

export function ComplaintsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_customer_complaints");
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="p-6 border-4 border-foreground bg-background">
        <h3 className="font-display uppercase text-lg mb-2 flex items-center gap-2"><AlertOctagon className="w-5 h-5" /> Raising a complaint</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We aim to resolve every complaint quickly and fairly. If we cannot resolve your complaint within 6 weeks, or we issue a deadlock letter earlier, you may refer the matter to our ADR provider.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link to="/legal/complaints-code"><Button variant="outline" className="border-2 border-foreground">Read Complaints Code</Button></Link>
          <Button variant="hero" onClick={() => setShowForm((s) => !s)}><Plus className="w-4 h-4 mr-1" /> {showForm ? "Close form" : "Raise a complaint"}</Button>
        </div>
      </div>
      {showForm && (
        <div className="p-4 border-4 border-foreground bg-background">
          <ComplaintForm onSubmitted={() => { setShowForm(false); load(); }} />
        </div>
      )}
      <section>
        <h4 className="font-display uppercase mb-2 text-sm">Your complaints</h4>
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No complaints on file.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="p-3 border-2 border-foreground bg-background">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs">{r.complaint_reference}</p>
                  <Badge className="border-2 border-foreground capitalize">{r.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-sm mt-1 line-clamp-2">{r.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Opened {format(new Date(r.opened_at), "dd MMM yyyy")} · ADR eligible {format(new Date(r.six_week_adr_eligible_at), "dd MMM yyyy")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}