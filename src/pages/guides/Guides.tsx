import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { guides } from "@/data/guides";

const categories = [
  { key: "broadband" as const, label: "Broadband" },
  { key: "home-phone" as const, label: "Home Phone" },
  { key: "sim" as const, label: "SIM Plans" },
];

const Guides = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides", url: "/guides" },
  ]);

  return (
    <Layout>
      <SEO
        title="Guides — Broadband, Home Phone & SIM"
        description="Helpful guides on UK broadband, Digital Home Phone, and SIM plans. No-contract options, switching tips, and money-saving advice from OCCTA."
        canonical="/guides"
        keywords="broadband guide UK, home phone guide, SIM guide, internet tips, switching broadband, digital voice guide"
      />
      <StructuredData customOnly customSchema={breadcrumbSchema} />

      {/* Hero */}
      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-block stamp text-primary border-primary mb-4">
              <BookOpen className="w-4 h-4 inline mr-2" />
              Resource Centre
            </div>
            <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
              GUIDES &<br />
              <span className="text-gradient">RESOURCES</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Practical advice on broadband, home phone, and mobile. No jargon, no sales pitch — just useful information.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Guides by Category */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {categories.map((cat) => {
            const catGuides = guides.filter((g) => g.category === cat.key);
            if (catGuides.length === 0) return null;
            return (
              <div key={cat.key} className="mb-12 last:mb-0">
                <h2 className="text-2xl font-display uppercase mb-4 text-foreground">{cat.label}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catGuides.map((guide) => (
                    <motion.div
                      key={guide.slug}
                      whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                      transition={{ duration: 0.12 }}
                    >
                      <Link
                        to={`/guides/${guide.slug}`}
                        className="block card-brutal bg-card p-5 h-full group"
                      >
                        <span className="text-xs font-display uppercase text-primary mb-2 block">{guide.categoryLabel}</span>
                        <h3 className="font-display text-xl mb-2 group-hover:text-primary transition-colors">{guide.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{guide.description}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-display text-primary">
                          Read guide <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Layout>
  );
};

export default Guides;
