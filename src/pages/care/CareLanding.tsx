import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { logClientEvent } from "@/lib/activityLog";
import { careApi } from "@/lib/care/api";
import { CareNotIncluded, CarePlanCards, CareSubnav } from "@/components/care/CareBits";
import { CARE_FAQ, CARE_TERMS_PATH, CARE_TERMS_VERSION } from "../../../supabase/functions/_shared/careTerms.ts";

const STEPS = [
  { t: "Pick a plan", d: "Essentials or Plus, paid monthly, every 3 months or yearly. Join in My OCCTA in about 3 minutes, or call us and we'll send you a link." },
  { t: "14 days to change your mind", d: "Nothing is taken in your first 14 days. You can start using Care straight away if you like." },
  { t: "Use it whenever", d: "Call, chat or book help from My OCCTA. Wi-Fi, phones, tablets, laptops, printers, email: our UK team will help." },
  { t: "Leave whenever", d: "No minimum term, no exit fee. Cancel in two clicks, or by phone, email, letter or chat." },
];

export default function CareLanding() {
  const [salesOpen, setSalesOpen] = useState(true);
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "OCCTA Care", source_module: "care" });
    careApi.catalogue().then((c) => setSalesOpen(c?.sales_open !== false)).catch(() => {});
  }, []);

  return (
    <Layout>
      <SEO
        title="OCCTA Care | UK home tech support from £4.99 a month"
        description="OCCTA Care: a UK help desk for your home Wi-Fi, phones, tablets and computers, device setup and data transfer, and next-day swaps of faulty OCCTA kit on Care Plus. From £4.99 a month. Not insurance. No minimum term, cancel any time."
        canonical="/care"
      />
      <StructuredData customSchema={createFAQSchema(CARE_FAQ.map((f) => ({ question: f.q, answer: f.a })))} />
      <PosterStage ghost="CARE">
        <HeroKicker>New for OCCTA customers</HeroKicker>
        <HeroTitle size="md">
          Tech help at home, <span className="text-primary">from people who answer.</span>
        </HeroTitle>
        <p className="mt-6 max-w-[680px] text-lg leading-relaxed text-white/75">
          OCCTA Care puts our UK team on call for your Wi-Fi, phones, tablets, laptops and printers, and sets up your new devices for
          you. From £4.99 a month, nothing taken for 14 days, cancel whenever you like.
        </p>
        <p className="mt-4 max-w-[680px] border-l-4 border-primary pl-4 text-sm text-white/80">
          Plain and simple: Care is a support service, not insurance. It doesn't pay for, repair or replace your own devices if they break,
          get damaged, lost or stolen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {salesOpen && <Link to="/care/join" className="border-[3px] border-primary bg-primary px-6 py-3 font-display uppercase text-black hover:bg-white">Join OCCTA Care</Link>}
          <Link to="/care/how-it-works" className="border-[3px] border-white/60 px-6 py-3 font-display uppercase text-white hover:border-primary">How it works</Link>
        </div>
      </PosterStage>
      <CareSubnav />

      <BrandSection tone="paper" id="plans">
        <SectionEyebrow index="01" label="Plans and prices" />
        <SectionTitle>Two plans. Prices include VAT. No surprises.</SectionTitle>
        <div className="mt-8">
          <CarePlanCards salesOpen={salesOpen} ctaTo={(plan, freq) => `/care/join?plan=${plan}&frequency=${freq}`} />
        </div>
        <CareNotIncluded className="mt-8" />
      </BrandSection>

      <BrandSection>
        <SectionEyebrow index="02" label="How it works" />
        <SectionTitle>Four steps, and the last one is as easy as the first</SectionTitle>
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
        <SectionEyebrow index="03" label="Our promises" />
        <SectionTitle>What we promise, in writing</SectionTitle>
        <ul className="mt-6 grid max-w-4xl gap-3 text-sm sm:grid-cols-2">
          {[
            "Its own Direct Debit with a reference starting OCCTA CARE-. Cancelling Care never touches your broadband.",
            "At least 10 working days' written notice before any payment, and 30 days' notice of any price rise, with a free exit.",
            "A letter and email confirming everything you agree to, and every change after that.",
            "If you pay monthly, a reminder every 6 months of what you've used and how to cancel. If you pay yearly or every 3 months, a reminder 30 days before renewal.",
            "If you haven't used Care in 6 months, we'll ask if you still want it.",
            "No late fees and no debt collectors for Care, ever. If money gets tight, tell us and we'll pause or cancel it free.",
          ].map((p) => <li key={p} className="border-l-4 border-primary bg-background p-3">{p}</li>)}
        </ul>
      </BrandSection>

      <BrandSection>
        <SectionEyebrow index="04" label="Questions" />
        <dl className="mt-6 max-w-3xl space-y-5">
          {CARE_FAQ.slice(0, 5).map((f) => (
            <div key={f.q}>
              <dt className="font-display uppercase">{f.q}</dt>
              <dd className="mt-1 text-sm text-foreground/75">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm">
          <Link to="/care/faq" className="underline">All questions</Link> · <Link to="/care/key-facts" className="underline">Key facts</Link> ·{" "}
          <Link to={CARE_TERMS_PATH} className="underline">Full terms ({CARE_TERMS_VERSION})</Link>
        </p>
      </BrandSection>
    </Layout>
  );
}
