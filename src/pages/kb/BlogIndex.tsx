import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import KbSearchBar from "@/components/kb/KbSearchBar";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight } from "lucide-react";

type Row = { id: string; slug: string; title: string; summary: string | null; read_minutes: number | null; updated_at: string };

export default function BlogIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_kb_articles_by_kind", { _kind: "blog" });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <SEO
        title="OCCTA Blog — Broadband, billing and connectivity guides"
        description="Plain-English UK broadband, digital voice and billing guides from OCCTA. No jargon, no marketing fluff — just useful reading."
        canonical="/blog"
      />
      <section className="py-12 md:py-16 border-b-4 border-foreground">
        <div className="container mx-auto px-4 max-w-4xl">
          <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-3">Blog</span>
          <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.9] mb-4">Read. Learn. Save time.</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mb-6">Broadband and connectivity, explained in plain English.</p>
          <div className="max-w-xl"><KbSearchBar kind="blog" placeholder="Search blog…" /></div>
        </div>
      </section>
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No posts yet. Check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rows.map((r) => (
                <Link key={r.id} to={`/blog/${r.slug}`} className="border-4 border-foreground p-5 bg-card hover:bg-secondary/40 transition-colors group">
                  <span className="text-xs font-display uppercase text-primary inline-flex items-center gap-1">
                    {r.read_minutes ? <><Clock className="h-3 w-3" /> {r.read_minutes} min</> : "Article"}
                  </span>
                  <h2 className="font-display text-xl mt-2 group-hover:text-primary">{r.title}</h2>
                  {r.summary && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{r.summary}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-display uppercase text-primary">Read <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}