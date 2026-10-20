import { useMemo, useState, lazy, Suspense } from "react";
import { Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import { faqCategories, faqs } from "@/data/faqs";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage } from "@/components/brand/kit";

const Accordion = lazy(() => import("@/components/ui/accordion").then(m => ({ default: m.Accordion })));
const AccordionContent = lazy(() => import("@/components/ui/accordion").then(m => ({ default: m.AccordionContent })));
const AccordionItem = lazy(() => import("@/components/ui/accordion").then(m => ({ default: m.AccordionItem })));
const AccordionTrigger = lazy(() => import("@/components/ui/accordion").then(m => ({ default: m.AccordionTrigger })));

const Faq = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || faq.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const faqSchema = createFAQSchema(faqs.map((faq) => ({ question: faq.question, answer: faq.answer })));

  const chip = (active: boolean) =>
    `flex w-full items-center gap-2 border-[3px] px-4 py-2.5 text-left text-sm font-semibold leading-tight transition-colors ${
      active ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-card hover:border-foreground"
    }`;

  return (
    <Layout>
      <SEO
        title="FAQs — OCCTA broadband and SIM help"
        description="Find answers to common broadband, mobile, home phone, billing, and account questions in the OCCTA FAQ hub."
        canonical="/faq"
        keywords="OCCTA FAQ, broadband questions, mobile support, billing help, account support"
      />
      <StructuredData customSchema={faqSchema} />

      <PosterStage ghost="?">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "FAQs" }]} />
        <div className="max-w-3xl">
          <HeroKicker>Help centre</HeroKicker>
          <HeroTitle size="md">Frequently Asked Questions</HeroTitle>
          <p className="mt-6 text-lg leading-relaxed text-white/70">Browse every FAQ by category or search for a specific topic.</p>

          <div className="mt-8 flex border-[3px] border-white bg-white/[0.04] transition-colors focus-within:border-primary">
            <Search className="ml-5 h-5 w-5 flex-shrink-0 self-center text-white/50" aria-hidden />
            <Input
              type="text"
              aria-label="Search FAQs"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 border-0 bg-transparent pl-3 text-lg text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
          {/* Category rail */}
          <nav aria-label="FAQ topics" className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Topics</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button onClick={() => setSelectedCategory(null)} aria-pressed={!selectedCategory} className={chip(!selectedCategory)}>
                All Topics
              </button>
              {faqCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  aria-pressed={selectedCategory === cat.id}
                  className={chip(selectedCategory === cat.id)}
                >
                  <cat.icon className="w-4 h-4 flex-shrink-0" />
                  {cat.title}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0">
            <p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60" aria-live="polite">
              {filteredFaqs.length} {filteredFaqs.length === 1 ? "answer" : "answers"}
            </p>
            <Suspense fallback={null}>
              <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
                {filteredFaqs.map((faq, i) => (
                  <AccordionItem key={faq.question} value={`faq-${i}`} className="border-b-[3px] border-foreground">
                    <AccordionTrigger className="py-5 text-left whitespace-normal font-display text-xl uppercase leading-tight tracking-normal hover:no-underline sm:text-2xl">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-foreground/75 max-w-prose">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Suspense>

            {filteredFaqs.length === 0 && (
              <div className="mt-6 border-[3px] border-dashed border-foreground/30 bg-card py-10 text-center">
                <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matching FAQs found. Try a different search term.</p>
              </div>
            )}
          </div>
        </div>
      </BrandSection>
    </Layout>
  );
};

export default Faq;
