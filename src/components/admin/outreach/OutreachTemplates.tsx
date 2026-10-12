import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { outreachTable, type OutreachSettings, type OutreachTemplate } from "@/lib/outreach/api";
import {
  complianceFooterHtml,
  OUTREACH_PLACEHOLDERS,
  renderPlaceholders,
  unknownPlaceholders,
  wrapEmailHtml,
} from "../../../../supabase/functions/_shared/outreach.ts";

const EMPTY: Omit<OutreachTemplate, "id" | "updated_at"> = {
  template_key: "",
  name: "",
  flyer_ref: "",
  subject: "",
  preheader: "",
  body_html: "<p>Hello {{business_name}} team,</p>\n<p></p>",
  body_text: "Hello {{business_name}} team,\n\n\nBook your free line check: {{cta_url}}",
  cta_label: "Book my free line check",
  cta_path: "/business/contact-sales",
  hero_image_url: "",
  is_active: true,
};

const SAMPLE = {
  business_name: "Example Bakery Ltd", area: "Town centre / HD1", district: "HD1", category: "Food & Drink",
  cta_url: "https://www.occta.co.uk/business/contact-sales", unsubscribe_url: "https://www.occta.co.uk/unsubscribe", sender_name: "OCCTA Business",
};

export function OutreachTemplates({ settings }: { settings: OutreachSettings | null }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [editing, setEditing] = useState<(Omit<OutreachTemplate, "id" | "updated_at"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await outreachTable("outreach_templates").select("*").order("name");
    if (error) toast({ title: "Couldn't load templates", description: error.message, variant: "destructive" });
    setTemplates((data ?? []) as unknown as OutreachTemplate[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const problems = useMemo(() => {
    if (!editing) return [];
    const p: string[] = [];
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(editing.template_key)) p.push("Key: lowercase letters, numbers and dashes only");
    if (!editing.name.trim()) p.push("Name is required");
    if (!editing.subject.trim()) p.push("Subject is required");
    if (!editing.body_html.trim() || !editing.body_text.trim()) p.push("Both HTML and plain-text bodies are required");
    if (editing.flyer_ref && !/^[A-Z0-9-]{3,24}$/.test(editing.flyer_ref)) p.push("Flyer reference: 3–24 capital letters, numbers or dashes");
    if (!/^\/[A-Za-z0-9/_-]*$/.test(editing.cta_path)) p.push("Button link must be a page path like /business/contact-sales");
    const unknown = unknownPlaceholders(`${editing.subject} ${editing.preheader ?? ""} ${editing.body_html} ${editing.body_text}`, OUTREACH_PLACEHOLDERS);
    if (unknown.length) p.push(`Unknown placeholders: ${unknown.map((u) => `{{${u}}}`).join(", ")}`);
    if (/<script|javascript:/i.test(editing.body_html)) p.push("Scripts are not allowed");
    return p;
  }, [editing]);

  const previewHtml = useMemo(() => {
    if (!editing) return "";
    const vars = { ...SAMPLE, flyer_ref: editing.flyer_ref ?? "" };
    return wrapEmailHtml({
      subject: renderPlaceholders(editing.subject, vars, "text"),
      preheader: editing.preheader ? renderPlaceholders(editing.preheader, vars, "text") : null,
      bodyHtml: renderPlaceholders(editing.body_html, vars, "html"),
      ctaLabel: editing.cta_label,
      ctaUrl: SAMPLE.cta_url,
      heroImageUrl: editing.hero_image_url || null,
      footerHtml: complianceFooterHtml({
        businessName: SAMPLE.business_name,
        postalAddress: settings?.postal_address ?? "OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom",
        unsubscribeUrl: SAMPLE.unsubscribe_url,
        privacyUrl: "https://www.occta.co.uk/privacy",
      }),
      pixelUrl: null,
    });
  }, [editing, settings]);

  const save = async () => {
    if (!editing || problems.length) return;
    setSaving(true);
    const row = {
      template_key: editing.template_key,
      name: editing.name.trim(),
      flyer_ref: editing.flyer_ref || null,
      subject: editing.subject.trim(),
      preheader: editing.preheader || null,
      body_html: editing.body_html,
      body_text: editing.body_text,
      cta_label: editing.cta_label.trim(),
      cta_path: editing.cta_path,
      hero_image_url: editing.hero_image_url || null,
      is_active: editing.is_active,
    };
    const res = editing.id
      ? await outreachTable("outreach_templates").update(row as never).eq("id", editing.id)
      : await outreachTable("outreach_templates").insert(row as never);
    setSaving(false);
    if (res.error) return toast({ title: "Couldn't save template", description: res.error.message, variant: "destructive" });
    toast({ title: "Template saved", description: "Existing campaigns keep the wording they were created with." });
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Templates are starting points. Each campaign takes a copy you can still edit before launch.</p>
        <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" /> New template</Button>
      </div>
      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Flyer</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setEditing({ ...t, flyer_ref: t.flyer_ref ?? "", preheader: t.preheader ?? "", hero_image_url: t.hero_image_url ?? "" })}>
                <TableCell><div className="font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.template_key}</div></TableCell>
                <TableCell>{t.flyer_ref ?? "—"}</TableCell>
                <TableCell className="text-sm max-w-[360px] truncate">{t.subject}</TableCell>
                <TableCell>{t.is_active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                <TableCell className="text-xs">{format(new Date(t.updated_at), "dd MMM yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div><Label>Key</Label><Input value={editing.template_key} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, template_key: e.target.value.toLowerCase() })} placeholder="spring-offer" /></div>
                  <div><Label>Flyer reference</Label><Input value={editing.flyer_ref ?? ""} onChange={(e) => setEditing({ ...editing, flyer_ref: e.target.value.toUpperCase() })} placeholder="LAST-A" /></div>
                  <div className="flex items-end gap-2 pb-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} id="ot-active" /><Label htmlFor="ot-active">Available for new campaigns</Label></div>
                </div>
                <div><Label>Subject</Label><Input value={editing.subject} maxLength={200} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>
                <div><Label>Preview text</Label><Input value={editing.preheader ?? ""} maxLength={200} onChange={(e) => setEditing({ ...editing, preheader: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Button label</Label><Input value={editing.cta_label} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} /></div>
                  <div><Label>Button goes to</Label><Input value={editing.cta_path} onChange={(e) => setEditing({ ...editing, cta_path: e.target.value })} /></div>
                </div>
                <div><Label>Flyer image URL (optional)</Label><Input value={editing.hero_image_url ?? ""} onChange={(e) => setEditing({ ...editing, hero_image_url: e.target.value })} /></div>
                <div><Label>Body (HTML)</Label><Textarea rows={12} className="font-mono text-xs" value={editing.body_html} onChange={(e) => setEditing({ ...editing, body_html: e.target.value })} /></div>
                <div><Label>Plain-text version</Label><Textarea rows={8} className="font-mono text-xs" value={editing.body_text} onChange={(e) => setEditing({ ...editing, body_text: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Placeholders: {OUTREACH_PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}</p>
                {problems.length > 0 && (
                  <ul className="border-4 border-red-600 bg-red-50 p-3 text-sm list-disc pl-6">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                )}
              </div>
              <div>
                <Label>Live preview (sample business)</Label>
                <iframe title="Template preview" sandbox="" srcDoc={previewHtml} className="w-full h-[760px] border-4 border-foreground bg-white" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || problems.length > 0}>{saving ? "Saving…" : "Save template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
