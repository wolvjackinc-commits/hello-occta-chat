import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import { faqCategories, faqs } from "@/data/faqs";

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

  return (
    <Layout>
      <SEO
        title="FAQs - OCCTA Help Center"
        description="Find answers to common broadband, mobile, landline, billing, and account questions in the OCCTA FAQ hub."
        canonical="/faq"
        keywords="OCCTA FAQ, broadband questions, mobile support, billing help, account support"
      />
      <StructuredData customSchema={faqSchema} type="localBusiness" />

      <section className="py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-display uppercase mb-3">Frequently Asked Questions</h1>
              <p className="text-muted-foreground text-lg">Browse every FAQ by category or search for a specific topic.</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 border-2 text-sm md:text-base leading-tight transition-colors whitespace-normal ${
                  !selectedCategory ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 hover:bg-secondary"
                }`}
              >
                All Topics
              </button>
              {faqCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 border-2 text-sm md:text-base leading-tight transition-colors flex items-center gap-2 whitespace-normal ${
                    selectedCategory === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 hover:bg-secondary"
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.title}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 border-4 border-foreground"
              />
            </div>

            <Accordion type="single" collapsible className="space-y-2">
              {filteredFaqs.map((faq, i) => (
                <AccordionItem key={faq.question} value={`faq-${i}`} className="border-4 border-foreground bg-card px-4">
                  <AccordionTrigger className="text-left whitespace-normal font-semibold text-base md:text-lg leading-relaxed tracking-normal py-4 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm md:text-base leading-relaxed text-muted-foreground pb-3 max-w-prose">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-foreground/30 mt-6">
                <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matching FAQs found. Try a different search term.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Faq;
