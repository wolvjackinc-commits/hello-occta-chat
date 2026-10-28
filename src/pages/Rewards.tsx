import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { logClientEvent } from "@/lib/activityLog";
import { supabase } from "@/integrations/supabase/client";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { GiftLockArt } from "@/components/brand/illustrations";

type PublicBenefit = {
  id: string; benefit_name: string; description: string | null; value_label: string | null;
  terms_text: string | null; plan_type: string; customer_type: string;
  starts_at: string | null; ends_at: string | null;
};

const facts = [
  "Rewards will be tied to cleared payments, not sign-ups.",
  "Eligibility rules and fraud checks will be transparent and published.",
  "Price Lock 24 customers will have stronger rewards eligibility than Flex 30 customers.",
  "You'll see your reward status inside your customer dashboard once the programme is live.",
];

export default function RewardsPage() {
  const { rewardsEnabled, isLoading } = usePlatformSettings();
  const [benefits, setBenefits] = useState<PublicBenefit[]>([]);

  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Rewards teaser", source_module: "marketing" });
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated types
      const { data } = await (supabase as any).rpc("get_public_contract_benefits");
      setBenefits((data ?? []) as PublicBenefit[]);
    })();
  }, []);

  // Until the programme is switched on, a "launching soon" page is all we'd
  // have to show. Send visitors to the live switching cashback offer instead.
  if (!isLoading && !rewardsEnabled) return <Navigate to="/broadband-cashback-offer" replace />;

  return (
    <Layout>
      <SEO
        title="OCCTA Rewards for broadband and SIM"
        description="The OCCTA Rewards programme is launching soon. Final reward values, eligibility and unlock rules will be published before activation."
        canonical="/rewards"
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Rewards" }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
            <div>
              <HeroKicker>Launching soon</HeroKicker>
              <HeroTitle>
                OCCTA <span className="text-primary">Rewards</span>
              </HeroTitle>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
                Our rewards programme is launching soon. Final reward values, eligibility, fraud rules and the unlock
                trigger will be published before activation — nothing here is guaranteed yet, and no live reward
                values are shown until we've confirmed them.
              </p>
              <div className="mt-8">
                {rewardsEnabled ? (
                  <p className="text-sm text-white/70">
                    Rewards are now enabled — see your dashboard for live reward status.
                  </p>
                ) : (
                  <Link to="/broadband">
                    <Button variant="hero" size="lg" className="font-display uppercase">Check Availability</Button>
                  </Link>
                )}
              </div>
            </div>
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-white p-8">
                <GiftLockArt className="mx-auto h-auto w-full max-w-[240px]" />
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <SectionEyebrow index="01" label="So far" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">What we can tell you today</h2>
            </Reveal>
            <Reveal as="ol" stagger className="border-t-[3px] border-foreground">
              {facts.map((f, i) => (
                <motion.li key={f} variants={revealItem} className="grid grid-cols-[3.5rem_1fr] items-center gap-4 border-b-[3px] border-foreground py-6 sm:grid-cols-[5rem_1fr]">
                  <span aria-hidden className="font-display text-5xl leading-none text-foreground/25">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-lg">{f}</span>
                </motion.li>
              ))}
            </Reveal>
          </div>
        </BrandSection>

        {benefits.length > 0 && (
          <BrandSection tone="dark">
            <Reveal>
              <SectionEyebrow index="02" label="Live now" tone="dark" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Active benefits</h2>
            </Reveal>
            <Reveal stagger as="ul" className="mt-10 grid gap-5 md:grid-cols-2">
              {benefits.map((b) => (
                <motion.li key={b.id} variants={revealItem} className="border-[3px] border-white/25 p-6">
                  <p className="font-display text-2xl uppercase leading-none text-white">
                    {b.benefit_name}
                    {b.value_label && <span className="text-primary"> — {b.value_label}</span>}
                  </p>
                  {b.description && <p className="mt-3 text-sm text-white/70">{b.description}</p>}
                  {b.terms_text && <p className="mt-2 text-xs text-white/55">Terms: {b.terms_text}</p>}
                  <p className="mt-3 border-t border-white/15 pt-3 text-xs text-white/55">
                    Plan: {b.plan_type} · Customer: {b.customer_type}
                    {b.ends_at && ` · Until ${new Date(b.ends_at).toLocaleDateString()}`}
                  </p>
                </motion.li>
              ))}
            </Reveal>
          </BrandSection>
        )}
      </MotionConfig>
    </Layout>
  );
}
