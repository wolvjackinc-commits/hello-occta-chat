import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Check, ArrowRight, Phone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

/* Shared layout for the Flex and Contract Saver term pages. */
export default function TermPlanLayout({
  seo,
  kicker,
  title,
  intro,
  art,
  points,
  notes,
  crossSell,
}: {
  seo: ReactNode;
  kicker: string;
  title: ReactNode;
  intro: ReactNode;
  art: ReactNode;
  points: string[];
  notes: string[];
  crossSell: { title: string; body: string; to: string; label: string };
}) {
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

        <BrandSection tone="paper">
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal className="border-[3px] border-foreground bg-card">
              <div className="border-b-[3px] border-foreground bg-primary px-6 py-4 text-black">
                <SectionEyebrow index="01" label="Included" tone="yellow" />
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
                <SectionEyebrow index="02" label="Small print, big type" tone="dark" />
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

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <SectionEyebrow index="03" label="Compare" tone="yellow" />
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
