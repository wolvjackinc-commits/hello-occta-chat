import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Button } from "@/components/ui/button";
import { Check, Globe, ShieldCheck, Wifi, Phone, Cloud, Server } from "lucide-react";
import { useAppMode } from "@/hooks/useAppMode";

const planOptions = [
  {
    name: "Startup Fibre",
    speed: "150 Mbps",
    price: "£24",
    summary: "Best for cafés, salons, and new offices (1-5 seats).",
    inclusions: ["Unlimited data", "WiFi 6 router", "4G failover ready", "Next-day install"],
  },
  {
    name: "Growth Fibre",
    speed: "500 Mbps",
    price: "£34",
    summary: "For busy teams on cloud tools, video, and CRM.",
    inclusions: ["Unlimited data", "Static IP", "Priority support", "Guest WiFi portal"],
  },
  {
    name: "Scale Fibre",
    speed: "900 Mbps",
    price: "£54",
    summary: "Studios, agencies, and high-traffic sites.",
    inclusions: ["Unlimited data", "Pro router + mesh", "Managed security", "4-hour fix target"],
  },
];

const serviceCatalog = [
  {
    title: "Hosted VoIP",
    price: "£8/seat",
    typical: "Typical £9-12/seat",
    icon: Phone,
    details: [
      "UK numbers, auto attendant, call recording",
      "Softphone apps for iOS/Android",
      "Call queues, hunt groups, voicemail to email",
    ],
  },
  {
    title: "Managed WiFi",
    price: "£14/site",
    typical: "Typical £15-20/site",
    icon: Wifi,
    details: [
      "Guest splash pages + access control",
      "Bandwidth shaping per device",
      "Monthly performance reports",
    ],
  },
  {
    title: "Secure DNS & Web Filtering",
    price: "£4/user",
    typical: "Typical £5-7/user",
    icon: ShieldCheck,
    details: [
      "Blocks phishing and malware domains",
      "Category-based content filtering",
      "Weekly threat summary",
    ],
  },
  {
    title: "Microsoft 365 Setup",
    price: "£19/seat (one-off)",
    typical: "Typical £20-35/seat",
    icon: Cloud,
    details: [
      "Migration planning + mailbox moves",
      "Domain setup + DNS changes",
      "Teams + SharePoint baseline",
    ],
  },
  {
    title: "Business Continuity 4G/5G",
    price: "£12/site",
    typical: "Typical £13-18/site",
    icon: Globe,
    details: [
      "Automatic failover to mobile data",
      "Multi-network SIM",
      "Monthly usage monitoring",
    ],
  },
  {
    title: "Leased Line Lite",
    price: "£248/mo",
    typical: "Typical £249-320/mo",
    icon: Server,
    details: [
      "Symmetric speeds from 100 Mbps",
      "99.9% uptime SLA",
      "Dedicated account manager",
    ],
  },
];

const offers = [
  {
    title: "Switch & Save Credit",
    detail: "£100 migration credit to cover install or early-exit fees.",
  },
  {
    title: "Multi-Site Discount",
    detail: "£5 off each additional location on the same billing account.",
  },
  {
    title: "Phone Bundle Boost",
    detail: "Buy 5 hosted seats, get 2 desk phones included.",
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
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9]">
                BUSINESS
                <br />
                PLAN BUILDER
              </h1>
              <p className="text-lg text-muted-foreground">
                Explore our business plans, stacked services, and limited offers. Every
                price is set at least £1 below typical market ranges so you stay lean
                without losing performance.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/business">
                  <Button variant="outline">Back to Business Overview</Button>
                </Link>
                <Link to="/support#contact">
                  <Button variant="hero">Talk to Sales</Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-display-md mb-2">CORE CONNECTIVITY PLANS</h2>
            <p className="text-muted-foreground">
              Choose the speed tier that fits your team today, then add services below.
              Prices shown are ex VAT.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {planOptions.map((plan) => (
              <div key={plan.name} className="card-brutal bg-card p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-2xl uppercase">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">Up to {plan.speed}</p>
                  </div>
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">{plan.summary}</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="font-display text-4xl text-primary">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {plan.inclusions.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-xs border border-foreground/10"
                    >
                      <Check className="w-3 h-3 text-primary" />
                      {item}
                    </span>
                  ))}
                </div>
                <Link to="/support#contact" className="mt-auto">
                  <Button variant="outline" className="w-full">
                    Request This Plan
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-display-md mb-2">STACKABLE SERVICES</h2>
            <p className="text-muted-foreground">
              Combine any service with your plan. Pricing is set below typical market
              ranges while maintaining SLA-backed support.
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {serviceCatalog.map((service) => (
              <div key={service.title} className="card-brutal bg-card p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <service.icon className="w-6 h-6 text-primary" />
                  <h3 className="font-display text-lg uppercase">{service.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{service.typical}</p>
                <p className="font-display text-2xl text-primary mb-4">{service.price}</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {service.details.map((detail) => (
                    <li key={detail} className="flex gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/support#contact" className="mt-auto pt-6">
                  <Button variant="outline" className="w-full">
                    Add to Plan
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
            <div>
              <h2 className="text-display-md mb-4">LIMITED-TIME OFFERS</h2>
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <div key={offer.title} className="card-brutal bg-card p-5">
                    <h3 className="font-display text-lg uppercase mb-2">{offer.title}</h3>
                    <p className="text-sm text-muted-foreground">{offer.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-brutal bg-card p-6">
              <h3 className="font-display text-xl mb-3">Need a custom bundle?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tell us your locations, headcount, and uptime requirements. We’ll
                design a plan that keeps you £1 ahead of market pricing without
                sacrificing performance.
              </p>
              <Link to="/support#contact">
                <Button variant="hero" className="w-full">
                  Build a Custom Quote
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LayoutComponent>
  );
};

export default BusinessOffers;
