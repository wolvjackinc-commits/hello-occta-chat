// /learn hub — one crawlable index of every SEO explainer page grouped by
// category. Each entry links to the deep page, giving Google a clear
// hub-and-spoke structure similar to Wise's and GoCardless's learning hubs.
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createBreadcrumbSchema } from "@/components/seo";
import { learnPages, learnCategoryLabels, LearnCategory } from "@/data/learnPages";
import { ArrowRight } from "lucide-react";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";
import { Button } from "@/components/ui/button";

const orderedCategories: LearnCategory[] = [
  "broadband",
  "wifi",
  "switching",
  "sim",
  "voice",
  "payments",
];

export default function LearnHub() {
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ]);

  return (
    <Layout>
      <SEO
        title="Learn — Broadband, SIM, Voice and Payments guides | OCCTA"
        description="Plain-English UK guides on broadband, Wi-Fi, SIM, digital voice, switching and Direct Debit. No jargon. Answers to the questions you actually search for."
        canonical="/learn"
        keywords="broadband guides UK, SIM guides, digital voice UK, direct debit guarantee, switch broadband guide, FTTP explained"
      />
      <JsonLd data={breadcrumb} />

      <section className="border-b-4 border-foreground py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-3">Learn</span>
          <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.9] mb-4">Broadband, SIM & billing — explained properly.</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Every question we get, answered once — clearly, in plain English, with no marketing fluff.
            Bookmark this hub or search it inside the chat.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-10 md:py-14">
        {orderedCategories.map((cat) => {
          const pages = learnPages.filter((p) => p.category === cat);
          if (pages.length === 0) return null;
          return (
            <section key={cat} className="mb-12">
              <h2 className="font-display uppercase text-2xl md:text-3xl mb-5 border-b-4 border-foreground pb-2">
                {learnCategoryLabels[cat]}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/learn/${p.slug}`}
                    className="border-4 border-foreground p-5 bg-card hover:bg-secondary/40 transition-colors group flex flex-col"
                  >
                    <h3 className="font-display text-lg group-hover:text-primary leading-tight">{p.h1}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">{p.shortAnswer}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-display uppercase text-primary">
                      Read <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="border-t-4 border-foreground bg-secondary py-12">
        <div className="container mx-auto px-4 max-w-3xl grid gap-6 md:grid-cols-[1fr_1.1fr] items-start">
          <div>
            <h2 className="font-display uppercase text-2xl md:text-3xl mb-3">Ready to move on?</h2>
            <p className="text-muted-foreground mb-4">
              Reading is one thing — knowing what's at your address is another. Run a free postcode check
              or pick a plan directly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="font-display uppercase"><Link to="/coverage-areas">Check my area</Link></Button>
              <Button asChild variant="outline" className="font-display uppercase"><Link to="/broadband">See plans</Link></Button>
            </div>
          </div>
          <LeadCaptureWidget source="learn-hub" compact />
        </div>
      </section>
    </Layout>
  );
}
