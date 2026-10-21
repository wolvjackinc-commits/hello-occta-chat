import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Check, Minus, Shield, Zap, Phone, MapPin, ArrowRight } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { RollingDialArt, RouterArt, SimArt, VoiceArt } from "@/components/brand/illustrations";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, JsonLd, createFAQSchema, createOfferSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { getFromPrices } from "@/lib/pricing/engine";

const trustBadges = [
  { icon: Shield, text: "Flex 30 · No Fixed Minimum Term" },
  { icon: Check, text: "Charges Shown Before Acceptance" },
  { icon: MapPin, text: "UK-Wide Coverage" },
  { icon: Phone, text: "UK-Based Support" },
];

const whySwitchReasons = [
  "Flex 30 has no fixed minimum term where eligible",
  "Normal Flex 30 notice is 30 days",
  "No remaining-month ETF on Flex 30",
  "No scheduled CPI/RPI/percentage rise under contract version 2026.10.1",
  "Customer-specific charges shown before acceptance",
  "UK-based support",
];

const comparisonData = [
  { feature: "Minimum term", occta: "Flex 30: no fixed minimum term", others: "Varies by provider and tariff" },
  { feature: "Scheduled price change", occta: "No scheduled CPI/RPI/percentage rise under v2026.10.1", others: "Check the exact pounds-and-pence disclosure" },
  { feature: "Early termination", occta: "No remaining-month ETF on Flex 30; valid disclosed network charges may apply", others: "Depends on the accepted contract" },
  { feature: "Upfront/setup cost", occta: "Shown before acceptance", others: "Compare the current tariff" },
  { feature: "Flexibility", occta: "30-day rolling where eligible", others: "Rolling and fixed-term options vary" },
];

const faqs = [
  {
    question: "Does Flex 30 have a fixed minimum term?",
    answer: "Flex 30 has no fixed minimum term and normally uses 30 days’ notice. There is no remaining-month early termination charge on Flex 30. Separately valid network cease or migration charges may still apply where lawful, actually incurred and disclosed.",
  },
  {
    question: "Can I cancel whenever I want?",
    answer: "Flex 30 normally requires 30 days’ notice. There is no remaining-month Early Termination Charge, although a separately valid network cease or migration charge may apply where lawful, actually incurred and disclosed.",
  },
  {
    question: "Are there price increases later?",
    answer: "Under residential contract version 2026.10.1 there is no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring broadband subscription. Your accepted Contract Summary and Contract Information control the customer-specific terms.",
  },
  {
    question: "Is OCCTA available UK-wide?",
    answer: "We cover most of the UK through the Openreach network. Use our postcode checker to confirm availability at your address. If we can't serve you, we'll tell you straight — no messing about.",
  },
  {
    question: "Who is OCCTA best for?",
    answer: "Anyone tired of telecom tricks. Renters who move frequently. People who hate being locked in. Anyone who's been stung by a 'great introductory offer' that tripled after 12 months. Basically, anyone who wants honest broadband.",
  },
  {
    question: "How does OCCTA compare to BT, Sky, or TalkTalk?",
    answer: "OCCTA offers Flex 30 and Price Lock 24 where available. The exact term, price, speed information and any one-off or termination-related charges are shown before you accept the agreement.",
  },
];

const NoContractBroadband = () => {
  const { isAppMode } = useAppMode();
  const LayoutComponent = isAppMode ? AppLayout : Layout;
  const prices = getFromPrices();
  const faqSchema = createFAQSchema(faqs.slice(0, 6));
  const offerSchema = createOfferSchema({
    name: "Flex 30 Broadband",
    description: "Flex 30 broadband with no fixed minimum term where available. Exact pricing, speed information, setup and any applicable network charges are shown before acceptance.",
    price: prices.broadband,
    url: "/no-contract-broadband-uk",
    category: "Broadband",
  });

  return (
    <AvailabilityProvider>
      <LayoutComponent>
        <SEO
          title="Flex 30 Broadband UK: 30-Day Rolling, No Fixed Minimum Term"
          description={`Flex 30 broadband is a 30-day rolling option with no fixed minimum term where available. Broadband from £${prices.broadband}/mo; exact charges, speeds and availability are confirmed before acceptance.`}
          canonical="/no-contract-broadband-uk"
          keywords="Flex 30 broadband UK, rolling monthly broadband UK, flexible broadband, 30-day rolling broadband, Price Lock 24, OCCTA broadband"
          type="article"
          price={prices.broadband}
        />
        <JsonLd data={offerSchema} />
        <JsonLd data={faqSchema} />

      <MotionConfig reducedMotion="user">
      {/* Hero Section */}
      <PosterStage ghost="30">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Broadband", to: "/broadband" }, { label: "No-contract broadband" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20">
          <div>
            <HeroKicker>Flex 30 · Rolling monthly</HeroKicker>
            <HeroTitle size="md">
              No-Contract Broadband UK.{" "}
              <span className="block text-primary">Flex 30. Rolling Monthly.</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-xl font-semibold text-white/80">
              Broadband from{" "}
              <span className="text-primary">£{prices.broadband}/month</span>, with
              clear term, notice and charge information before acceptance.
            </p>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/65">
              Flex 30 is a 30-day rolling broadband option with no fixed minimum term
              where eligible. Normal notice is 30 days. Availability, speed information,
              setup, price and any applicable charges are confirmed before acceptance.
            </p>
            <div className="mt-8">
              <PostcodeChecker variant="hero" />
            </div>
            <Link to="/order" className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-primary">
              <span className="underline decoration-white/30 underline-offset-4 group-hover:decoration-primary">Compare Plans</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <TicketSlab className="mr-3 mb-3 hidden lg:block">
            <div className="border-[3px] border-white bg-white p-8">
              <RollingDialArt className="mx-auto h-auto w-full max-w-[240px]" />
            </div>
          </TicketSlab>
        </div>

        {/* Trust Badges */}
        <ul className="mt-14 grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
          {trustBadges.map((badge, index) => (
            <li
              key={index}
              className={`flex items-center gap-3 py-5 pr-4 text-sm font-semibold text-white/85 ${index % 2 === 1 ? "border-l border-white/15 pl-4" : ""} ${index >= 2 ? "border-t border-white/15 lg:border-t-0" : ""} ${index === 2 ? "lg:border-l lg:pl-4" : ""}`}
            >
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center bg-primary text-black">
                <badge.icon className="h-4 w-4" />
              </span>
              <span>{badge.text}</span>
            </li>
          ))}
        </ul>
      </PosterStage>

      {/* Why Switch Section */}
      <BrandSection tone="paper">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="01" label="Why switch" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">
              Why people are switching to{" "}
              <span className="relative isolate inline-block">OCCTA<span aria-hidden className="absolute -bottom-1 left-0 -z-10 h-3 w-full bg-primary" /></span>
            </h2>
          </Reveal>
          <Reveal as="ol" stagger className="border-t-[3px] border-foreground">
            {whySwitchReasons.map((reason, index) => (
              <motion.li key={index} variants={revealItem} className="group relative isolate border-b-[3px] border-foreground">
                <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-4 px-1 py-5 sm:grid-cols-[5rem_1fr]">
                  <span aria-hidden className="font-display text-4xl leading-none text-foreground/25 transition-colors group-hover:text-black sm:text-5xl">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-lg font-semibold transition-colors group-hover:text-black">{reason}</span>
                </div>
              </motion.li>
            ))}
          </Reveal>
        </div>
      </BrandSection>

      {/* Comparison Section */}
      <BrandSection tone="dark">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
          <div>
            <SectionEyebrow index="02" label="Side by side" tone="dark" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Flex 30 vs Typical Fixed-Term Broadband</h2>
          </div>
          <p className="text-lg text-white/70">Compare the contract features that matter before choosing any provider.</p>
        </Reveal>

        <Reveal className="mt-12 overflow-x-auto border-[3px] border-white/25">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b-[3px] border-white/25">
                <th scope="col" className="p-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Feature</th>
                <th scope="col" className="bg-primary p-4 font-display text-2xl uppercase leading-none text-black">OCCTA</th>
                <th scope="col" className="p-4 font-display text-2xl uppercase leading-none text-white/60">Typical fixed-term plan</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-white/15 last:border-b-0">
                  <th scope="row" className="p-4 align-top font-display text-lg uppercase leading-tight text-white">{row.feature}</th>
                  <td className="bg-white/[0.04] p-4 align-top">
                    <span className="flex items-start gap-2 text-sm font-medium text-white">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      {row.occta}
                    </span>
                  </td>
                  <td className="p-4 align-top">
                    <span className="flex items-start gap-2 text-sm text-white/60">
                      <Minus className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {row.others}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </BrandSection>

      {/* CTA Section */}
      <BrandSection tone="yellow" className="border-y-[3px] border-black">
        <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <SectionEyebrow index="03" label="Your move" tone="yellow" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Want a rolling broadband option?</h2>
            <p className="mt-4 max-w-xl text-lg text-black/75">
              Check availability at your address and see our plans. No commitment
              required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/order">
              <Button size="lg" className="border-[3px] border-black bg-black font-display uppercase text-primary hover:bg-white hover:text-black">
                <Zap className="mr-2 h-5 w-5" />
                View All Plans
              </Button>
            </Link>
            <Link to="/sim">
              <Button size="lg" variant="outline" className="bg-white font-display uppercase text-black">
                Explore SIM Plans
              </Button>
            </Link>
          </div>
        </Reveal>
      </BrandSection>

      {/* FAQ Section */}
      <BrandSection tone="light">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="04" label="Questions" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-foreground/70">
              Honest answers to common questions about no-contract broadband
            </p>
          </Reveal>
          <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-b-[3px] border-foreground">
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

      {/* Internal Links Section */}
      <BrandSection tone="dark">
        <Reveal>
          <SectionEyebrow index="05" label="Explore" tone="dark" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Explore More Services</h2>
        </Reveal>
        <Reveal stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { to: "/order", art: <RouterArt className="h-auto w-full" />, title: "Broadband Plans", desc: <>Compare all our broadband packages from £{prices.broadband}/month</> },
            { to: "/sim", art: <SimArt className="h-auto w-full" />, title: "SIM Plans", desc: <>Mobile plans with 30-day and fixed-term options from the live SIM catalogue</> },
            { to: "/landline", art: <VoiceArt className="h-auto w-full" />, title: "Home Phone", desc: <>Keep your number with Digital Home Phone from £{prices.landline}/month</> },
          ].map((s, i) => (
            <motion.div key={s.to} variants={revealItem}>
              <Link to={s.to} className="group flex h-full flex-col border-[3px] border-white/25 transition-colors hover:border-primary">
                <div className={`flex min-h-[160px] items-center justify-center border-b-[3px] border-white/25 p-6 ${i === 1 ? "bg-primary" : "bg-white"}`}>
                  <div className="w-full max-w-[200px]">{s.art}</div>
                </div>
                <div className="flex-1 p-6">
                  <h3 className="font-display text-3xl uppercase leading-none text-white group-hover:text-primary">{s.title}</h3>
                  <p className="mt-2 text-sm text-white/65">{s.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </Reveal>
      </BrandSection>
      </MotionConfig>
    </LayoutComponent>
    </AvailabilityProvider>
  );
};

export default NoContractBroadband;
