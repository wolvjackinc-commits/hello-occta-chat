import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Button } from "@/components/ui/button";
import {
  BadgePercent,
  Check,
  PoundSterling,
  Clock,
  Headset,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema } from "@/components/seo";

const planHighlights = [
  {
    name: "Startup Fibre",
    speed: "150 Mbps",
    marketPrice: "£25",
    price: "£24",
    summary: "Perfect for 1-5 seats, cloud apps, and POS reliability.",
    features: [
      "Unlimited data",
      "Smart router + WiFi 6",
      "4G failover ready",
      "Next-day setup",
    ],
  },
  {
    name: "Growth Fibre",
    speed: "500 Mbps",
    marketPrice: "£35",
    price: "£34",
    summary: "For growing teams that live on video, CRM, and file sync.",
    features: [
      "Unlimited data",
      "Priority support SLAs",
      "Guest WiFi portal",
      "Static IP included",
    ],
  },
  {
    name: "Scale Fibre",
    speed: "900 Mbps",
    marketPrice: "£55",
    price: "£54",
    summary: "High-traffic locations, studios, and multi-site teams.",
    features: [
      "Unlimited data",
      "Pro router + mesh",
      "Managed security",
      "4-hour fix target",
    ],
  },
];

const offers = [
  {
    title: "Switch & Save Credit",
    detail: "£100 migration credit to cover install or early-exit fees.",
  },
  {
    title: "4G Backup Free for 3 Months",
    detail: "Stay online when the street cabinet goes quiet.",
  },
  {
    title: "Phones On Us",
    detail: "Buy 5 hosted seats, get 2 extra desk phones free.",
  },
];

const serviceLines = [
  {
    title: "Hosted VoIP",
    range: "Market £9/seat · You pay £8/seat",
    description: "Crystal calls, call recording, mobile apps, and IVR flows.",
  },
  {
    title: "Managed WiFi",
    range: "Market £15/site · You pay £14/site",
    description: "Guest splash pages, bandwidth controls, and proactive tuning.",
  },
  {
    title: "Cyber Essentials",
    range: "Market £45/mo · You pay £44/mo",
    description: "Endpoint protection, DNS filtering, and monthly reporting.",
  },
  {
    title: "Leased Line Lite",
    range: "Market £249/mo · You pay £248/mo",
    description: "Symmetrical speeds with guaranteed uptime for mission-critical ops.",
  },
];

const Business = () => {
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

  const businessServiceSchema = createServiceSchema({
    name: 'OCCTA Business Broadband',
    description: 'Business fibre broadband with priority support, static IPs, and no contracts.',
    url: '/business',
    price: '24',
  });

  return (
    <LayoutComponent>
      <SEO 
        title="Business Broadband"
        description="Business fibre broadband from £24/mo. Static IPs, priority support, no contracts. Trusted by 5,000+ UK businesses."
        canonical="/business"
      />
      <StructuredData customSchema={businessServiceSchema} type="localBusiness" />
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 stamp text-accent border-accent">
                <BadgePercent className="w-4 h-4" />
                £1 under the market every time
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9]">
                BUSINESS
                <br />
                <span className="text-gradient">BROADBAND</span>
                <br />
                BUILT TO WIN
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Based on typical UK business connectivity ranges, every plan is set
                at least £1 lower than the standard market entry point. No sneaky
                mid-contract rises, just rock-solid service with a clear paper trail.
              </p>
              <div className="flex flex-wrap gap-2">
                {["No price hikes", "UK-based support", "Switch in days"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-background"
                  >
                    <Check className="w-4 h-4 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
              <Link to="/business-offers" className="inline-block mt-2">
                <Button size="lg" variant="hero" className="w-full sm:w-auto">
                  Build My Business Plan
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <div className="card-brutal bg-card p-6">
                <h2 className="font-display text-2xl mb-3">Market pulse</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Typical UK business broadband ranges from <strong>£25–£55</strong> per
                  month depending on speed, support, and SLA. We keep every tier £1
                  below comparable entry pricing.
                </p>
                <div className="grid gap-3">
                  {planHighlights.map((plan) => (
                    <div
                      key={plan.name}
                      className="flex items-center justify-between border-2 border-foreground/20 bg-background px-4 py-3"
                    >
                      <div>
                        <p className="font-display uppercase text-sm">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">Up to {plan.speed}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground line-through">{plan.marketPrice}</p>
                        <p className="font-display text-lg text-primary">{plan.price}/mo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: ShieldCheck, label: "24/7 monitoring" },
                  { icon: Headset, label: "Priority support" },
                  { icon: Clock, label: "Fast install" },
                  { icon: Wifi, label: "WiFi 6 routers" },
                ].map((item) => (
                  <div key={item.label} className="card-brutal bg-card p-4 flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-display-md mb-2">BUSINESS PLANS</h2>
            <p className="text-muted-foreground">
              All plans include unlimited data, no price rises, and UK support. Prices
              shown are ex VAT.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {planHighlights.map((plan) => (
              <div key={plan.name} className="card-brutal bg-card p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-2xl uppercase">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">Up to {plan.speed}</p>
                  </div>
                  <PoundSterling className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">{plan.summary}</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-sm text-muted-foreground line-through">{plan.marketPrice}</span>
                  <span className="font-display text-4xl text-primary">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {plan.features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-xs border border-foreground/10"
                    >
                      <Check className="w-3 h-3 text-primary" />
                      {feature}
                    </span>
                  ))}
                </div>
                <Link to="/business-sales" className="mt-auto">
                  <Button variant="outline" className="w-full">
                    Talk to Sales
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10">
            <div>
              <h2 className="text-display-md mb-3">SERVICES THAT STACK</h2>
              <p className="text-muted-foreground mb-6">
                Mix and match the services below. Every add-on is positioned at least
                £1 below typical market pricing so your monthly bill stays lean.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {serviceLines.map((service) => (
                  <div key={service.title} className="card-brutal bg-card p-5">
                    <h3 className="font-display text-lg uppercase mb-2">{service.title}</h3>
                    <p className="text-xs text-primary mb-2">{service.range}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-display-md">LIMITED OFFERS</h2>
              <p className="text-muted-foreground">
                Stack these offers with any plan. Available for new business customers
                until the end of the quarter.
              </p>
              {offers.map((offer) => (
                <div key={offer.title} className="card-brutal bg-card p-5">
                  <h3 className="font-display text-lg uppercase mb-1">{offer.title}</h3>
                  <p className="text-sm text-muted-foreground">{offer.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-display-md mb-4">READY TO OUTRUN YOUR CURRENT PROVIDER?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Tell us about your locations and team size. We will build a bespoke bundle
            that keeps you £1 ahead of market rates with the support your customers
            never notice because everything just works.
          </p>
          <Link to="/business-sales">
            <Button size="lg" variant="hero">
              Get My Business Quote
            </Button>
          </Link>
        </div>
      </section>
    </LayoutComponent>
  );
};

export default Business;
