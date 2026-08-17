// /learn hub — one crawlable index of every static SEO explainer and authority
// article, grouped by category. Growth content is stored separately so expanding
// the hub cannot disturb customer journeys or account features.
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createBreadcrumbSchema } from "@/components/seo";
import { learnPages, learnCategoryLabels, LearnCategory } from "@/data/learnPages";
import { seoArticles } from "@/data/seoArticles";
import { seoGrowthArticles } from "@/data/seoGrowthArticles";
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

const allPages = [...learnPages, ...seoArticles, ...seoGrowthArticles];

export default function LearnHub() {
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ]);

  return (
    <Layout>
      <SEO
        title="UK Broadband Guides, Landline Switch-Off 2027 & Digital Voice | OCCTA"
        description="Practical UK guides on broadband deals, fibre, switching, the 2027 landline switch-off, Digital Voice, broadband for pensioners, Wi-Fi, SIM and billing."
        canonical="/learn"
        keywords="UK broadband guides, broadband deals UK, landline switch off 2027, broadband for pensioners, digital landline, fibre broadband deals, broadband comparison, broadband speed test, One Touch Switch"
      />
      <JsonLd data={breadcrumb} />

      <section className="border-b-4 border-foreground py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-3">
            Learn
          </span>
          <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.9] mb-4">
            Broadband, the 2027 landline switch, Digital Voice and bills—explained properly.
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Practical UK telecom guides written in plain English. Understand broadband deals,
            switching, full fibre, the move from old landlines to digital voice and the choices
            that matter before you order.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {allPages.length} guides available. Authority articles show their review date and
            supporting sources.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-10 md:py-14">
        {orderedCategories.map((category) => {
          const pages = allPages.filter((page) => page.category === category);
          if (pages.length === 0) return null;

          return (
            <section key={category} className="mb-12">
              <h2 className="font-display uppercase text-2xl md:text-3xl mb-5 border-b-4 border-foreground pb-2">
                {learnCategoryLabels[category]}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages.map((page) => (
                  <Link
                    key={page.slug}
                    to={`/learn/${page.slug}`}
                    className="border-4 border-foreground p-5 bg-card hover:bg-secondary/40 transition-colors group flex flex-col"
                  >
                    <h3 className="font-display text-lg group-hover:text-primary leading-tight">
                      {page.h1}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">
                      {page.shortAnswer}
                    </p>
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
            <h2 className="font-display uppercase text-2xl md:text-3xl mb-3">Ready to check your options?</h2>
            <p className="text-muted-foreground mb-4">
              Broadband technology and availability are address-specific. Run a postcode check or
              speak to the team about a home or business requirement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="font-display uppercase">
                <Link to="/order">Check my address</Link>
              </Button>
              <Button asChild variant="outline" className="font-display uppercase">
                <Link to="/landline">Digital Home Phone</Link>
              </Button>
            </div>
          </div>
          <LeadCaptureWidget source="learn-hub" compact />
        </div>
      </section>
    </Layout>
  );
}
