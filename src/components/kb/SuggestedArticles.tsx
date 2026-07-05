import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; slug: string; title: string; summary: string | null; kind: string };

function routeFor(kind: string, slug: string) {
  if (kind === "blog") return `/blog/${slug}`;
  if (kind === "guide") return `/guides/${slug}`;
  return `/help/${slug}`;
}

/**
 * Non-blocking deflection widget for support/complaint forms. Given a subject,
 * shows up to 3 suggested help articles. Never blocks submission.
 */
export default function SuggestedArticles({ subject, limit = 3 }: { subject: string; limit?: number }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const q = subject.trim();
    if (q.length < 3) { setRows([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("search_public_kb", { _q: q, _kind: null, _limit: limit });
      setRows((data as Row[]) ?? []);
    }, 350);
    return () => window.clearTimeout(t);
  }, [subject, limit]);

  if (rows.length === 0) return null;

  return (
    <aside className="border-2 border-foreground p-3 my-3 bg-secondary/40">
      <p className="font-display uppercase text-xs text-primary mb-2 inline-flex items-center gap-1">
        <Lightbulb className="h-3 w-3" /> This might already have your answer
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={routeFor(r.kind, r.slug)} target="_blank" rel="noopener" className="text-sm hover:text-primary inline-flex items-center gap-1">
              {r.title} <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}