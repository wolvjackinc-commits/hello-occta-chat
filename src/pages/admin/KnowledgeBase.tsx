import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Article = { id: string; title: string; slug: string; visibility: string; status: string; version: number; updated_at: string };
type Rule = { id: string; trigger_type: string; rule_text: string; action: string; active: boolean };

export const AdminKnowledgeBase = () => {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState({ title: "", slug: "", content: "", visibility: "public" });

  const load = async () => {
    const [a, r] = await Promise.all([
      supabase.from("kb_articles").select("id, title, slug, visibility, status, version, updated_at").order("updated_at", { ascending: false }),
      supabase.from("ai_handoff_rules").select("id, trigger_type, rule_text, action, active").order("created_at", { ascending: false }),
    ]);
    setArticles((a.data as unknown as Article[]) ?? []);
    setRules((r.data as unknown as Rule[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const createDraft = async () => {
    if (!draft.title || !draft.slug || !draft.content) {
      toast({ title: "Title, slug and content required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("kb_articles").insert({
      title: draft.title, slug: draft.slug.toLowerCase().replace(/[^a-z0-9-]/g,"-"),
      content: draft.content, visibility: draft.visibility as "public" | "internal" | "support_only",
      status: "draft",
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setDraft({ title: "", slug: "", content: "", visibility: "public" }); load(); toast({ title: "Draft saved" }); }
  };

  const doAction = async (article_id: string, action: "approve"|"archive"|"draft") => {
    const { error } = await supabase.functions.invoke("kb-approve-article", { body: { article_id, action } });
    if (error) toast({ title: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Approved articles power AI responses. Drafts and internal articles never reach customers.</p>
      </div>

      <section className="p-4 border-4 border-foreground bg-background space-y-3">
        <h2 className="font-display uppercase">New article</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="border-2 border-foreground" />
          <Input placeholder="slug (e.g. how-to-set-up-router)" value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} className="border-2 border-foreground" />
        </div>
        <div>
          <Label className="text-xs uppercase">Visibility</Label>
          <Select value={draft.visibility} onValueChange={(v) => setDraft({ ...draft, visibility: v })}>
            <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="support_only">Support only</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea rows={6} placeholder="Article content (markdown)" value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} className="border-2 border-foreground" />
        <Button variant="hero" onClick={createDraft}>Save draft</Button>
      </section>

      <section>
        <h2 className="font-display uppercase mb-3">Articles</h2>
        {articles.length === 0 ? <p className="text-sm text-muted-foreground">No articles yet.</p> : (
          <div className="space-y-2">
            {articles.map(a => (
              <div key={a.id} className="p-3 border-2 border-foreground flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-display">{a.title} <span className="text-xs text-muted-foreground font-mono">/{a.slug}</span></p>
                  <p className="text-[11px] text-muted-foreground">v{a.version}</p>
                </div>
                <div className="flex gap-1 items-center flex-wrap">
                  <Badge variant="outline" className="capitalize">{a.visibility}</Badge>
                  <Badge className="border-2 border-foreground capitalize">{a.status}</Badge>
                  {a.status !== "approved" && <Button size="sm" onClick={() => doAction(a.id, "approve")}>Approve</Button>}
                  {a.status !== "archived" && <Button size="sm" variant="outline" onClick={() => doAction(a.id, "archive")}>Archive</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display uppercase mb-3">AI handoff rules</h2>
        {rules.length === 0 ? <p className="text-sm text-muted-foreground">No rules configured.</p> : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="p-3 border-2 border-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">{r.trigger_type.replace(/_/g," ")}</Badge>
                  <Badge className="capitalize">{r.action.replace(/_/g," ")}</Badge>
                  {!r.active && <Badge variant="outline">inactive</Badge>}
                </div>
                <p className="text-sm mt-1">{r.rule_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};