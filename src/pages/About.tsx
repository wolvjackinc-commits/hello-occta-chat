import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Building2, FileCheck2, Lock, Network, Phone, Repeat, ShieldCheck, Smartphone, Wifi, PhoneCall, Briefcase, Scale, HeartHandshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

const gbp = (n: number) => `£${n.toFixed(2)}`;

const products: { icon: LucideIcon; title: string; body: string; to: string; cta: string }[] = [
  {
    icon: Wifi,
    title: "Home broadband",
    body: `Four speed bands from Essential (up to 80Mbps) to Gigabit (up to 1000Mbps), on full fibre or part fibre depending on your address. Price Lock 24 from ${gbp(CHARGED_PRICES.essential.lock24)} a month, or Flex 30 rolling from ${gbp(CHARGED_PRICES.essential.flex30)}.`,
    to: "/broadband",
    cta: "Broadband plans",
  },
  {
    icon: PhoneCall,
    title: "Digital Voice",
    body: "A home phone line that runs over your broadband, ready for the UK's switch from copper landlines. Keep your existing number where porting is available.",
    to: "/broadband-and-digital-voice",
    cta: "Digital Voice",
  },
  {
    icon: Smartphone,
    title: "SIM only",
    body: "SIM plans on the O2, Vodafone and EE networks, as a physical SIM or eSIM. Keep your number with a PAC code, with 30-day rolling and 24-month options.",
    to: "/sim",
    cta: "SIM plans",
  },
  {
    icon: Briefcase,
    title: "Business",
    body: "Business broadband, hosted voice, business SIMs and bundles, quoted from your actual site requirement with ex-VAT and inc-VAT pricing in writing before you commit.",
    to: "/business",
    cta: "Business services",
  },
];

const commitments: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileCheck2, title: "Contract Summary first", body: "You see your price, minimum term, speeds, notice period and every one-off charge in your Contract Summary before you're asked to agree. Your agreement starts only when you accept." },
  { icon: Lock, title: "No inflation-linked price rises", body: "Our residential contracts contain no CPI, RPI or percentage-based annual increases. Price Lock 24 keeps your broadband price fixed for the 24-month term." },
  { icon: Repeat, title: "Real choice of term", body: "Flex 30 is rolling with no minimum term and no remaining-month exit charge. Price Lock 24 trades a longer term for a lower, fixed monthly price." },
  { icon: Network, title: "Open internet", body: "We don't block or throttle lawful apps or content for commercial reasons, and standard residential broadband has no monthly data cap unless your order says otherwise." },
  { icon: ShieldCheck, title: "Straightforward payment", body: "Bills are paid by Direct Debit, protected by the Direct Debit Guarantee, or by bank transfer. We never take card details or payments over the phone." },
  { icon: HeartHandshake, title: "Extra help when it's needed", body: "Priority handling, telecare resilience assessments, payment arrangements, accessible formats and nominated contacts — free and confidential." },
  { icon: Scale, title: "Accountable when things go wrong", body: "Complaints are acknowledged within 2 working days, with free access to independent Alternative Dispute Resolution after 6 weeks or deadlock." },
  { icon: Building2, title: "Easy switching", body: "We take part in Ofcom's One Touch Switch, so you only need to talk to your new provider — whether you're joining us or leaving." },
];

const howItWorks = [
  { title: "Check your address", body: "We check the exact products available on your line — full fibre or part fibre, and the realistic speed range — against network data for your address." },
  { title: "See your first bill before you order", body: "Choose Price Lock 24 or Flex 30, bring your own router or add one, and see the full cost, including your first invoice, before you commit." },
  { title: "We handle the switch", body: "We order the service on the access network, coordinate any switch with your current provider and confirm your go-live date. Engineers are booked only when the work needs one." },
  { title: "Billing starts at go-live", body: "You're only billed once your service is confirmed live. Your account shows invoices, Direct Debit status, tickets and your contract documents." },
];

const About = () => {
  const facts = [
    { label: "Company", value: companyConfig.name },
    { label: "Registered in", value: "England & Wales" },
    { label: "Company number", value: companyConfig.companyNumber },
    { label: "VAT number", value: companyConfig.vatNumber },
    { label: "Registered office", value: companyConfig.address.oneLine },
  ];

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "About", url: "/about" },
  ]);

  return (
    <Layout>
      <SEO
        title="About OCCTA - UK Broadband, Digital Voice & SIM Provider"
        description="OCCTA LIMITED is a UK telecoms provider based in Huddersfield, supplying home and business broadband, Digital Voice and SIM-only plans with Contract Summary-first pricing and no inflation-linked price rises."
        canonical="/about"
        keywords="OCCTA, about OCCTA, UK telecom company, Huddersfield broadband provider, no CPI price rises, honest broadband, UK internet provider"
      />
      <StructuredData type="organization" />
      <StructuredData customOnly customSchema={breadcrumb} />
      <MotionConfig reducedMotion="user">
        <PosterStage ghost="UK">
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "About" }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
            <div>
              <HeroKicker>About OCCTA</HeroKicker>
              <HeroTitle>
                Telecom with
                {" "}<span className="block text-primary">clear terms.</span>
              </HeroTitle>
              <p className="mt-6 max-w-[580px] text-lg leading-relaxed text-white/70">
                OCCTA LIMITED is a UK communications provider supplying broadband, Digital Voice home phone and SIM-only plans to homes and businesses.
                We built OCCTA around one idea: you should know exactly what you'll pay, for how long, and how to leave — before you sign anything.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/broadband">
                  <Button size="lg" variant="hero">
                    Check your address
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <a href={companyConfig.phone.href}>
                  <Button size="lg" variant="outline">
                    <Phone className="w-5 h-5" />
                    {companyConfig.phone.display}
                  </Button>
                </a>
              </div>
            </div>

            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-[hsl(0_0%_8%)]">
                <div className="flex items-center justify-between border-b-[3px] border-white bg-primary px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                  <span>Company facts</span>
                  <span>Companies House</span>
                </div>
                <dl>
                  {facts.map((f) => (
                    <div key={f.label} className="border-b border-white/15 px-5 py-3.5 last:border-b-0">
                      <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{f.label}</dt>
                      <dd className="mt-1 font-display text-xl leading-tight text-white sm:text-2xl">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        {/* What we do */}
        <BrandSection tone="paper">
          <Reveal className="max-w-3xl">
            <SectionEyebrow index="01" label="What we provide" />
            <SectionTitle className="mt-5">Broadband, phone and mobile</SectionTitle>
            <p className="mt-5 text-lg leading-relaxed text-foreground/70">
              Our services run on the UK's established wholesale networks — the national access network for broadband and Digital Voice, and the O2, Vodafone and EE mobile networks for SIMs.
              Your contract, billing and support are with OCCTA, and our UK team looks after your account from order to go-live and beyond.
            </p>
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <motion.div key={p.title} variants={revealItem} className="flex flex-col border-[3px] border-foreground bg-card p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><p.icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-4 font-display text-2xl uppercase leading-none">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{p.body}</p>
                <Link to={p.to} className="mt-4 inline-flex items-center gap-1.5 font-display text-base uppercase hover:underline">
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </Reveal>
        </BrandSection>

        {/* How it works */}
        <BrandSection tone="light">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <SectionEyebrow index="02" label="How we work" />
              <SectionTitle className="mt-5">From address check to go-live</SectionTitle>
              <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/70">
                No sales scripts, no doorstep selling and no surprise charges on your first bill. Every order follows the same four steps.
              </p>
            </Reveal>
            <Reveal as="ol" stagger className="border-t-[3px] border-foreground">
              {howItWorks.map((step, i) => (
                <motion.li key={step.title} variants={revealItem} className="grid grid-cols-[3.5rem_1fr] gap-4 border-b-[3px] border-foreground px-1 py-7 sm:grid-cols-[5.5rem_1fr]">
                  <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25 sm:text-7xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-2xl uppercase leading-none sm:text-3xl">{step.title}</h3>
                    <p className="mt-2 max-w-[560px] text-base leading-relaxed text-foreground/70">{step.body}</p>
                  </div>
                </motion.li>
              ))}
            </Reveal>
          </div>
        </BrandSection>

        {/* Commitments */}
        <BrandSection tone="dark">
          <Reveal className="max-w-3xl">
            <SectionEyebrow index="03" label="Written into our terms" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Our commitments</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              These aren't slogans. Each one is in our customer agreement or published policies, and you can hold us to them.
            </p>
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {commitments.map((c) => (
              <motion.div key={c.title} variants={revealItem} className="border-[3px] border-white/25 p-5">
                <c.icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-display text-xl uppercase leading-tight text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{c.body}</p>
              </motion.div>
            ))}
          </Reveal>
          <nav aria-label="Policies" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            {[
              { to: "/legal/code-of-practice", label: "Code of Practice" },
              { to: "/legal/price-transparency", label: "Price Transparency" },
              { to: "/legal/complaints-code", label: "Complaints Code" },
              { to: "/legal/vulnerable-customers", label: "Vulnerable Customers" },
              { to: "/legal/network-management", label: "Network Management" },
              { to: "/terms", label: "Terms of Service" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="underline-offset-4 hover:text-primary hover:underline">{l.label}</Link>
            ))}
          </nav>
        </BrandSection>

        {/* Contact */}
        <BrandSection tone="yellow" containerClassName="!py-12 md:!py-16">
          <Reveal className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <SectionEyebrow index="04" label="Talk to us" tone="yellow" />
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-black/80">
                <strong className="text-black">{companyConfig.name}</strong> is registered in England and Wales (company number {companyConfig.companyNumber}), VAT number {companyConfig.vatNumber}.
                Registered office: {companyConfig.address.full}. We operate online and by phone — the registered office isn't a shop.
                Our team is available {companyConfig.supportHours.weekday} on {companyConfig.phone.display} and at {companyConfig.email.general}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact"><Button size="lg" className="border-[3px] border-black bg-black text-primary hover:bg-transparent hover:text-black">Contact us</Button></Link>
              <Link to="/support"><Button size="lg" variant="outline" className="border-[3px] border-black bg-transparent text-black hover:bg-black hover:text-primary">Support hub</Button></Link>
            </div>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default About;
