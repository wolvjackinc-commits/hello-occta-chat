import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { logClientEvent } from "@/lib/activityLog";
import { supabase } from "@/integrations/supabase/client";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { REFERRAL_FAQ, REFERRAL_RULES, REFERRAL_TERMS_PATH, REFERRAL_TERMS_SUMMARY, REFERRAL_TERMS_VERSION } from "@/lib/referral/terms";

const R = REFERRAL_RULES;

const STEPS = [
  { t: "Get your code", d: "Sign in to My OCCTA and open Refer a friend. You'll need a live service and an account that's up to date." },
  { t: "Share it", d: "Send your link or code to people you know. They use it before they place their order." },
  { t: "They join and pay", d: `Their service goes live and they pay their first ${R.invoicesRequired} bills in full and on time.` },
  { t: "We check, then credit you both", d: `After ${R.qualifyDays} days our team checks it. Once approved, the credit comes off your next bills. We email you when it's added, not before.` },
];

export default function ReferAFriend() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Refer a friend", source_module: "marketing" });
    let live = true;
    void (supabase.rpc as unknown as (fn: string) => Promise<{ data: { enabled?: boolean } | null }>)("referral_public_terms")
      .then(({ data }) => { if (live) setOpen(data?.enabled === true); })
      .catch(() => { if (live) setOpen(false); });
    return () => { live = false; };
  }, []);

  return (
    <Layout>
      <SEO
        title="Refer a friend to OCCTA | £25 bill credit"
        description={`Refer a friend to OCCTA broadband. When their service has been live ${R.qualifyDays} days and they've paid their first ${R.invoicesRequired} bills on time, you get £${R.rewards.residential.referrer} off your bill and they get £${R.rewards.residential.friend}. Bill credit only. Terms apply.`}
        canonical="/refer-a-friend"
      />
      <PosterStage>
        <HeroKicker>Refer a friend</HeroKicker>
        <HeroTitle>
          £{R.rewards.residential.referrer} for you. <span className="text-primary">£{R.rewards.residential.friend} for them.</span>
        </HeroTitle>
        <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-white/70">
          Know someone fed up with their broadband? Send them your OCCTA link. When they've been with us for {R.qualifyDays} days
          and paid their first {R.invoicesRequired} bills on time, you both get bill credit. Business friends earn
          £{R.rewards.business.referrer} for you and £{R.rewards.business.friend} for them (before VAT on business bills).
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {open === false ? (
            <p className="border-2 border-primary px-4 py-2 font-display uppercase text-sm text-primary" data-testid="referral-opening-soon">
              Opening soon — codes aren't available yet
            </p>
          ) : (
            <Button asChild size="lg"><Link to="/dashboard?tab=refer">Get my code</Link></Button>
          )}
          <Button asChild size="lg" variant="outline"><Link to={REFERRAL_TERMS_PATH}>Read the terms</Link></Button>
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <SectionEyebrow index="01" label="How it works" />
        <SectionTitle>Four steps, no catches hidden in the small print</SectionTitle>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="border-[3px] border-foreground bg-card p-5">
              <p className="font-display text-3xl">{i + 1}</p>
              <p className="mt-2 font-display uppercase">{s.t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </BrandSection>

      <BrandSection tone="paper">
        <SectionEyebrow index="02" label="The rules in one paragraph" />
        <p className="mt-4 max-w-3xl text-base leading-relaxed">{REFERRAL_TERMS_SUMMARY}</p>
        <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-5 text-sm text-foreground/75">
          <li>Your friend must be new to OCCTA, at a different address from you, and use your link or code before ordering.</li>
          <li>No overdue bill, returned Direct Debit, suspension or payment plan on either account at any point. Paying late afterwards doesn't put it right.</li>
          <li>Every reward is checked by our team before it's added. We only confirm it once it's on your account.</li>
          <li>Can't be combined with another offer (such as SWITCH50) on the same order.</li>
          <li>We can change or end the scheme with {R.noticeDays} days' notice. Referrals already made keep the terms they started under.</li>
        </ul>
        <p className="mt-4 text-sm">
          <Link to={REFERRAL_TERMS_PATH} className="underline">Full terms (version {REFERRAL_TERMS_VERSION})</Link>
        </p>
      </BrandSection>

      <BrandSection tone="paper">
        <SectionEyebrow index="03" label="Questions" />
        <dl className="mt-6 max-w-3xl space-y-5">
          {REFERRAL_FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-display uppercase">{f.q}</dt>
              <dd className="mt-1 text-sm text-foreground/75">{f.a}</dd>
            </div>
          ))}
        </dl>
      </BrandSection>
    </Layout>
  );
}
