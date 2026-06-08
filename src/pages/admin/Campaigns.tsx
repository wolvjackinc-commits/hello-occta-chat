import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Draft = {
  id: string; campaign_type: string; title: string; target_audience: string | null;
  draft_copy: string | null; offer_terms: string | null;
  margin_check_status: string; compliance_check_status: string; approval_status: string;
  active: boolean; created_at: string;
};
const TYPES = ["homepage_banner","landing_page","referral_offer","contract_saver_offer","b2b_offer","email","sms","seo_draft","ads_copy","winback","failed_payment_recovery"];

export const AdminCampaigns = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Draft[]>([]);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<any>({ campaign_type: "homepage_banner", title: "" });

  async function load() {
    const { data } = await supabase.from("campaign_drafts").select("*").order("created_at", { ascending: false }).limit(100);
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

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display uppercase text-3xl">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Drafts only. No email/SMS sent. AI drafting comes later.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled title="AI drafting arrives in a later phase">AI draft</Button>
          <Button onClick={() => setCreating(true)}>+ New draft</Button>
        </div>
      </div>

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
export default AdminCampaigns;