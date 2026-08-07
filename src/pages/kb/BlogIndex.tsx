import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import KbSearchBar from "@/components/kb/KbSearchBar";
import { supabase } from "@/integrations/supabase/client";
import { seoGrowthArticles } from "@/data/seoGrowthArticles";
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
        title="OCCTA Blog — Broadband Deals, Landline Switch-Off 2027 & Digital Voice"
        description="UK broadband guides covering broadband deals, fibre, speed tests, switching, the 2027 landline switch-off, Digital Voice, pensioners and home phone help."
        canonical="/blog"
        keywords="broadband deals UK, landline switch off 2027, broadband for pensioners, digital landline, fibre broadband deals, broadband comparison, broadband speed test"
      />
      <section className="py-12 md:py-16 border-b-4 border-foreground">
        <div className="container mx-auto px-4 max-w-5xl">
          <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-3">Blog & guides</span>
          <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.9] mb-4">Useful answers before you buy, switch or call support.</h1>
          <p className="text-muted-foreground text-lg max-w-3xl mb-6">
            Plain-English broadband, switching and Digital Voice guidance — including the January 2027 landline change and practical help for older customers and families.
          </p>
          <div className="max-w-xl"><KbSearchBar kind="blog" placeholder="Search blog…" /></div>
        </div>
      </section>

      <section className="py-10 border-b-4 border-foreground">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <span className="text-xs font-display uppercase tracking-[0.16em] text-primary">Latest OCCTA guides</span>
              <h2 className="font-display uppercase text-2xl md:text-3xl mt-1">2027 landline switch & broadband buying guides</h2>
            </div>
            <Link to="/learn" className="hidden sm:inline-flex items-center gap-1 text-sm font-display uppercase text-primary">
              All guides <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seoGrowthArticles.map((article) => (
              <Link
                key={article.slug}
                to={`/learn/${article.slug}`}
                className="border-4 border-foreground p-5 bg-card hover:bg-secondary/40 transition-colors group flex flex-col"
              >
                <span className="text-xs font-display uppercase text-primary">{article.category}</span>
                <h3 className="font-display text-xl mt-2 group-hover:text-primary leading-tight">{article.h1}</h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-4 flex-1">{article.shortAnswer}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-display uppercase text-primary">Read guide <ArrowRight className="h-3 w-3" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="font-display uppercase text-2xl md:text-3xl mb-5">More from OCCTA</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">More posts are being prepared. Browse the latest guides above or visit the Learn hub.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rows.map((r) => (
                <Link key={r.id} to={`/blog/${r.slug}`} className="border-4 border-foreground p-5 bg-card hover:bg-secondary/40 transition-colors group">
                  <span className="text-xs font-display uppercase text-primary inline-flex items-center gap-1">
                    {r.read_minutes ? <><Clock className="h-3 w-3" /> {r.read_minutes} min</> : "Article"}
                  </span>
                  <h3 className="font-display text-xl mt-2 group-hover:text-primary">{r.title}</h3>
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
