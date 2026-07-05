import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; slug: string; title: string; summary: string | null; kind: string };

function routeFor(kind: string, slug: string) {
  if (kind === "blog") return `/blog/${slug}`;
  if (kind === "guide") return `/guides/${slug}`;
  return `/help/${slug}`;
}

export default function KbSearchBar({ placeholder = "Search help, guides and blog…", kind }: { placeholder?: string; kind?: "help" | "guide" | "blog" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_public_kb", { _q: q.trim(), _kind: kind ?? null, _limit: 8 });
      if (!error) setResults((data as Row[]) ?? []);
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q, kind]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="pl-9 pr-9 border-2 border-foreground h-11"
          aria-label="Search help articles"
        />
        {q && (
          <button onClick={() => { setQ(""); setResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search" type="button">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-40 left-0 right-0 mt-1 border-2 border-foreground bg-background max-h-80 overflow-auto shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matches. Try a different term or open the chat bubble to ask Ira.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id} className="border-b border-foreground/20 last:border-b-0">
                  <Link to={routeFor(r.kind, r.slug)} className="block p-3 hover:bg-accent/10" onMouseDown={(e) => e.preventDefault()}>
                    <span className="text-[10px] font-display uppercase text-primary mr-2">{r.kind}</span>
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