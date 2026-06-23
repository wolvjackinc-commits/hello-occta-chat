import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, MessageCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { getHelpArticle, helpArticles } from "@/data/helpArticles";
import NotFound from "@/pages/NotFound";

const HelpArticlePage = () => {
  const { slug } = useParams();
  const article = slug ? getHelpArticle(slug) : undefined;
  if (!article) return <NotFound />;

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Help Centre", url: "/help" },
    { name: article.title, url: `/help/${article.slug}` },
  ]);

  const related = (article.related ?? [])
    .map((s) => helpArticles.find((a) => a.slug === s))
    .filter(Boolean) as typeof helpArticles;

  return (
    <Layout>
      <SEO title={article.metaTitle} description={article.description} canonical={`/help/${article.slug}`} keywords={article.keywords} />
      <StructuredData customOnly customSchema={breadcrumb} />

      <article className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/help" className="inline-flex items-center gap-1 text-sm font-display uppercase text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Help Centre
        </Link>

        <div className="border-4 border-foreground p-6 mb-6 bg-card">
          <span className="text-xs font-display uppercase text-primary">{article.category} · <Clock className="w-3 h-3 inline" /> {article.readMinutes} min</span>
          <h1 className="font-display uppercase text-3xl md:text-4xl mt-2 leading-tight">{article.title}</h1>
          <p className="text-base text-muted-foreground mt-3">{article.intro}</p>
        </div>

        {article.sections.map((s, i) => (
          <section key={i} className="border-4 border-foreground p-6 mb-5 bg-background">
            <h2 className="font-display uppercase text-lg mb-3">{s.heading}</h2>
            {s.paragraphs.filter(Boolean).map((p, j) => (
              <p key={j} className="text-sm leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}

        {article.faqs.length > 0 && (
          <section className="border-4 border-foreground p-6 mb-5 bg-secondary">
            <h2 className="font-display uppercase text-lg mb-4">FAQs</h2>
            <div className="space-y-4">
              {article.faqs.map((f, i) => (
                <div key={i}>
                  <p className="font-display text-sm uppercase">{f.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="card-brutal bg-card p-5 flex items-center gap-3 mb-8">
          <MessageCircle className="w-6 h-6 text-primary" />
          <p className="text-sm flex-1">Still stuck? Open the chat bubble (bottom-right) and Ira will help.</p>
        </div>

        {related.length > 0 && (
          <div>
            <h3 className="font-display uppercase text-sm mb-3 text-muted-foreground">Related</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link key={r.slug} to={`/help/${r.slug}`} className="card-brutal bg-card p-4 group hover:bg-secondary transition-colors">
                  <span className="text-xs font-display uppercase text-primary">{r.category}</span>
                  <p className="font-display text-sm mt-1 group-hover:text-primary inline-flex items-center gap-1">{r.title} <ArrowRight className="w-3 h-3" /></p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </Layout>
  );
};

export default HelpArticlePage;