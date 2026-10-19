import { useEffect } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { logClientEvent } from "@/lib/activityLog";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { ContractDocArt, SwitchArt } from "@/components/brand/illustrations";

const willConfirm = [
  "The provisional switch date and any expected downtime window.",
  "Any early termination charges from your current provider (you'll see these in your Contract Summary).",
  "Whether you can keep your home phone number.",
  "Any installation, router or supplier charges.",
];

const wontDo = [
  "Promise zero downtime — switches occasionally involve a short outage.",
  "Cancel your existing service without your consent.",
  "Lock you into anything before you've reviewed and accepted your Contract Summary.",
];

export default function SwitchingPage() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Switching page", source_module: "marketing" });
  }, []);

  return (
    <Layout>
      <SEO
        title="Switching your broadband to OCCTA"
        description="How OCCTA handles your broadband switch using One Touch Switch. Your current provider, dates, fees and any downtime risks are confirmed in your Contract Summary before you pay."
        canonical="/switching"
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
            <div>
              <HeroKicker>One Touch Switch</HeroKicker>
              <HeroTitle>
                Switching to <span className="text-primary">OCCTA</span>
              </HeroTitle>
              <p className="mt-6 max-w-[600px] text-lg leading-relaxed text-white/70">
                The UK telecoms industry uses One Touch Switch for residential broadband and home phone switches.
                When you accept your OCCTA Contract Summary, we coordinate with your losing provider so you don't
                have to ring them yourself.
              </p>
            </div>

            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-white p-6 sm:p-8">
                <SwitchArt />
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
            <div>
              <Reveal>
                <SectionEyebrow index="01" label="Before you pay" />
                <SectionTitle className="mt-5">What we'll confirm before you pay</SectionTitle>
              </Reveal>
              <Reveal as="ol" stagger className="mt-10 border-t-[3px] border-foreground">
                {willConfirm.map((item, i) => (
                  <motion.li
                    key={item}
                    variants={revealItem}
                    className="grid grid-cols-[3rem_1fr] gap-4 border-b-[3px] border-foreground py-6 sm:grid-cols-[4.5rem_1fr]"
                  >
                    <span className="font-display text-4xl leading-[0.85] text-foreground/25 sm:text-5xl">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex items-start gap-3 text-base leading-relaxed sm:text-lg">
                      <Check className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden />
                      {item}
                    </span>
                  </motion.li>
                ))}
              </Reveal>
            </div>
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <div className="mx-auto max-w-[360px] -rotate-2">
                <ContractDocArt />
              </div>
            </Reveal>
          </div>
        </BrandSection>

        <BrandSection tone="dark">
          <Reveal>
            <SectionEyebrow index="02" label="Straight answers" tone="dark" />
            <SectionTitle className="mt-5">What we won't do</SectionTitle>
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-4 md:grid-cols-3">
            {wontDo.map((item) => (
              <motion.div key={item} variants={revealItem} className="border-[3px] border-white/20 p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black" aria-hidden>
                  <X className="h-6 w-6" strokeWidth={3} />
                </span>
                <p className="mt-5 text-lg leading-relaxed text-white/85">{item}</p>
              </motion.div>
            ))}
          </Reveal>
        </BrandSection>

        <BrandSection tone="yellow">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <SectionEyebrow index="03" label="Next step" tone="yellow" />
              <p className="mt-6 max-w-[720px] text-xl leading-relaxed text-black/80">
                Ready to see what's available at your address? Final price, contract length, fees, speed and key
                terms will be confirmed in your Contract Summary before you pay.
              </p>
            </div>
            <Link to="/broadband">
              <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
                Check Availability
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
}
