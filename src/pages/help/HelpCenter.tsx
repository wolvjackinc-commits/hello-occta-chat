import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LifeBuoy, ArrowRight, MessageCircle, BookOpen } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { helpArticles, helpCategories } from "@/data/helpArticles";

const HelpCenter = () => {
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Help Centre", url: "/help" },
  ]);

  return (
    <Layout>
      <SEO
        title="Help Centre — OCCTA"
        description="Self-service guides for OCCTA customers. Getting started, billing, Wi-Fi fixes, Digital Voice, moving home and more. No queues, no jargon."
        canonical="/help"
        keywords="occta help, broadband help uk, self service broadband, occta support"
      />
      <StructuredData customOnly customSchema={breadcrumb} />

      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-block stamp text-primary border-primary mb-4">
              <LifeBuoy className="w-4 h-4 inline mr-2" /> Help Centre
            </div>
            <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
              GET HELP<br />
              <span className="text-gradient">FAST.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Most issues are fixed in under five minutes. Find your topic, follow the steps, and you're sorted.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {helpCategories.map((cat) => {
            const items = helpArticles.filter((a) => a.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="mb-12 last:mb-0">
                <h2 className="text-2xl font-display uppercase mb-4 text-foreground">{cat}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((a) => (
                    <motion.div key={a.slug} whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }} transition={{ duration: 0.12 }}>
                      <Link to={`/help/${a.slug}`} className="block card-brutal bg-card p-5 h-full group">
                        <span className="text-xs font-display uppercase text-primary mb-2 block">{a.readMinutes} min read</span>
                        <h3 className="font-display text-xl mb-2 group-hover:text-primary transition-colors">{a.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{a.description}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-display text-primary">
                          Read article <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mt-12 card-brutal bg-secondary p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <MessageCircle className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-display text-xl uppercase">Still stuck?</h3>
              <p className="text-sm text-muted-foreground">Chat with Ira (bottom-right) or email hello@occta.co.uk — we reply within a few hours, no scripts.</p>
            </div>
            <Link to="/guides" className="inline-flex items-center gap-2 px-4 py-2 border-2 border-foreground font-display uppercase text-sm hover:bg-primary hover:text-primary-foreground transition-colors">
              <BookOpen className="w-4 h-4" /> Browse guides
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default HelpCenter;