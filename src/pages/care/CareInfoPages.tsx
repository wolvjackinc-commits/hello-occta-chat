import { useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { logClientEvent } from "@/lib/activityLog";
import { CareDDGuarantee, CareNotIncluded, CarePlanCards, CareSubnav } from "@/components/care/CareBits";
import {
  CARE_FAQ, CARE_FREQUENCIES, CARE_PLANS, CARE_RULES, CARE_TERMS_PATH, CARE_TERMS_SUMMARY, CARE_TERMS_VERSION, careKeyFacts, carePriceMinor, pounds,
} from "../../../supabase/functions/_shared/careTerms.ts";

function Hero({ kicker, title, crumb, children }: { kicker: string; title: string; crumb: string; children?: React.ReactNode }) {
  return (
    <PosterStage>
      <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "OCCTA Care", to: "/care" }, { label: crumb }]} />
      <HeroKicker>{kicker}</HeroKicker>
      <HeroTitle size="sm">{title}</HeroTitle>
      {children}
    </PosterStage>
  );
}

const JOURNEY = [
  { t: "You join", d: "In My OCCTA (or with a secure link we email after a call). You see the price, the key facts and the terms before you agree, and you confirm with a one-time code. Nothing is set up until you do." },
  { t: "We write to you", d: "A welcome pack and a Direct Debit confirmation arrive by post and email. Keep them: they're your record of what you agreed." },
  { t: "14 days to think", d: "Nothing is taken during your cooling-off period. Cancel for any reason and you pay nothing. You can use Care straight away if you ask." },
  { t: "Your first payment", d: "On the 1st or 15th (your choice) after the cooling-off period. We tell you the date and amount in writing at least 10 working days before." },
  { t: "Use it", d: "Call, chat or book help in My OCCTA → Care. We log what we help with, so your reminders show what you've used." },
  { t: "Reminders", d: "Monthly members: a check-in every 6 months. Yearly and 3-monthly members: a renewal letter 30 days before each payment." },
  { t: "Leave any time", d: "Cancel button, phone, email, letter or chat. Written confirmation the same working day. Prepaid time you won't use is refunded." },
];

export function CareHowItWorks() {
  useEffect(() => { logClientEvent({ event_type: "page_view", title: "OCCTA Care how it works", source_module: "care" }); }, []);
  return (
    <Layout>
      <SEO title="How OCCTA Care works | Payments, letters and cancelling" description="How OCCTA Care works from joining to leaving: 14-day cooling-off with nothing taken, its own Direct Debit with 10 working days' notice, written confirmation of everything, and cancel any time with no exit fee." canonical="/care/how-it-works" />
      <Hero kicker="How it works" title="From joining to leaving, step by step" crumb="How it works" />
      <CareSubnav />
      <BrandSection tone="paper">
        <SectionEyebrow index="01" label="The journey" />
        <ol className="mt-6 max-w-3xl space-y-4">
          {JOURNEY.map((s, i) => (
            <li key={s.t} className="flex gap-4 border-[3px] border-foreground bg-background p-4">
              <span className="font-display text-3xl leading-none">{i + 1}</span>
              <div><p className="font-display uppercase">{s.t}</p><p className="mt-1 text-sm text-foreground/75">{s.d}</p></div>
            </li>
          ))}
        </ol>
      </BrandSection>
      <BrandSection>
        <SectionEyebrow index="02" label="Paying for Care" />
        <SectionTitle>Its own Direct Debit, so it never tangles with your broadband</SectionTitle>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ul className="space-y-3 text-sm">
            <li>Collected by <strong>APS Re OCCTA</strong> (Service User Number 538166). Your statement shows a reference starting <strong>OCCTA CARE-</strong>.</li>
            <li>OCCTA takes Care payments by Direct Debit only. We will never ask for card details.</li>
            <li>If a payment is returned, we tell you and try once more after fresh notice. After 2 missed payments we pause Care. No fees, no debt collectors.</li>
            <li>If money is tight, tell us. We'll pause or cancel Care free, and help with your other OCCTA bills.</li>
          </ul>
          <CareDDGuarantee />
        </div>
      </BrandSection>
      <BrandSection tone="paper">
        <SectionEyebrow index="03" label="Extra support" />
        <SectionTitle>Tell us what helps</SectionTitle>
        <p className="mt-4 max-w-3xl text-sm">
          Large print, Braille, a carer or relative helping, more time on the phone, or just a call instead of email: tell us when you join or any time after.
          We only record it with your consent and you can ask us to remove it. People aged {CARE_RULES.extraCheckAge} or over, and anyone who tells us about support needs,
          get a quick call from us before their Direct Debit is set up, to make sure Care is right for them. Read our{" "}
          <Link to="/legal/vulnerable-customers" className="underline">Vulnerable Customers Policy</Link>.
        </p>
      </BrandSection>
    </Layout>
  );
}

export function CareFaqPage() {
  useEffect(() => { logClientEvent({ event_type: "page_view", title: "OCCTA Care FAQ", source_module: "care" }); }, []);
  return (
    <Layout>
      <SEO title="OCCTA Care questions | Is it insurance? How do I cancel?" description="Answers about OCCTA Care: it's a support service, not insurance; nothing is taken for 14 days; its own Direct Debit; cancel any time; what it doesn't include and how OCCTA router swaps work." canonical="/care/faq" />
      <StructuredData customSchema={createFAQSchema(CARE_FAQ.map((f) => ({ question: f.q, answer: f.a })))} />
      <Hero kicker="Questions" title="OCCTA Care questions, answered straight" crumb="Questions" />
      <CareSubnav />
      <BrandSection tone="paper">
        <dl className="max-w-3xl space-y-6">
          {CARE_FAQ.map((f) => (
            <div key={f.q} className="border-b-2 border-foreground/20 pb-5">
              <dt className="font-display text-lg uppercase">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-foreground/80">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm">Something else? Call 0800 260 6626 or ask Ollie in the chat.</p>
      </BrandSection>
    </Layout>
  );
}

export function CareKeyFactsPage() {
  useEffect(() => { logClientEvent({ event_type: "page_view", title: "OCCTA Care key facts", source_module: "care" }); }, []);
  return (
    <Layout>
      <SEO title="OCCTA Care key facts | Prices, payments, cancelling" description="OCCTA Care key facts: Care Essentials £4.99 a month, Care Plus £8.99 a month, VAT included. Own Direct Debit, nothing taken for 14 days, no minimum term, cancel any time. Not insurance." canonical="/care/key-facts" />
      <Hero kicker="Key facts" title="OCCTA Care key facts" crumb="Key facts">
        <p className="mt-4 max-w-2xl text-white/75">Print or save this page. It's the same summary you see just before you agree.</p>
      </Hero>
      <CareSubnav />
      <BrandSection tone="paper">
        <p className="max-w-3xl text-base leading-relaxed">{CARE_TERMS_SUMMARY}</p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full max-w-3xl border-[3px] border-foreground text-sm">
            <thead><tr className="bg-foreground text-background"><th className="p-2 text-left">Plan</th>{CARE_FREQUENCIES.map((f) => <th key={f.code} className="p-2 text-left">{f.label}</th>)}</tr></thead>
            <tbody>
              {CARE_PLANS.map((p) => (
                <tr key={p.code} className="border-t-2 border-foreground">
                  <td className="p-2 font-display uppercase">{p.name}</td>
                  {CARE_FREQUENCIES.map((f) => <td key={f.code} className="p-2">{pounds(carePriceMinor(p.code, f.code))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Prices include VAT. Yearly = 10 times the monthly price (2 months free).</p>
        </div>
        <h2 className="mt-10 font-display text-xl uppercase">Example: Care Essentials, monthly</h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm">
          {careKeyFacts({ planCode: "essentials", frequency: "monthly", priceMinor: 499, collectionDay: 1 }).map((k) => <li key={k}>{k}</li>)}
        </ul>
        <CareNotIncluded className="mt-8 max-w-3xl" />
        <p className="mt-6 text-sm"><Link to={CARE_TERMS_PATH} className="underline">Full terms, version {CARE_TERMS_VERSION}</Link></p>
      </BrandSection>
      <BrandSection>
        <SectionEyebrow index="01" label="What each plan includes" />
        <div className="mt-6"><CarePlanCards ctaTo={(plan, freq) => `/care/join?plan=${plan}&frequency=${freq}`} /></div>
      </BrandSection>
    </Layout>
  );
}
