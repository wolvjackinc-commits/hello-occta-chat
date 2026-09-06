import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Gift, PauseCircle, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react";

type Draft = {
  id: string; campaign_type: string; title: string; target_audience: string | null;
  draft_copy: string | null; offer_terms: string | null;
  margin_check_status: string; compliance_check_status: string; approval_status: string;
  active: boolean; created_at: string;
};
type LiveCampaign = {
  code: string; title: string; active: boolean; starts_at: string; ends_at: string;
  reward_amount: number; reward_currency: string; terms_version: string;
};
type Funnel = {
  sessions: number; quotes: number; orders: number; rewards_eligible: number;
  rewards_payout_queued: number; rewards_issued: number; rewards_paid: number;
};
const TYPES = ["homepage_banner","landing_page","referral_offer","contract_saver_offer","b2b_offer","email","sms","seo_draft","ads_copy","winback","failed_payment_recovery"];

export const AdminCampaigns = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Draft[]>([]);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<any>({ campaign_type: "homepage_banner", title: "" });
  const [switchCampaign, setSwitchCampaign] = useState<LiveCampaign | null>(null);
  const [sources, setSources] = useState<{ source: string; sessions: number; orders: number }[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [nextActive, setNextActive] = useState(false);

  async function loadSwitch50() {
    const { data, error } = await supabase.functions.invoke("switch50-admin", { body: { action: "status" } });
    if (error || (data as any)?.error) return;
    setSources((data as any).sources ?? []);
    setSwitchCampaign((data as any).campaign ?? null);
    setFunnel((data as any).funnel ?? null);
  }

  async function load() {
    const [{ data }, _] = await Promise.all([
      supabase.from("campaign_drafts").select("*").order("created_at", { ascending: false }).limit(100),
      loadSwitch50(),
    ]);
    setRows((data ?? []) as Draft[]);
  }
  useEffect(() => { load(); }, []);

  async function run(fn: string, body: any) {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error || (data as any)?.error) {
      toast({ variant: "destructive", title: "Failed", description: (data as any)?.error || error?.message });
      return false;
    }
    toast({ title: "Done" });
    return true;
  }

  async function changeSwitch50() {
    if (reason.trim().length < 10) {
      toast({ variant: "destructive", title: "Reason required", description: "Enter at least 10 characters for the audit log." });
      return;
    }
    setSwitchLoading(true);
    try {
      const ok = await run("switch50-admin", { action: "set_active", active: nextActive, reason: reason.trim(), request_id: crypto.randomUUID() });
      if (ok) {
        setReasonOpen(false); setReason(""); await loadSwitch50();
      }
    } finally { setSwitchLoading(false); }
  }

  async function evaluateSwitch50() {
    setSwitchLoading(true);
    try {
      if (await run("switch50-admin", { action: "evaluate" })) await loadSwitch50();
    } finally { setSwitchLoading(false); }
  }

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display uppercase text-3xl">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Live offer control, attribution and approved campaign drafts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled title="AI drafting arrives in a later phase">AI draft</Button>
          <Button onClick={() => setCreating(true)}>+ New draft</Button>
        </div>
      </div>

      <section className="border-4 border-foreground bg-primary/10 p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display uppercase text-xs tracking-widest text-muted-foreground">Production offer</p>
            <h2 className="mt-1 flex items-center gap-2 font-display uppercase text-2xl"><Gift className="h-5 w-5" /> SWITCH50 — £50 Switch Cash</h2>
            <p className="mt-1 text-sm text-muted-foreground">Server-controlled offer used by the website, checkout, contracts and reward ledger. Pausing this is the campaign kill switch.</p>
          </div>
          {switchCampaign ? (
            <Badge className="w-fit text-sm" variant={switchCampaign.active ? "default" : "outline"}>{Date.now() > Date.parse(switchCampaign.ends_at) ? "EXPIRED" : Date.now() < Date.parse(switchCampaign.starts_at) ? "SCHEDULED" : switchCampaign.active ? "LIVE" : "PAUSED"}</Badge>
          ) : <Badge variant="outline">Unavailable</Badge>}
        </div>

        {switchCampaign && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Sessions" value={funnel?.sessions ?? 0} />
              <Metric label="Quotes" value={funnel?.quotes ?? 0} />
              <Metric label="Orders" value={funnel?.orders ?? 0} />
              <Metric label="Cash paid" value={`£${Number(funnel?.rewards_paid ?? 0).toFixed(2)}`} />
              <Metric label="Reward eligible" value={funnel?.rewards_eligible ?? 0} />
              <Metric label="Payout queued" value={funnel?.rewards_payout_queued ?? 0} />
              <Metric label="Rewards issued" value={funnel?.rewards_issued ?? 0} />
              <Metric label="Reward / order" value={`£${Number(switchCampaign.reward_amount).toFixed(2)}`} />
            </div>
            {sources.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-semibold">Campaign sources</caption><thead><tr><th className="text-left">Source</th><th>Sessions</th><th>Orders</th></tr></thead><tbody>{sources.map(s => <tr key={s.source}><td>{s.source}</td><td className="text-center">{s.sessions}</td><td className="text-center">{s.orders}</td></tr>)}</tbody></table></div>}
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="border-2 border-foreground bg-background p-3"><b>Order window:</b> {new Date(switchCampaign.starts_at).toLocaleString("en-GB")} → {new Date(switchCampaign.ends_at).toLocaleString("en-GB")}</div>
              <div className="border-2 border-foreground bg-background p-3"><b>Terms version:</b> {switchCampaign.terms_version}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={switchCampaign.active ? "destructive" : "default"} onClick={() => { setNextActive(!switchCampaign.active); setReasonOpen(true); }}>
                {switchCampaign.active ? <><PauseCircle className="h-4 w-4 mr-2" /> Pause SWITCH50</> : <><PlayCircle className="h-4 w-4 mr-2" /> Enable SWITCH50</>}
              </Button>
              <Button variant="outline" disabled={switchLoading} onClick={evaluateSwitch50}><RefreshCw className={`h-4 w-4 mr-2 ${switchLoading ? "animate-spin" : ""}`} /> Run reward eligibility now</Button>
              <a href="/admin/rewards" className="inline-flex items-center border-2 border-foreground px-4 py-2 font-medium hover:bg-muted"><ShieldCheck className="h-4 w-4 mr-2" /> Open payout control</a>
            </div>
          </>
        )}
      </section>

      <div className="border-4 border-foreground">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b-2 border-foreground"><tr><th className="text-left p-2">Title</th><th className="text-left p-2">Type</th><th className="text-left p-2">Margin</th><th className="text-left p-2">Compliance</th><th className="text-left p-2">Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No campaign drafts.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t-2 border-foreground">
                <td className="p-2">{r.title}</td>
                <td className="p-2"><Badge variant="outline">{r.campaign_type}</Badge></td>
                <td className="p-2">{r.margin_check_status}</td>
                <td className="p-2">{r.compliance_check_status}</td>
                <td className="p-2">{r.active ? <Badge>Active</Badge> : <Badge variant="outline">{r.approval_status}</Badge>}</td>
                <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => setActive(r)}>Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{nextActive ? "Enable" : "Pause"} SWITCH50</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This changes the server-side production kill switch and is audited. Existing accepted contracts keep their immutable promotion snapshot.</p>
          <Textarea placeholder="Reason for this change" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setReasonOpen(false)}>Cancel</Button><Button disabled={switchLoading} onClick={changeSwitch50}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader><DialogTitle>New campaign draft</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <select className="w-full border-2 border-foreground p-2 bg-background" value={draft.campaign_type} onChange={(e) => setDraft({ ...draft, campaign_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <Input placeholder="Target audience" value={draft.target_audience ?? ""} onChange={(e) => setDraft({ ...draft, target_audience: e.target.value })} />
            <Textarea placeholder="Draft copy" value={draft.draft_copy ?? ""} onChange={(e) => setDraft({ ...draft, draft_copy: e.target.value })} />
            <Textarea placeholder="Offer terms (eligibility, expiry, VAT wording, unsubscribe for email/SMS)" value={draft.offer_terms ?? ""} onChange={(e) => setDraft({ ...draft, offer_terms: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={async () => { if (await run("create-campaign-draft", draft)) { setCreating(false); setDraft({ campaign_type: "homepage_banner", title: "" }); load(); } }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>Type: <b>{active?.campaign_type}</b></div>
            <div>Margin: <b>{active?.margin_check_status}</b></div>
            <div>Compliance: <b>{active?.compliance_check_status}</b></div>
            <div>Status: <b>{active?.approval_status}</b> {active?.active && <Badge>Active</Badge>}</div>
            <div className="border-2 border-foreground p-2 whitespace-pre-wrap text-xs">{active?.draft_copy || "—"}</div>
            <div className="border-2 border-foreground p-2 whitespace-pre-wrap text-xs">{active?.offer_terms || "—"}</div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={async () => { if (active && await run("run-campaign-margin-check", { campaign_id: active.id, estimated_cost_per_customer: 0, estimated_revenue_per_customer: 0 })) load(); }}>Margin check</Button>
            <Button size="sm" variant="outline" onClick={async () => { if (active && await run("run-campaign-compliance-check", { campaign_id: active.id })) load(); }}>Compliance check</Button>
            <Button size="sm" onClick={async () => { if (active && await run("approve-campaign", { campaign_id: active.id })) load(); }}>Approve</Button>
            <Button size="sm" onClick={async () => { if (active && await run("publish-campaign", { campaign_id: active.id })) { setActive(null); load(); } }}>Publish</Button>
            <Button size="sm" variant="outline" onClick={async () => { if (active && await run("pause-campaign", { campaign_id: active.id })) { setActive(null); load(); } }}>Pause</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border-2 border-foreground bg-background p-3"><p className="text-[11px] font-display uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>;
}

export default AdminCampaigns;
