import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, Eye, Send, Archive, FileText } from "lucide-react";
import { learnPages } from "@/data/learnPages";
import { comparisons } from "@/data/comparisons";

type BlogRow = {
  id: string; title: string; slug: string; summary: string | null; content: string;
  status: string; visibility: string; tags: string[] | null; structured_data: { category?: string } | null;
  seo_title: string | null; seo_description: string | null;
  related_slugs: string[] | null; updated_at: string; read_minutes: number | null;
};

const CATEGORIES = ["broadband", "sim", "router", "landline", "switching", "billing", "business", "guides"] as const;

// Build the internal-linking dictionary once — maps keyword → canonical route.
// Longest keys first so multi-word matches win over single-word ones.
function buildLinkDictionary(): Array<{ keyword: string; url: string; label: string }> {
  const entries: Array<{ keyword: string; url: string; label: string }> = [];
  learnPages.forEach((p) => {
    entries.push({ keyword: p.title.split(" — ")[0].replace(/\?$/, ""), url: `/learn/${p.slug}`, label: "learn" });
    entries.push({ keyword: p.slug.replace(/-/g, " "), url: `/learn/${p.slug}`, label: "learn" });
  });
  comparisons.forEach((c) => {
    const vs = c.slug.replace("occta-vs-", "").replace(/-/g, " ");
    entries.push({ keyword: `vs ${vs}`, url: `/compare/${c.slug}`, label: "compare" });
    entries.push({ keyword: `compared to ${vs}`, url: `/compare/${c.slug}`, label: "compare" });
  });
  return entries.sort((a, b) => b.keyword.length - a.keyword.length);
}

function autoLinkContent(markdown: string): { output: string; added: Array<{ keyword: string; url: string }> } {
  const dict = buildLinkDictionary();
  const added: Array<{ keyword: string; url: string }> = [];
  const seen = new Set<string>();
  let output = markdown;
  for (const { keyword, url } of dict) {
    if (seen.has(url)) continue; // one link per target
    const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\[\\w-])(${safe})(?![\\w-\\]])`, "i");
    if (re.test(output) && !output.toLowerCase().includes(`](${url.toLowerCase()})`)) {
      output = output.replace(re, `[$1](${url})`);
      seen.add(url);
      added.push({ keyword, url });
    }
  }
  return { output, added };
}

const empty = {
  id: "" as string | "",
  title: "", slug: "", summary: "", content: "",
  category: "broadband" as string, tags: "",
  seo_title: "", seo_description: "",
  read_minutes: "" as string,
};

export const AdminBlogEditor = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "archived">("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [autoLinkPreview, setAutoLinkPreview] = useState<Array<{ keyword: string; url: string }>>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("kb_articles")
      .select("id, title, slug, summary, content, status, visibility, tags, structured_data, seo_title, seo_description, related_slugs, updated_at, read_minutes")
      .eq("kind", "blog")
      .order("updated_at", { ascending: false });
    if (error) { toast({ title: "Load failed", description: error.message, variant: "destructive" }); return; }
    setRows((data as unknown as BlogRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !`${r.title} ${r.slug} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, filter, q]);

  const startNew = () => { setEditing(null); setDraft(empty); setAutoLinkPreview([]); };
  const startEdit = (r: BlogRow) => {
    setEditing(r);
    setDraft({
      id: r.id, title: r.title, slug: r.slug, summary: r.summary ?? "", content: r.content,
      category: r.structured_data?.category ?? "broadband", tags: (r.tags ?? []).join(", "),
      seo_title: r.seo_title ?? "", seo_description: r.seo_description ?? "",
      read_minutes: r.read_minutes ? String(r.read_minutes) : "",
    });
    setAutoLinkPreview([]);
  };

  const runAutoLink = () => {
    const { output, added } = autoLinkContent(draft.content);
    setDraft({ ...draft, content: output });
    setAutoLinkPreview(added);
    toast({ title: added.length ? `Added ${added.length} internal links` : "No matches found" });
  };

  const save = async (publish: boolean) => {
    if (!draft.title || !draft.slug || !draft.content) {
      toast({ title: "Title, slug and content required", variant: "destructive" }); return;
    }
    const payload = {
      title: draft.title,
      slug: draft.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      summary: draft.summary || null,
      content: draft.content,
      kind: "blog" as const,
      visibility: "public" as const,
      audience: "public" as const,
      status: (publish ? "approved" : "draft") as "approved" | "draft",
      structured_data: { category: draft.category } as unknown as Record<string, unknown>,
      tags: draft.tags ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      seo_title: draft.seo_title || null,
      seo_description: draft.seo_description || null,
      read_minutes: draft.read_minutes ? Number(draft.read_minutes) : null,
      last_reviewed_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("kb_articles").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("kb_articles").insert(payload);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: publish ? "Published" : "Saved as draft" });
    startNew(); load();
  };

  const setStatus = async (r: BlogRow, action: "approve" | "archive" | "draft") => {
    const { error } = await supabase.functions.invoke("kb-approve-article", { body: { article_id: r.id, action } });
    if (error) toast({ title: "Action failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Blog</h1>
        <p className="text-sm text-muted-foreground">
          Simple blog CMS — categories, tags, draft/publish, and one-click auto-linking to <code>/learn</code> and <code>/compare</code> pages.
        </p>
      </div>

      <div className="grid lg:grid-cols-[2fr_3fr] gap-6">
        {/* LEFT: list */}
        <div className="border-4 border-foreground bg-card p-4">
          <div className="flex gap-2 mb-3">
            <Input placeholder="Search title, slug, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="approved">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="secondary" onClick={startNew} className="mb-3 w-full font-display uppercase">
            <FileText className="h-4 w-4 mr-2" /> New post
          </Button>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground p-2">No posts.</p>}
            {filtered.map((r) => (
              <div key={r.id} className={`border-2 p-3 cursor-pointer hover:bg-secondary/40 ${editing?.id === r.id ? "border-primary bg-primary/5" : "border-foreground"}`}
                onClick={() => startEdit(r)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-sm truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">/{r.slug}</div>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "draft" ? "secondary" : "outline"}>
                    {r.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.structured_data?.category && <Badge variant="outline" className="text-[10px]">{r.structured_data.category}</Badge>}
                  {(r.tags ?? []).slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
                  ))}
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  {r.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => setStatus(r, "approve")}><Send className="h-3 w-3 mr-1" />Publish</Button>}
                  {r.status === "approved" && <Button size="sm" variant="ghost" onClick={() => setStatus(r, "draft")}>Unpublish</Button>}
                  {r.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => setStatus(r, "archive")}><Archive className="h-3 w-3 mr-1" />Archive</Button>}
                  {r.status === "approved" && <a href={`/blog/${r.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs px-2 py-1 hover:underline"><Eye className="h-3 w-3 mr-1" />View</a>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: editor */}
        <div className="border-4 border-foreground bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">{editing ? "Edit post" : "New post"}</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => save(false)}><Save className="h-4 w-4 mr-2" />Save draft</Button>
              <Button onClick={() => save(true)}><Send className="h-4 w-4 mr-2" />{editing?.status === "approved" ? "Update" : "Publish"}</Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Title</Label>
              <Input value={draft.title} onChange={(e) => {
                const title = e.target.value;
                const slug = editing ? draft.slug : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                setDraft({ ...draft, title, slug });
              }} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-[1fr_1fr_140px] gap-3">
            <div>
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="fibre, switching, uk" />
            </div>
            <div>
              <Label>Read (min)</Label>
              <Input type="number" value={draft.read_minutes} onChange={(e) => setDraft({ ...draft, read_minutes: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Summary</Label>
            <Textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Content (markdown)</Label>
              <Button size="sm" variant="outline" onClick={runAutoLink}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Auto-link to /learn & /compare
              </Button>
            </div>
            <Textarea rows={16} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} className="font-mono text-sm" />
            {autoLinkPreview.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Added: {autoLinkPreview.map((a) => <span key={a.url} className="inline-block mr-2">"{a.keyword}" → {a.url}</span>)}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>SEO title (optional)</Label>
              <Input value={draft.seo_title} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} />
            </div>
            <div>
              <Label>SEO description (optional)</Label>
              <Input value={draft.seo_description} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBlogEditor;