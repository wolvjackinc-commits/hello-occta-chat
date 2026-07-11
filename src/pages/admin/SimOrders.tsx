import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminEmptyState, AdminStatusBadge, IncludeArchivedToggle, SafetyLabel, isArchivedLike } from "@/components/admin/primitives";
import { Inbox } from "lucide-react";

export function AdminSimOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [iccid, setIccid] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [tracking, setTracking] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [smdp, setSmdp] = useState("");
  const [liveDate, setLiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [anchorDay, setAnchorDay] = useState<number>(new Date().getUTCDate());
  const { toast } = useToast();

  const load = async () => {
    const { data } = await (supabase as any).from("sim_orders").select("*").order("created_at", { ascending: false }).limit(200);
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const visibleOrders = orders.filter((o) => includeArchived || !isArchivedLike(o.status));

  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!selected) return;
    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error, data } = await supabase.functions.invoke("admin-sim-action", {
      body: { action, order_id: selected.id, payload },
      headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : undefined,
    });
    setBusy(false);
    if (error) return toast({ title: action, description: error.message, variant: "destructive" });
    if ((data as any)?.error) return toast({ title: action, description: (data as any).error, variant: "destructive" });
    toast({ title: `Applied ${action}` });
    load();
    setSelected(null);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display uppercase">SIM orders</h1>
        <IncludeArchivedToggle
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
          id="sim-orders-include-archived"
          label="Include cancelled/test orders"
        />
      </div>
      <div className="card-brutal bg-card p-3">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase font-display">
            <tr className="border-b-2 border-foreground">
              <th className="text-left p-2">Order</th><th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Plan</th><th className="text-left p-2">Payment</th>
              <th className="text-left p-2">Status</th><th className="text-left p-2">Live</th><th />
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o) => (
              <tr key={o.id} className="border-b border-foreground/20">
                <td className="p-2 font-mono text-xs">{o.order_number}</td>
                <td className="p-2">{o.full_name}<br /><span className="text-xs text-muted-foreground">{o.email}</span></td>
                <td className="p-2">{o.plan_name_snapshot}</td>
                <td className="p-2">{o.payment_method}</td>
                <td className="p-2"><AdminStatusBadge status={o.status || "unknown"} /></td>
                <td className="p-2 text-xs">{o.service_live_date ?? "—"}</td>
                <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(o)}>Manage</Button></td>
              </tr>
            ))}
            {visibleOrders.length === 0 && (
              <tr><td colSpan={7} className="p-4">
                <AdminEmptyState
                  icon={<Inbox className="h-8 w-8" />}
                  title="No SIM orders"
                  message={orders.length === 0 ? "SIM orders will appear here once customers order." : "All orders are cancelled/test. Toggle above to include them."}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{selected?.order_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="border-2 border-foreground p-3">
                <p><strong>Customer:</strong> {selected.full_name} ({selected.email})</p>
                <p><strong>Plan:</strong> {selected.plan_name_snapshot}</p>
                <p><strong>SIM type:</strong> {selected.sim_type}</p>
                <p><strong>Number choice:</strong> {selected.number_choice}</p>
                <p><strong>Payment:</strong> {selected.payment_method}</p>
                <p><strong>Status:</strong> {selected.status}</p>
                <p><strong>First payment paid (pence):</strong> {selected.first_payment_paid_minor}</p>
                {selected.iccid && <p><strong>ICCID:</strong> {selected.iccid}</p>}
                {selected.provisioned_msisdn && <p><strong>Provisioned MSISDN:</strong> {selected.provisioned_msisdn}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => invoke("approve")}>Approve</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("on_hold", { reason: "Manual hold" })}>On hold</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("cancel", { reason: "Admin cancel" })} title="Cancels this SIM order — cannot be undone">Cancel</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("fail")} title="Marks the order as failed">Mark failed</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("pac_required")}>Ask for PAC</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("stac_required")}>Ask for STAC</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("port_requested")}>Port requested</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("port_scheduled")}>Port scheduled</Button>
                <Button variant="outline" disabled={busy} onClick={() => invoke("port_completed")}>Port completed</Button>
              </div>

              <div className="border-t-2 border-foreground/20 pt-3 grid grid-cols-2 gap-2">
                <div><Label>ICCID</Label><Input value={iccid} onChange={(e) => setIccid(e.target.value)} /></div>
                <div><Label>Provisioned MSISDN</Label><Input value={msisdn} onChange={(e) => setMsisdn(e.target.value)} /></div>
                <div className="col-span-2"><Button variant="hero" size="sm" disabled={busy || !iccid} onClick={() => invoke("set_iccid", { iccid, provisioned_msisdn: msisdn || null })}>Save SIM details</Button></div>
              </div>

              {selected.sim_type === "physical" && (
                <div className="border-t-2 border-foreground/20 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <Label>Tracking</Label>
                    <SafetyLabel kind="warning">Notifies customer</SafetyLabel>
                  </div>
                  <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
                  <Button className="mt-2" variant="hero" size="sm" disabled={busy} onClick={() => invoke("mark_dispatched", { tracking })} title="Marks order dispatched and sends dispatch notification">Mark dispatched</Button>
                </div>
              )}

              {selected.sim_type === "esim" && (
                <div className="border-t-2 border-foreground/20 pt-3 grid grid-cols-2 gap-2">
                  <div><Label>SM-DP+ address</Label><Input value={smdp} onChange={(e) => setSmdp(e.target.value)} /></div>
                  <div><Label>Activation code</Label><Input value={activationCode} onChange={(e) => setActivationCode(e.target.value)} /></div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Button variant="hero" size="sm" disabled={busy} onClick={() => invoke("esim_sent", { smdp_address: smdp, activation_code: activationCode })} title="Sends eSIM activation details to the customer">Send eSIM details</Button>
                    <SafetyLabel kind="warning">Sends email</SafetyLabel>
                  </div>
                </div>
              )}

              <div className="border-t-2 border-foreground/20 pt-3">
                <p className="font-display uppercase text-sm mb-2">Mark service live</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Service live date</Label><Input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} /></div>
                  <div><Label>Billing anchor day (1–28)</Label><Input type="number" min={1} max={28} value={anchorDay} onChange={(e) => setAnchorDay(Number(e.target.value))} /></div>
                </div>
                <Button className="mt-2" variant="hero" disabled={busy} onClick={() => invoke("mark_service_live", { service_live_date: liveDate, billing_anchor_day: anchorDay })}>Mark live &amp; start billing</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminSimOrders;