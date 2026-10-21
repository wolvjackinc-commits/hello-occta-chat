import { useEffect, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Button } from "@/components/ui/button";
import { Cloud, Globe, Phone, Server, ShieldCheck, Wifi } from "lucide-react";
import { useAppMode } from "@/hooks/useAppMode";
import { businessPlans, businessServices } from "@/lib/businessData";
import { SEO } from "@/components/seo";
import { BusinessProductCard } from "@/components/business/BusinessKit";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { BuildingArt } from "@/components/brand/illustrations";

const serviceIcons: Record<string, typeof Wifi> = {
  "hosted-voip": Phone,
  "managed-wifi": Wifi,
  "secure-dns": ShieldCheck,
  "m365-setup": Cloud,
  "business-continuity": Globe,
  "leased-line-lite": Server,
};

const offers = [
  {
    title: "Switch & Save Credit",
    detail: "Any migration credit or support is confirmed in the written quote before order.",
  },
  {
    title: "Multi-Site Discount",
    detail: "Multi-site pricing is confirmed in the written quote for the locations ordered.",
  },
  {
    title: "Phone Bundle Boost",
    detail: "Any handset bundle is confirmed in the written quote before order.",
  },
];

const BusinessOffers = () => {
  const [isReady, setIsReady] = useState(false);
  const { isAppMode } = useAppMode();

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const LayoutComponent = isAppMode ? AppLayout : Layout;

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  return (
    <LayoutComponent>
      <SEO
        title="OCCTA business plans and offers"
        description="Explore OCCTA business plans, stacked services and current offers. Prices, terms and any promotional credits are confirmed in a written quote before you order."
        canonical="/business-offers"
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Plan builder" }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
            <div>
              <HeroKicker>For business</HeroKicker>
              <HeroTitle>
                Business
                {" "}<span className="block text-primary">plan builder</span>
              </HeroTitle>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
                Explore our business plans, stacked services, and limited offers. Prices, service levels, contract terms and any promotional credits are confirmed in a written business quote before order.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/business-sales">
                  <Button variant="hero" size="lg">Talk to Sales</Button>
                </Link>
                <Link to="/business">
                  <Button variant="outline" size="lg">Back to Business Overview</Button>
                </Link>
              </div>
            </div>
            <TicketSlab className="mr-3 mb-3 hidden lg:block">
              <div className="border-[3px] border-white bg-white p-6">
                <BuildingArt className="h-auto w-full" />
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-end">
            <div>
              <SectionEyebrow index="01" label="Connectivity" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Core connectivity plans</h2>
            </div>
            <p className="text-base text-foreground/70">
              Choose the speed tier that fits your team today, then add services below.
              Prices shown are ex VAT.
            </p>
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-6 lg:grid-cols-3">
            {businessPlans.map((plan, i) => (
              <BusinessProductCard
                key={plan.id}
                eyebrow={<>Up to {plan.speed}</>}
                name={plan.name}
                summary={plan.summary}
                price={
                  <div className="flex items-end gap-2">
                    <span className="font-display text-5xl leading-none">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                }
                features={plan.inclusions}
                ctaTo={`/business-checkout?plan=${plan.id}`}
                ctaLabel="Create This Plan"
                featured={i === 1}
              />
            ))}
          </Reveal>
        </BrandSection>

        <BrandSection tone="dark">
          <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-end">
            <div>
              <SectionEyebrow index="02" label="Add-ons" tone="dark" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Stackable services</h2>
            </div>
            <p className="text-base text-white/70">
              Combine any service with your plan. Pricing and support levels are confirmed in your written quote.
            </p>
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {businessServices.map((service) => {
              const Icon = serviceIcons[service.id] || Wifi;
              return (
                <motion.div key={service.id} variants={revealItem} className="flex flex-col border-[3px] border-white/25 p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><Icon className="h-5 w-5" /></span>
                    <h3 className="font-display text-2xl uppercase leading-none text-white">{service.title}</h3>
                  </div>
                  <p className="mt-4 text-sm text-white/60">{service.typical}</p>
                  <p className="mt-3 font-display text-3xl leading-none text-primary">{service.price}</p>
                  <ul className="mt-4 space-y-2 border-t border-white/15 pt-4 text-sm text-white/80">
                    {service.details.map((detail) => (
                      <li key={detail} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 bg-primary" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/business-checkout" className="mt-auto pt-6">
                    <Button variant="outline" className="w-full">
                      Add to Plan
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </Reveal>
        </BrandSection>

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <SectionEyebrow index="03" label="Offers" tone="yellow" />
                <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Limited-time offers</h2>
              </Reveal>
              <Reveal stagger as="ul" className="mt-8 border-t-[3px] border-black">
                {offers.map((offer) => (
                  <motion.li key={offer.title} variants={revealItem} className="border-b-[3px] border-black py-5">
                    <h3 className="font-display text-2xl uppercase leading-none">{offer.title}</h3>
                    <p className="mt-2 text-sm text-black/75">{offer.detail}</p>
                  </motion.li>
                ))}
              </Reveal>
            </div>
            <div className="relative mr-3 mb-3">
              <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 bg-black" />
              <div className="relative border-[3px] border-black bg-white p-7 text-black">
                <h3 className="font-display text-3xl uppercase leading-none">Need a custom bundle?</h3>
                <p className="mt-3 mb-6 text-sm text-black/70">
                  Tell us your locations, headcount, and uptime requirements. We’ll design a plan around them and
                  confirm the price and service levels in a written quote.
                </p>
                <Link to="/business-sales">
                  <Button className="w-full border-[3px] border-black bg-black text-primary hover:bg-primary hover:text-black">
                    Build a Custom Quote
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </BrandSection>
      </MotionConfig>
    </LayoutComponent>
  );
};

export default BusinessOffers;
