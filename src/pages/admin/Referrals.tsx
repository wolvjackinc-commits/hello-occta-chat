import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Code = { id: string; code: string; status: string; customer_id: string | null; usage_count: number; created_at: string };
type Event = { id: string; event_type: string; referral_code_id: string; created_at: string };
type Flag = { id: string; flag_type: string; severity: string; status: string; created_at: string };

export const AdminReferrals = () => {
  const [codes, setCodes] = useState<Code[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);

  async function load() {
    const [c, e, f] = await Promise.all([
      supabase.from("referral_codes").select("id, code, status, customer_id, usage_count, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("referral_events").select("id, event_type, referral_code_id, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("fraud_flags").select("id, flag_type, severity, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    ]);
    setCodes((c.data ?? []) as Code[]);
    setEvents((e.data ?? []) as Event[]);
    setFlags((f.data ?? []) as Flag[]);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await supabase.from("referral_codes").update({ status }).eq("id", id);
    load();
  }

  return (
    <div className="space-y-6 p-2">
      <div>
        <h1 className="font-display uppercase text-3xl">Referrals</h1>
        <p className="text-sm text-muted-foreground">Codes, events, and fraud flags. IP/UA are stored hashed only.</p>
      </div>

      <section>
        <h2 className="font-display uppercase mb-2">Codes</h2>
        <div className="border-4 border-foreground">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b-2 border-foreground"><tr><th className="text-left p-2">Code</th><th className="text-left p-2">Status</th><th className="text-left p-2">Uses</th><th className="text-left p-2">Created</th><th></th></tr></thead>
            <tbody>
              {codes.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No referral codes.</td></tr>}
              {codes.map((c) => (
                <tr key={c.id} className="border-t-2 border-foreground">
                  <td className="p-2 font-mono">{c.code}</td>
                  <td className="p-2"><Badge variant="outline">{c.status}</Badge></td>
                  <td className="p-2">{c.usage_count}</td>
                  <td className="p-2">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right space-x-2">
                    {c.status === "active" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "paused")}>Pause</Button>}
                    {c.status !== "blocked" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "blocked")}>Block</Button>}
                    {c.status !== "active" && <Button size="sm" onClick={() => setStatus(c.id, "active")}>Reactivate</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display uppercase mb-2">Recent events</h2>
        <div className="border-4 border-foreground p-3 space-y-1 text-sm">
          {events.length === 0 && <p className="text-muted-foreground">No events yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex justify-between border-b border-foreground/20 py-1">
              <span>{e.event_type}</span>
              <span className="text-muted-foreground text-xs">{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display uppercase mb-2">Open fraud flags</h2>
        <div className="border-4 border-foreground p-3 space-y-1 text-sm">
          {flags.length === 0 && <p className="text-muted-foreground">No open flags.</p>}
          {flags.map((f) => (
            <div key={f.id} className="flex justify-between border-b border-foreground/20 py-1">
              <span><Badge variant="destructive">{f.severity}</Badge> {f.flag_type}</span>
              <span className="text-muted-foreground text-xs">{new Date(f.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminReferrals;