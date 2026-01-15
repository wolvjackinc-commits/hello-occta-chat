import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const AdminCompliance = () => {
  const { data } = useQuery({
    queryKey: ["admin-compliance"],
    queryFn: async () => {
      const [audit, comms] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("communications_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return { audit: audit.data ?? [], comms: comms.data ?? [] };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Compliance</h1>
        <p className="text-muted-foreground">Audit trail and communication logs.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Audit log</h2>
          <div className="space-y-3">
            {data?.audit.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{entry.action} {entry.table_name}</div>
                <div className="text-xs text-muted-foreground">{entry.created_at}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Communications log</h2>
          <div className="space-y-3">
            {data?.comms.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{entry.channel} · {entry.status}</div>
                <div className="text-xs text-muted-foreground">{entry.to_address}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
