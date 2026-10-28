import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Check, ArrowRight, Phone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";
import { useLiveBandPrices } from "@/lib/pricing/useLiveBandPrices";
import type { SpeedBucket } from "@/lib/pricing/fairPricing";

const BANDS: { key: SpeedBucket; name: string; speed: string; use: string }[] = [
  { key: "essential", name: "Essential Fibre", speed: "Up to 80Mbps", use: "Browsing, email, HD streaming for 1–2 people" },
  { key: "superfast", name: "Superfast Fibre", speed: "Up to 330Mbps", use: "Home working and 4K streaming for busy households" },
  { key: "ultrafast", name: "Ultrafast Fibre", speed: "Up to 550Mbps", use: "Large households, gaming and big downloads" },
  { key: "gigabit", name: "Gigabit Fibre", speed: "Up to 1000Mbps", use: "Heavy users, creators and many connected devices" },
];

/* Shared layout for the Flex 30 and Price Lock 24 term pages. */
export default function TermPlanLayout({
  seo,
  kicker,
  title,
  intro,
  art,
  points,
  notes,
  crossSell,
  term,
  faqs = [],
}: {
  seo: ReactNode;
  kicker: string;
  title: ReactNode;
  intro: ReactNode;
  art: ReactNode;
  points: string[];
  notes: string[];
  crossSell: { title: string; body: string; to: string; label: string };
  term: "lock24" | "flex30";
  faqs?: { q: string; a: string }[];
}) {
  const live = useLiveBandPrices(true);
  const priceFor = (b: SpeedBucket) => (live?.[b] ?? CHARGED_PRICES[b])[term];
  const otherFor = (b: SpeedBucket) => (live?.[b] ?? CHARGED_PRICES[b])[term === "lock24" ? "flex30" : "lock24"];
  return (
    <Layout>
      {seo}
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Broadband", to: "/broadband" }, { label: kicker }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-20">
            <div>
              <HeroKicker>{kicker}</HeroKicker>
              <HeroTitle>{title}</HeroTitle>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{intro}</p>
              <Link to="/broadband" className="mt-8 inline-block">
                <Button variant="hero" size="lg" className="font-display uppercase">
                  Check Availability <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-white p-8">{art}</div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection tone="light">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow index="01" label="Monthly prices, incl. VAT" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">{term === "lock24" ? "Price Lock 24 prices" : "Flex 30 prices"}</h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Residential prices from, including VAT. Your exact price, speed range and any one-off charges are confirmed for your address in your Contract Summary before you order.
            </p>
          </Reveal>
          <Reveal stagger as="ul" className="mt-8 grid gap-[3px] border-[3px] border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-4">
            {BANDS.map((b) => (
              <motion.li key={b.key} variants={revealItem} className="flex flex-col bg-card p-5">
                <p className="font-display text-xl uppercase leading-tight">{b.name}</p>
                <p className="mt-1 text-sm font-semibold">{b.speed}</p>
                <p className="mt-4 font-display text-5xl leading-none">£{priceFor(b.key).toFixed(2)}<span className="ml-1 font-sans text-sm font-semibold text-muted-foreground">/month</span></p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {term === "lock24" ? `Fixed for 24 months · Flex 30 £${otherFor(b.key).toFixed(2)}` : `30-day rolling · Price Lock 24 £${otherFor(b.key).toFixed(2)}`}
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/70">{b.use}</p>
                <Link to="/broadband" className="mt-5 inline-flex items-center gap-1.5 font-display text-base uppercase hover:underline">
                  Check my address <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.li>
            ))}
          </Reveal>
        </BrandSection>

        <BrandSection tone="paper">
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal className="border-[3px] border-foreground bg-card">
              <div className="border-b-[3px] border-foreground bg-primary px-6 py-4 text-black">
                <SectionEyebrow index="02" label="Included" tone="yellow" />
                <h2 className="mt-4 font-display text-4xl uppercase leading-none">What you get</h2>
              </div>
              <Reveal as="ul" stagger className="space-y-3 p-6">
                {points.map((p) => (
                  <motion.li key={p} variants={revealItem} className="flex gap-3 text-base">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span>{p}</span>
                  </motion.li>
                ))}
              </Reveal>
            </Reveal>
            <Reveal className="border-[3px] border-foreground bg-[hsl(0_0%_5%)] text-white">
              <div className="border-b-[3px] border-white/20 px-6 py-4">
                <SectionEyebrow index="03" label="Small print, big type" tone="dark" />
                <h2 className="mt-4 font-display text-4xl uppercase leading-none">Things to know</h2>
              </div>
              <ol className="divide-y divide-white/15 p-6 pt-2">
                {notes.map((n, i) => (
                  <li key={n} className="flex gap-4 py-3 text-sm leading-relaxed text-white/75">
                    <span className="font-display text-xl leading-none text-primary">{String(i + 1).padStart(2, "0")}</span>
                    {n}
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </BrandSection>

        {faqs.length > 0 && (
          <BrandSection tone="light">
            <Reveal>
              <SectionEyebrow index="04" label="Questions" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">Common questions</h2>
            </Reveal>
            <dl className="mt-8 grid gap-[3px] border-[3px] border-foreground bg-foreground md:grid-cols-2">
              {faqs.map((f) => (
                <div key={f.q} className="bg-card p-5">
                  <dt className="font-display text-xl uppercase leading-tight">{f.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-foreground/75">{f.a}</dd>
                </div>
              ))}
            </dl>
          </BrandSection>
        )}

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <SectionEyebrow index={faqs.length > 0 ? "05" : "04"} label="Compare" tone="yellow" />
              <h3 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">{crossSell.title}</h3>
              <p className="mt-4 max-w-xl text-lg text-black/75">{crossSell.body}</p>
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-black/70">
                <Phone className="h-4 w-4" /> Prefer to talk? Call 0800 260 6626.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={crossSell.to}>
                <Button variant="outline" size="lg" className="bg-white font-display uppercase text-black">
                  {crossSell.label} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/broadband">
                <Button size="lg" className="border-[3px] border-black bg-black font-display uppercase text-primary hover:bg-white hover:text-black">
                  Check Availability
                </Button>
              </Link>
            </div>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
}
