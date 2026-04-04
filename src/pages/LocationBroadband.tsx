import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Wifi, Shield, Clock, X, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema, createServiceSchema, createOfferSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { broadbandPlans } from "@/lib/plans";
import { getLocationBySlug } from "@/data/locations";
import { getFromPrices } from "@/lib/pricing/engine";
import NotFound from "@/pages/NotFound";

import { motion } from "framer-motion";

const LocationBroadband = () => {
  const { pathname } = useLocation();
  const slug = pathname.replace("/broadband-", "");
  const location = slug ? getLocationBySlug(slug) : undefined;

  if (!location) return <NotFound />;

  const broadbandServiceSchema = createServiceSchema({
    name: `OCCTA Broadband in ${location.city}`,
    description: `Fast, reliable fibre broadband in ${location.city} with speeds up to 900Mbps. No contracts, no price rises.`,
    url: `/broadband-${location.slug}`,
    price: '22.99',
  });

  const planOfferSchemas = broadbandPlans.map(plan => createOfferSchema({
    name: `OCCTA ${plan.name}`,
    description: `Fibre broadband up to ${plan.speed}Mbps in ${location.city}. No contract, cancel anytime. ${plan.features.slice(0, 3).join(', ')}.`,
    price: plan.price.toString(),
    url: `/pre-checkout?plans=${plan.id}`,
    sku: plan.id,
    category: 'Broadband',
  }));

  const faqSchema = createFAQSchema(location.faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Broadband", url: "/broadband" },
    { name: `Broadband in ${location.city}`, url: `/broadband-${location.slug}` },
  ]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      broadbandServiceSchema,
      ...planOfferSchemas,
      faqSchema,
      breadcrumbSchema,
    ],
  };

  const features = [
    { icon: X, text: "Cancel Anytime" },
    { icon: Shield, text: "No Hidden Fees" },
    { icon: Clock, text: "7-Day Setup" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
  };

  return (
    <Layout>
      <SEO
        title={`Cheap Broadband in ${location.city} - No Contract Fibre`}
        description={location.metaDescription}
        canonical={`/broadband-${location.slug}`}
        keywords={`cheap broadband ${location.city}, broadband ${location.city}, fibre broadband ${location.city}, no contract broadband ${location.city}, internet ${location.city}, ${location.region} broadband`}
        price="22.99"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      {/* Breadcrumb */}
      <div className="bg-secondary border-b-4 border-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/broadband" className="hover:text-foreground transition-colors">Broadband</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium truncate">Broadband in {location.city}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                {location.region}
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                BROADBAND IN
                <br />
                <span className="text-gradient">{location.city.toUpperCase()}</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                {location.intro}
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {features.map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-background"
                  >
                    <feature.icon className="w-3.5 h-3.5" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
              <PostcodeChecker />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-display-md mb-2">BROADBAND PLANS IN {location.city.toUpperCase()}</h2>
            <p className="text-muted-foreground">Unlimited data, no price rises. Available in {location.city}.</p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {broadbandPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className={`relative card-brutal bg-card p-5 flex flex-col ${plan.popular ? "border-primary" : ""}`}
                variants={cardVariants}
                whileHover={{ y: -6, x: -3, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                    Most Popular
                  </div>
                )}
                <div className={plan.popular ? "pt-2" : ""}>
                  <h3 className="font-display text-2xl mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-4xl">£{plan.price}</span>
                    <span className="text-foreground/70 text-sm font-medium">/mo</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-accent border-2 border-foreground inline-block">
                    <Wifi className="w-3 h-3 text-accent-foreground" />
                    <span className="font-display text-accent-foreground text-sm">Up to {plan.speed}Mbps</span>
                  </div>
                  <ul className="space-y-1.5 mb-4 flex-grow">
                    {plan.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/pre-checkout?plans=${plan.id}`}>
                    <Button variant={plan.popular ? "hero" : "outline"} className="w-full" size="sm">
                      Choose Plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      {location.faqs.length > 0 && (
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">
              Broadband in {location.city} — FAQs
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {location.faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground/10 bg-card px-4">
                  <AccordionTrigger className="font-display text-left text-base hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* Related Guides */}
      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-display uppercase mb-4">Broadband Guides</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "No Contract Broadband UK", desc: "How rolling monthly broadband works and who it suits.", path: "/guides/no-contract-broadband-uk" },
              { title: "Cheap Broadband UK", desc: "How to find affordable internet and avoid hidden costs.", path: "/guides/cheap-broadband-uk" },
              { title: "How to Switch Broadband", desc: "Step-by-step guide to switching provider.", path: "/guides/how-to-switch-broadband" },
            ].map((g) => (
              <Link key={g.path} to={g.path} className="card-brutal bg-card p-4 hover:bg-secondary transition-colors group">
                <h3 className="font-display text-base mb-1 group-hover:text-primary transition-colors">{g.title}</h3>
                <p className="text-sm text-muted-foreground">{g.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="card-brutal bg-card p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">
              Ready for Better Broadband in {location.city}?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              No contracts, no hidden fees, no price rises. Check what's available at your address.
            </p>
            <Link to="/broadband">
              <Button variant="hero" size="lg">
                View All Plans
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default LocationBroadband;
