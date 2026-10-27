import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { searchHelpArticles } from "@/data/helpArticles";
import { faqs } from "@/data/faqs";

type Row = { id: string; slug: string; title: string; summary: string | null; kind: string; href?: string };

function routeFor(kind: string, slug: string) {
  if (kind === "blog") return `/blog/${slug}`;
  if (kind === "guide") return `/guides/${slug}`;
  return `/help/${slug}`;
}

/** Static help articles + FAQs, matched in the browser so they work offline and before the DB answers. */
function staticMatches(q: string, kind?: "help" | "guide" | "blog"): Row[] {
  if (kind && kind !== "help") return [];
  const articles: Row[] = searchHelpArticles(q, 6).map((a) => ({
    id: `static-${a.slug}`,
    slug: a.slug,
    title: a.title,
    summary: a.description,
    kind: "help",
  }));
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const faqRows: Row[] = faqs
    .map((f) => {
      const hay = `${f.question} ${f.answer}`.toLowerCase();
      const score = terms.reduce((n, t) => n + (f.question.toLowerCase().includes(t) ? 3 : 0) + (hay.includes(t) ? 1 : 0), 0);
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ f }) => ({ id: `faq-${f.question}`, slug: "", title: f.question, summary: f.answer, kind: "faq", href: "/faq" }));
  return [...articles, ...faqRows];
}

export default function KbSearchBar({
  placeholder = "Search help, guides and blog…",
  kind,
  size = "md",
}: {
  placeholder?: string;
  kind?: "help" | "guide" | "blog";
  size?: "md" | "lg";
}) {
  const [q, setQ] = useState("");
  const [dbResults, setDbResults] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setDbResults([]); return; }
    timer.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_public_kb", { _q: q.trim(), _kind: kind ?? null, _limit: 8 });
      if (!error) setDbResults((data as Row[]) ?? []);
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q, kind]);

  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const local = staticMatches(q.trim(), kind);
    const seen = new Set(local.filter((r) => r.kind === "help").map((r) => r.slug));
    const merged = [...local, ...dbResults.filter((r) => !(r.kind === "help" && seen.has(r.slug)))];
    return merged.slice(0, 10);
  }, [q, dbResults, kind]);

  const big = size === "lg";

  return (
    <div className="relative">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${big ? "h-5 w-5 left-4" : "h-4 w-4"}`} />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={`border-2 border-foreground bg-background text-foreground ${big ? "h-14 pl-12 pr-10 text-base" : "h-11 pl-9 pr-9"}`}
          aria-label="Search help articles"
        />
        {q && (
          <button onClick={() => { setQ(""); setDbResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search" type="button">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-40 left-0 right-0 mt-1 border-2 border-foreground bg-background text-foreground max-h-96 overflow-auto shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matches. Try a different term or open the chat bubble to ask Ollie.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id} className="border-b border-foreground/20 last:border-b-0">
                  <Link to={r.href ?? routeFor(r.kind, r.slug)} className="block p-3 hover:bg-accent/10" onMouseDown={(e) => e.preventDefault()}>
                    <span className="text-[10px] font-display uppercase text-primary mr-2">{r.kind === "faq" ? "FAQ" : r.kind}</span>
                    <span className="font-display text-sm">{r.title}</span>
                    {r.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
