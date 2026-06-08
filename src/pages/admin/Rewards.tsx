import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Reward = {
  id: string;
  customer_id: string;
  reward_type: string;
  reward_value: number | null;
  reward_currency: string;
  status: string;
  margin_check_status: string | null;
  created_at: string;
};

const TABS = ["pending", "eligible", "approved", "issued", "reversed", "blocked"] as const;

export const AdminRewards = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [rows, setRows] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Reward | null>(null);
  const [action, setAction] = useState<null | "approve" | "reverse">(null);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("rewards")
      .select("id, customer_id, reward_type, reward_value, reward_currency, status, margin_check_status, created_at")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as Reward[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  async function submit() {
    if (!active || !action) return;
    const fn = action === "approve" ? "approve-reward" : "reverse-reward";
    const body: any = { reward_id: active.id };
    if (action === "approve" && active.margin_check_status === "red") body.override_reason = reason;
    if (action === "reverse") body.reason = reason;
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error || (data as any)?.error) {
      toast({ variant: "destructive", title: "Failed", description: (data as any)?.error || error?.message });
      return;
    }
    toast({ title: action === "approve" ? "Reward approved" : "Reward reversed" });
    setActive(null); setAction(null); setReason("");
    load();
  }

  return (
    <div className="space-y-4 p-2">
      <div>
        <h1 className="font-display uppercase text-3xl">Rewards</h1>
        <p className="text-sm text-muted-foreground">No cash withdrawal. All reward values are admin-controlled and margin-gated.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 border-2 border-foreground font-display uppercase text-xs ${tab === t ? "bg-foreground text-background" : "bg-background"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="border-4 border-foreground">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground">
            <tr><th className="text-left p-2">Customer</th><th className="text-left p-2">Type</th><th className="text-left p-2">Value</th><th className="text-left p-2">Margin</th><th className="text-left p-2">Created</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No {tab} rewards.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t-2 border-foreground">
                <td className="p-2 font-mono text-xs">{r.customer_id.slice(0, 8)}…</td>
                <td className="p-2"><Badge variant="outline">{r.reward_type}</Badge></td>
                <td className="p-2">{r.reward_value != null ? `${r.reward_currency} ${r.reward_value}` : "—"}</td>
                <td className="p-2">{r.margin_check_status ?? "—"}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-right space-x-2">
                  {["pending", "eligible"].includes(r.status) && (
                    <Button size="sm" onClick={() => { setActive(r); setAction("approve"); setReason(""); }}>Approve</Button>
                  )}
                  {!["reversed", "expired"].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => { setActive(r); setAction("reverse"); setReason(""); }}>Reverse</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!active && !!action} onOpenChange={(o) => { if (!o) { setActive(null); setAction(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{action === "approve" ? "Approve reward" : "Reverse reward"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>Type: <b>{active?.reward_type}</b></div>
            <div>Value: <b>{active?.reward_value ?? "—"}</b></div>
            <div>Margin: <b>{active?.margin_check_status ?? "—"}</b></div>
            {action === "approve" && active?.margin_check_status === "red" && (
              <div className="p-3 border-2 border-destructive">
                <p className="text-xs font-display uppercase mb-2">Red margin override (admin/super_admin only)</p>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 10 chars)" />
              </div>
            )}
            {action === "reverse" && (
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reversal reason (min 10 chars)" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActive(null); setAction(null); }}>Cancel</Button>
            <Button onClick={submit}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRewards;