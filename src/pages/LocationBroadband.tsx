import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, Wifi, Shield, Clock } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema, createServiceSchema, createOfferSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { broadbandPlans } from "@/lib/plans";
import { getLocationBySlug } from "@/data/locations";
import { citySeoTitle, getLocationLocal } from "@/data/locationLocal";
import { getFromPrices } from "@/lib/pricing/engine";
import NotFound from "@/pages/NotFound";

import { MotionConfig, motion } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, NumberedLinkList, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { AddressPinArt } from "@/components/brand/illustrations";

const LocationBroadbandPage = () => {
  const { pathname } = useLocation();
  const slug = pathname.replace("/broadband-", "");
  const location = slug ? getLocationBySlug(slug) : undefined;

  if (!location) return <NotFound />;

  const prices = getFromPrices();
  const local = getLocationLocal(location.slug);
  const pageFaqs = local ? [...local.faqs, ...location.faqs.filter((faq) => !faq.answer.startsWith("Available speeds depend on the exact address"))] : location.faqs;
  const cityPageUrl = `/broadband-${location.slug}`;
  const broadbandServiceSchema = createServiceSchema({
    name: `OCCTA Broadband in ${location.city}`,
    description: `OCCTA broadband in ${location.city} with public speed bands up to 1000Mbps where available. Price Lock 24 or Flex 30 may be offered; exact address-specific speed information, setup and charges are confirmed before acceptance.`,
    url: cityPageUrl,
    price: prices.broadband,
  });

  const planOfferSchemas = broadbandPlans.map(plan => createOfferSchema({
    name: `OCCTA ${plan.name}`,
    description: `Fibre broadband speed band up to ${plan.speed}Mbps in ${location.city}. Price Lock 24 or Flex 30 where offered. Final address-specific availability, speeds, term and charges are confirmed before acceptance. ${plan.features.slice(0, 3).join(', ')}.`,
    price: plan.price.toString(),
    url: cityPageUrl,
    sku: plan.id,
    category: 'Broadband',
  }));

  const faqSchema = createFAQSchema(pageFaqs);
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
    { icon: Check, text: "Address-Specific Availability" },
    { icon: Shield, text: "Charges Shown Before Acceptance" },
    { icon: Clock, text: "Installation Date Confirmed" },
  ];

  return (
    <Layout>
      <SEO
        title={citySeoTitle(location.city)}
        description={local?.metaDescription || location.metaDescription}
        canonical={`/broadband-${location.slug}`}
        keywords={`affordable broadband ${location.city}, broadband ${location.city}, fibre broadband ${location.city}, flexible broadband ${location.city}, internet ${location.city}, ${location.region} broadband`}
        type="article"
        price={prices.broadband}
      />
      <StructuredData customOnly customSchema={combinedSchema} />


      <MotionConfig reducedMotion="user">
        {/* Hero */}
        <PosterStage ghost={location.city.length <= 6 ? location.city : undefined}>
          <PosterBreadcrumb
            items={[
              { label: "Home", to: "/" },
              { label: "Broadband", to: "/broadband" },
              { label: `Broadband in ${location.city}` },
            ]}
          />
          <div className="max-w-3xl">
            <HeroKicker>{location.region}</HeroKicker>
            <HeroTitle>
              Broadband in
              {" "}<span className="block text-primary">{location.city}</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              {local?.intro || location.intro}
            </p>
            <ul className="mt-6 mb-7 flex flex-wrap gap-2">
              {features.map((feature) => (
                <li
                  key={feature.text}
                  className="flex items-center gap-1.5 border border-white/20 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/85"
                >
                  <feature.icon className="w-3.5 h-3.5 text-primary" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
            <PostcodeChecker variant="hero" />
          </div>
        </PosterStage>

        {local && (
          <BrandSection tone="paper">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
              <Reveal>
                <SectionEyebrow index="01" label="Local guide" />
                <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">
                  {location.city} areas and postcodes
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">{local.guidance}</p>
                <dl className="mt-8 border-t-[3px] border-foreground">
                  <div className="grid gap-2 border-b-2 border-foreground/15 py-4 sm:grid-cols-[180px_1fr]">
                    <dt className="font-display text-lg uppercase leading-none">Local areas</dt>
                    <dd className="text-sm leading-relaxed text-foreground/75">{local.areas.join(", ")}.</dd>
                  </div>
                  <div className="grid gap-2 border-b-2 border-foreground/15 py-4 sm:grid-cols-[180px_1fr]">
                    <dt className="font-display text-lg uppercase leading-none">Postcode districts</dt>
                    <dd className="text-sm leading-relaxed text-foreground/75">
                      {local.postcodes.join(", ")}. These are Royal Mail districts, not a coverage guarantee.
                    </dd>
                  </div>
                  <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]">
                    <dt className="font-display text-lg uppercase leading-none">Nearby towns</dt>
                    <dd className="text-sm leading-relaxed text-foreground/75">
                      {local.nearby.join(", ")}. Use the checker on the full address if you live just outside {location.city}.
                    </dd>
                  </div>
                </dl>
              </Reveal>
              <Reveal className="lg:sticky lg:top-28 lg:self-start">
                <div className="border-[3px] border-foreground bg-white p-3">
                  <AddressPinArt />
                </div>
                <p className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/55">
                  Availability is checked per address, not per postcode
                </p>
              </Reveal>
            </div>
          </BrandSection>
        )}

        {/* Plans */}
        <BrandSection tone="dark">
          <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-end">
            <div>
              <SectionEyebrow index={local ? "02" : "01"} label="Speed bands" tone="dark" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">
                Broadband plans in {location.city}
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-white/70">Unlimited data where shown. Price Lock 24 or Flex 30 where offered in {location.city}; exact address-specific terms are confirmed before acceptance.</p>
          </Reveal>

          <Reveal stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {broadbandPlans.map((plan) => (
              <motion.article
                key={plan.id}
                variants={revealItem}
                className={`relative flex flex-col border-[3px] bg-white/[0.03] ${plan.popular ? "border-primary" : "border-white/25"}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-3 z-10 border-2 border-black bg-primary px-3 py-0.5 font-display text-xs uppercase tracking-wider text-black">
                    Most Popular
                  </div>
                )}
                <div className={`border-b-[3px] px-5 pt-6 pb-4 ${plan.popular ? "border-primary" : "border-white/25"}`}>
                  <h3 className="font-display text-3xl uppercase leading-none text-white">{plan.name}</h3>
                  <div className="mt-3 flex items-center gap-2 text-white/80">
                    <Wifi className="w-4 h-4 text-primary" />
                    <span className="font-display text-lg leading-none">Up to {plan.speed}Mbps</span>
                  </div>
                  <div className="mt-3 h-1 bg-white/10" aria-hidden>
                    <div className="h-full bg-primary" style={{ width: `${Math.min(Math.max(Number(plan.speed) / 10, 6), 100)}%` }} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-5xl leading-none text-primary">£{plan.price}</span>
                    <span className="text-white/70 text-sm font-medium">/mo</span>
                  </div>
                  <ul className="mt-4 mb-5 flex-grow space-y-1.5 border-t border-white/10 pt-4">
                    {plan.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs text-white/80">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/order`}>
                    <Button variant={plan.popular ? "hero" : "outline"} className="w-full" size="sm">
                      Choose Plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.article>
            ))}
          </Reveal>
        </BrandSection>

        {/* FAQs */}
        {pageFaqs.length > 0 && (
          <BrandSection tone="light">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
              <Reveal className="lg:sticky lg:top-28 lg:self-start">
                <SectionEyebrow index={local ? "03" : "02"} label="Questions" />
                <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">
                  Broadband in {location.city} — FAQs
                </h2>
              </Reveal>
              <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
                {pageFaqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-foreground">
                    <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight hover:no-underline sm:text-2xl">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </BrandSection>
        )}

        {/* Related Guides */}
        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal>
              <SectionEyebrow index={local ? (pageFaqs.length > 0 ? "04" : "03") : pageFaqs.length > 0 ? "03" : "02"} label="Keep reading" />
              <SectionTitle className="mt-5">Broadband Guides</SectionTitle>
            </Reveal>
            <NumberedLinkList
              items={[
                { title: "Flex 30 Broadband UK", desc: "How 30-day rolling broadband works, including notice and applicable charges.", path: "/guides/no-contract-broadband-uk" },
                { title: "Cheap Broadband UK", desc: "How to find affordable internet and avoid hidden costs.", path: "/guides/cheap-broadband-uk" },
                { title: "How to Switch Broadband", desc: "Step-by-step guide to switching provider.", path: "/guides/how-to-switch-broadband" },
              ]}
            />
          </div>
        </BrandSection>

        {/* CTA */}
        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">
                Ready for Better Broadband in {location.city}?
              </h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">
                Price Lock 24 or Flex 30 where eligible. No confusing mid-contract rises on Price Lock. Check what's available at your address.
              </p>
            </div>
            <Link to="/broadband">
              <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
                View All Plans
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const LocationBroadband = () => (
  <AvailabilityProvider>
    <LocationBroadbandPage />
  </AvailabilityProvider>
);

export default LocationBroadband;
