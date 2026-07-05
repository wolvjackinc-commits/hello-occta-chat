import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Article = { id: string; title: string; slug: string; visibility: string; status: string; version: number; updated_at: string; kind: string; audience: string; ai_allowed: boolean; last_reviewed_at: string | null };
type Rule = { id: string; trigger_type: string; rule_text: string; action: string; active: boolean };

export const AdminKnowledgeBase = () => {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState({
    title: "",
    slug: "",
    summary: "",
    content: "",
    visibility: "public",
    kind: "help",
    audience: "public",
    ai_allowed: true,
    seo_title: "",
    seo_description: "",
    tags: "",
    related_slugs: "",
    read_minutes: "" as string | number,
  });
  const [kindFilter, setKindFilter] = useState<"all" | "help" | "guide" | "blog">("all");
  const [feedback, setFeedback] = useState<Array<{ article_id: string; helpful: boolean; note: string | null; created_at: string }>>([]);
  const [noResultSearches, setNoResultSearches] = useState<Array<{ query: string; created_at: string }>>([]);

  const load = async () => {
    const [a, r] = await Promise.all([
      supabase.from("kb_articles").select("id, title, slug, visibility, status, version, updated_at, kind, audience, ai_allowed, last_reviewed_at").order("updated_at", { ascending: false }),
      supabase.from("ai_handoff_rules").select("id, trigger_type, rule_text, action, active").order("created_at", { ascending: false }),
    ]);
    setArticles((a.data as unknown as Article[]) ?? []);
    setRules((r.data as unknown as Rule[]) ?? []);
    const [fb, srch] = await Promise.all([
      supabase.from("help_article_feedback").select("article_id, helpful, note, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("help_search_logs").select("query, created_at").eq("results_count", 0).order("created_at", { ascending: false }).limit(30),
    ]);
    setFeedback((fb.data as typeof feedback) ?? []);
    setNoResultSearches((srch.data as typeof noResultSearches) ?? []);
  };
  useEffect(() => { load(); }, []);

  const createDraft = async () => {
    if (!draft.title || !draft.slug || !draft.content) {
      toast({ title: "Title, slug and content required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("kb_articles").insert({
      title: draft.title,
      slug: draft.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      summary: draft.summary || null,
      content: draft.content,
      visibility: draft.visibility as "public" | "internal" | "support_only",
      status: "draft",
      kind: draft.kind,
      audience: draft.audience,
      ai_allowed: draft.ai_allowed,
      seo_title: draft.seo_title || null,
      seo_description: draft.seo_description || null,
      tags: draft.tags ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      related_slugs: draft.related_slugs ? draft.related_slugs.split(",").map((t) => t.trim()).filter(Boolean) : [],
      read_minutes: draft.read_minutes ? Number(draft.read_minutes) : null,
      last_reviewed_at: new Date().toISOString(),
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      setDraft({ title: "", slug: "", summary: "", content: "", visibility: "public", kind: "help", audience: "public", ai_allowed: true, seo_title: "", seo_description: "", tags: "", related_slugs: "", read_minutes: "" });
      load();
      toast({ title: "Draft saved" });
    }
  };

  const doAction = async (article_id: string, action: "approve"|"archive"|"draft") => {
    const { error } = await supabase.functions.invoke("kb-approve-article", { body: { article_id, action } });
    if (error) toast({ title: error.message, variant: "destructive" });
    else load();
  };

  const previewPathFor = (a: Article) =>
    a.kind === "blog" ? `/blog/${a.slug}` : a.kind === "guide" ? `/guides/${a.slug}` : `/help/${a.slug}`;

  const filtered = articles.filter((a) => kindFilter === "all" || a.kind === kindFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Approved public articles power the Help Centre, Blog, Guides section AND the Ira AI. Drafts, internal and non-AI-allowed articles never reach customers.</p>
      </div>

      <section className="p-4 border-4 border-foreground bg-background space-y-3">
        <h2 className="font-display uppercase">New article</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input placeholder="Title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="border-2 border-foreground" />
          <Input placeholder="slug (e.g. how-to-set-up-router)" value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} className="border-2 border-foreground" />
          <div>
            <Label className="text-xs uppercase">Kind</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v })}>
              <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="help">Help</SelectItem>
                <SelectItem value="guide">Guide</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
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
          <div>
            <Label className="text-xs uppercase">Audience</Label>
            <Select value={draft.audience} onValueChange={(v) => setDraft({ ...draft, audience: v })}>
              <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public (anyone)</SelectItem>
                <SelectItem value="customer">Signed-in customers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase">AI allowed</Label>
            <Select value={draft.ai_allowed ? "yes" : "no"} onValueChange={(v) => setDraft({ ...draft, ai_allowed: v === "yes" })}>
              <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes — Ira may cite</SelectItem>
                <SelectItem value="no">No — hide from Ira</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea rows={2} placeholder="Short summary (shown in listings + used as SEO fallback)" value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} className="border-2 border-foreground" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="SEO title (optional)" value={draft.seo_title} onChange={e => setDraft({ ...draft, seo_title: e.target.value })} className="border-2 border-foreground" />
          <Input placeholder="SEO description (optional)" value={draft.seo_description} onChange={e => setDraft({ ...draft, seo_description: e.target.value })} className="border-2 border-foreground" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input placeholder="Tags (comma-separated)" value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} className="border-2 border-foreground" />
          <Input placeholder="Related slugs (comma-separated)" value={draft.related_slugs} onChange={e => setDraft({ ...draft, related_slugs: e.target.value })} className="border-2 border-foreground" />
          <Input placeholder="Read minutes (est)" type="number" value={draft.read_minutes} onChange={e => setDraft({ ...draft, read_minutes: e.target.value })} className="border-2 border-foreground" />
        </div>
        <Textarea rows={6} placeholder="Article content (markdown)" value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} className="border-2 border-foreground" />
        <Button variant="hero" onClick={createDraft}>Save draft</Button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display uppercase">Articles</h2>
          <div className="flex gap-1">
            {(["all", "help", "guide", "blog"] as const).map((k) => (
              <Button key={k} size="sm" variant={kindFilter === k ? "default" : "outline"} onClick={() => setKindFilter(k)} className="capitalize">{k}</Button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No articles.</p> : (
          <div className="space-y-2">
            {filtered.map(a => (
              <div key={a.id} className="p-3 border-2 border-foreground flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-display">{a.title} <span className="text-xs text-muted-foreground font-mono">/{a.slug}</span></p>
                  <p className="text-[11px] text-muted-foreground">v{a.version} · {a.kind} · {a.audience}{!a.ai_allowed && " · Ira-off"}</p>
                </div>
                <div className="flex gap-1 items-center flex-wrap">
                  <Badge variant="outline" className="capitalize">{a.visibility}</Badge>
                  <Badge className="border-2 border-foreground capitalize">{a.status}</Badge>
                  {a.status === "approved" && a.visibility === "public" && (
                    <a href={previewPathFor(a)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost">Preview</Button>
                    </a>
                  )}
                  {a.status !== "approved" && <Button size="sm" onClick={() => doAction(a.id, "approve")}>Approve</Button>}
                  {a.status !== "archived" && <Button size="sm" variant="outline" onClick={() => doAction(a.id, "archive")}>Archive</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display uppercase mb-3">Recent reader feedback</h2>
        {feedback.length === 0 ? <p className="text-sm text-muted-foreground">No feedback yet.</p> : (
          <div className="space-y-1">
            {feedback.map((f, i) => (
              <div key={i} className="p-2 border border-foreground text-sm flex items-center gap-3">
                <Badge variant={f.helpful ? "default" : "outline"}>{f.helpful ? "Helpful" : "Not helpful"}</Badge>
                <span className="font-mono text-[11px] text-muted-foreground">{f.article_id.slice(0, 8)}</span>
                {f.note && <span className="text-muted-foreground truncate">{f.note}</span>}
                <span className="ml-auto text-[11px] text-muted-foreground">{new Date(f.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display uppercase mb-3">Searches with no results</h2>
        {noResultSearches.length === 0 ? <p className="text-sm text-muted-foreground">Everyone's finding what they need.</p> : (
          <div className="space-y-1">
            {noResultSearches.map((s, i) => (
              <div key={i} className="p-2 border border-foreground text-sm flex items-center gap-3">
                <span>&ldquo;{s.query}&rdquo;</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
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