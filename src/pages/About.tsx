import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { SEO, StructuredData } from "@/components/seo";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { BrandSection, HeroTitle, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

const About = () => {
  const stats = [
    { label: "Market", value: "United Kingdom" },
    { label: "Services", value: "Consumer & Business" },
    { label: "Contract Approach", value: "Clear Terms" },
    { label: "Broadband Options", value: "Flex 30 & Price Lock 24" },
  ];

  const values = [
    { title: "Honesty first", description: "We show the applicable price, minimum term, notice and one-off charges before you accept an agreement." },
    { title: "Humans over bots", description: "When you call us, a real person answers. They're probably drinking tea and genuinely want to help." },
    { title: "Keep it simple", description: "If your nan can't understand it, we haven't done our job. Simple plans, simple prices." },
    { title: "Give a toss", description: "About our customers and communities. We avoid unsupported environmental or social-impact claims and publish material commitments when they are verified." },
  ];

  return (
    <Layout>
      <SEO
        title="About OCCTA - UK Telecom Company"
        description="OCCTA is a UK telecom company offering broadband, SIM and Digital Voice services with clear customer-specific pricing and contract terms."
        canonical="/about"
        keywords="OCCTA, UK telecom company, cheap broadband provider, affordable internet UK, honest broadband, UK internet provider"
      />
      <StructuredData type="organization" />
      <MotionConfig reducedMotion="user">
        <PosterStage ghost="UK">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
            <div>
              <HeroTitle>
                About OCCTA —
                {" "}<span className="block text-primary">UK broadband &amp; telecom</span>
              </HeroTitle>
              <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-white/70">
                We built OCCTA to be the cheaper, simpler alternative to the big brands.
                Affordable telecom with Flex 30 and Price Lock 24 broadband options where offered, plus clear customer-specific terms before acceptance.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/broadband">
                  <Button size="lg" variant="hero">
                    View Our Services
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <a href={CONTACT_PHONE_TEL}>
                  <Button size="lg" variant="outline">
                    <Phone className="w-5 h-5" />
                    {CONTACT_PHONE_DISPLAY}
                  </Button>
                </a>
              </div>
            </div>

            {/* The company at a glance, printed as a spec sheet */}
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-[hsl(0_0%_8%)]">
                <div className="flex items-center justify-between border-b-[3px] border-white bg-primary px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                  <span>OCCTA Limited</span>
                  <span>At a glance</span>
                </div>
                <dl>
                  {stats.map((stat) => (
                    <div key={stat.label} className="border-b border-white/15 px-5 py-4 last:border-b-0">
                      <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{stat.label}</dt>
                      <dd className="mt-1 font-display text-3xl leading-none text-white">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        {/* Values */}
        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <SectionEyebrow index="01" label="Our values" />
              <SectionTitle className="mt-5">What we believe in</SectionTitle>
            </Reveal>
            <Reveal as="ol" stagger className="border-t-[3px] border-foreground">
              {values.map((value, i) => (
                <motion.li key={value.title} variants={revealItem} className="group relative isolate border-b-[3px] border-foreground">
                  <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                  <div className="grid grid-cols-[3.5rem_1fr] gap-4 px-1 py-7 sm:grid-cols-[5.5rem_1fr] md:py-9">
                    <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25 transition-colors group-hover:text-black sm:text-7xl">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-display text-2xl uppercase leading-none transition-colors group-hover:text-black sm:text-3xl">{value.title}</h3>
                      <p className="mt-2 max-w-[520px] text-base leading-relaxed text-foreground/70 transition-colors group-hover:text-black/80">{value.description}</p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </Reveal>
          </div>
        </BrandSection>

        {/* Legal info */}
        <BrandSection tone="yellow" containerClassName="!py-12 md:!py-16">
          <Reveal className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
            <SectionEyebrow index="02" label="Company details" tone="yellow" />
            <p className="max-w-4xl text-sm leading-relaxed text-black/75 md:text-base">
              <strong className="text-black">OCCTA LIMITED</strong> is registered in England and Wales (Company No. 13828933).
              We comply with GDPR and all UK telecommunications regulations.
            </p>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default About;
