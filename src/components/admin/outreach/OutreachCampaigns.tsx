import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { outreachTable, pct, type OutreachCampaign, type OutreachSettings, type OutreachStats, type OutreachTemplate } from "@/lib/outreach/api";
import { slugify } from "../../../../supabase/functions/_shared/outreach.ts";
import { CampaignStatusBadge } from "./shared";
import { OutreachCampaignDetail } from "./OutreachCampaignDetail";

export function OutreachCampaigns({ settings }: { settings: OutreachSettings | null }) {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const openId = params.get("campaign");
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [stats, setStats] = useState<OutreachStats[]>([]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, t] = await Promise.all([
      outreachTable("outreach_campaigns").select("*").order("created_at", { ascending: false }).limit(500),
      outreachTable("outreach_campaign_stats").select("*"),
      outreachTable("outreach_templates").select("*").eq("is_active", true).order("name"),
    ]);
    if (c.error) toast({ title: "Couldn't load campaigns", description: c.error.message, variant: "destructive" });
    setCampaigns((c.data ?? []) as unknown as OutreachCampaign[]);
    setStats((s.data ?? []) as unknown as OutreachStats[]);
    setTemplates((t.data ?? []) as unknown as OutreachTemplate[]);
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const statsById = useMemo(() => new Map(stats.map((s) => [s.campaign_id, s])), [stats]);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    next.set("tab", "campaigns");
    if (id) next.set("campaign", id); else next.delete("campaign");
    setParams(next);
  };

  const create = async () => {
    const template = templates.find((t) => t.id === newTemplate);
    if (!newName.trim() || !template) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const slug = `${slugify(newName).slice(0, 70)}-${Date.now().toString(36).slice(-5)}`;
    const { data, error } = await outreachTable("outreach_campaigns").insert({
      name: newName.trim(),
      slug,
      status: "draft",
      template_id: template.id,
      template_key: template.template_key,
      subject: template.subject,
      preheader: template.preheader,
      body_html: template.body_html,
      body_text: template.body_text,
      cta_label: template.cta_label,
      cta_path: template.cta_path,
      hero_image_url: template.hero_image_url,
      flyer_ref: template.flyer_ref,
      audience: {},
      created_by: u.user?.id ?? null,
    } as never).select("id").single();
    setSaving(false);
    if (error) return toast({ title: "Couldn't create campaign", description: error.message, variant: "destructive" });
    setCreating(false);
    setNewName("");
    setNewTemplate("");
    await load();
    open((data as unknown as { id: string }).id);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-sm text-muted-foreground">{campaigns.length} campaigns</p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh campaigns"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New campaign</Button>
        </div>
      </div>

      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="text-right">Clicked</TableHead>
              <TableHead className="text-right">Enquiries</TableHead>
              <TableHead className="text-right">Unsubscribed</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 && !loading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No campaigns yet. Create one from a template.</TableCell></TableRow>
            )}
            {campaigns.map((c) => {
              const s = statsById.get(c.id);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => open(c.id)}>
                  <TableCell>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.flyer_ref ?? "—"} · {c.template_key ?? "custom"}</div>
                  </TableCell>
                  <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{c.total_recipients || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.sent ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(s?.opened ?? 0, s?.sent ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(s?.clicked ?? 0, s?.sent ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.converted ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.unsubscribed ?? 0}</TableCell>
                  <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="oc-name">Campaign name</Label>
              <Input id="oc-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Landline switch-off — Huddersfield Oct 2026" maxLength={200} />
            </div>
            <div>
              <Label>Start from template</Label>
              <Select value={newTemplate} onValueChange={setNewTemplate}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">You can edit the wording and choose recipients next. Nothing is sent until you launch.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving || !newName.trim() || !newTemplate}>{saving ? "Creating…" : "Create draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openId && (
        <OutreachCampaignDetail
          campaignId={openId}
          settings={settings}
          onClose={() => open(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
