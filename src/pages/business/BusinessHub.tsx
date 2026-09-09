import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBundles, businessIndustries, businessFAQs } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { ArrowRight, Wifi, PhoneCall, Smartphone, Building2, CheckCircle2 } from "lucide-react";

const BusinessHub = () => (
  <Layout>
    <SEO
      title="Business Broadband, VoIP & SIM — UK"
      description="Business broadband from £34.99 ex VAT (£41.99 inc VAT), plus hosted VoIP and business SIM options. Address-led quoting, transparent VAT and final service terms confirmed before order."
      canonical="/business"
      keywords="business broadband UK, hosted VoIP UK, business SIM, SIP trunks UK, small business telecom, leased line UK"
    />

    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-3">
          <span className="inline-block px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase tracking-wider text-sm mb-6">
            For business
          </span>
          <h1 className="font-display text-5xl lg:text-7xl leading-[0.95] mb-6">
            Telecom built around the <span className="underline decoration-primary decoration-8">actual site</span>, not a placeholder price.
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Broadband, hosted VoIP and business SIMs with clear ex-VAT and inc-VAT pricing. We confirm network availability, setup, care level and the contractual price before anything is provisioned.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/business/quote"><Button variant="hero" size="lg">Build a business quote <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            <Link to="/business/contact-sales"><Button variant="outline" size="lg">Talk to sales</Button></Link>
          </div>
          <div className="mt-6 text-sm text-muted-foreground">Broadband from <strong>£34.99/mo ex VAT</strong> (£41.99 inc VAT), subject to address, route and term.</div>
        </div>
        <div className="lg:col-span-2 border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <LeadForm compact heading="Get a business call-back" source="business_hub_hero" />
        </div>
      </div>
    </section>

    <BusinessTrustBar />

    <section className="container mx-auto px-4 py-16">
      <h2 className="font-display text-4xl mb-10 text-center">One provider. Every service.</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: Wifi, title: "Business Broadband", desc: "SoGEA, full fibre, gigabit and dedicated connectivity with optional static IP, care upgrades and continuity.", to: "/business/broadband", price: 34.99 },
          { icon: PhoneCall, title: "Hosted VoIP & SIP", desc: "UK numbers, softphones and call routing with porting subject to number eligibility.", to: "/business/voice", price: 6.95, unit: "/seat/mo" },
          { icon: Smartphone, title: "Business SIMs", desc: "Business mobile options for teams, with exact allowance and roaming terms shown before order.", to: "/business/sim", price: 7.5, unit: "/line/mo" },
        ].map((s) => (
          <Link key={s.title} to={s.to} className="group border-4 border-foreground bg-background p-6 shadow-brutal hover:-translate-y-1 hover:-translate-x-1 hover:shadow-brutal-lg transition-all">
            <s.icon className="w-10 h-10 mb-4 text-primary" />
            <h3 className="font-display text-2xl mb-2">{s.title}</h3>
            <p className="text-muted-foreground mb-4">{s.desc}</p>
            <div className="border-t-2 border-foreground pt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">From</div>
              <VatExPrice amount={s.price} unit={s.unit ?? "/mo"} size="md" />
            </div>
            <div className="mt-4 font-display flex items-center gap-2 group-hover:gap-3 transition-all">See options <ArrowRight className="w-4 h-4" /></div>
          </Link>
        ))}
      </div>
    </section>

    <section className="border-y-4 border-foreground bg-secondary">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-4xl">Bundle the services. Quote the reality.</h2>
            <p className="text-muted-foreground mt-2">We design the bundle first, then price the exact broadband route, seats, SIMs and optional resilience instead of hiding a loss-leading placeholder.</p>
          </div>
          <Link to="/business/bundles"><Button variant="outline">Compare bundle designs <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {businessBundles.map((b) => (
            <div key={b.id} className="border-4 border-foreground bg-background p-6 shadow-brutal flex flex-col">
              <h3 className="font-display text-2xl mb-1">{b.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{b.tagline}</p>
              {b.priceExVat != null ? <VatExPrice amount={b.priceExVat} size="lg" /> : (
                <div className="border-2 border-foreground bg-secondary px-4 py-3">
                  <div className="font-display text-2xl">Tailored price</div>
                  <div className="text-xs text-muted-foreground">Built from the services actually selected for your sites.</div>
                </div>
              )}
              <ul className="mt-4 space-y-2 text-sm flex-1">
                {b.includes.slice(0, 4).map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {i}</li>
                ))}
              </ul>
              <Link to={`/business/quote?service=bundle&bundle=${encodeURIComponent(b.id)}`} className="mt-6"><Button variant="hero" className="w-full">{b.cta ?? "Build bundle quote"}</Button></Link>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="container mx-auto px-4 py-16">
      <h2 className="font-display text-4xl mb-10 text-center">Built around how your site operates.</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.values(businessIndustries).map((ind) => (
          <Link key={ind.slug} to={`/business/industries/${ind.slug}`} className="border-4 border-foreground bg-background p-5 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all">
            <Building2 className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-display text-lg">{ind.name}</h3>
          </Link>
        ))}
      </div>
    </section>

    <section className="border-t-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h2 className="font-display text-4xl mb-8">Business FAQs</h2>
        <div className="space-y-4">
          {businessFAQs.map((f) => (
            <details key={f.q} className="border-4 border-foreground bg-secondary p-5 shadow-brutal group">
              <summary className="font-display text-lg cursor-pointer">{f.q}</summary>
              <p className="mt-3 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    <section className="border-t-4 border-foreground bg-foreground text-background">
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-4xl lg:text-5xl mb-4">Ready to price the real requirement?</h2>
        <p className="text-lg opacity-80 mb-8">Start with the address and services. OCCTA confirms the commercial and provisioning route before contract acceptance.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/business/quote"><Button variant="hero" size="lg">Build a quote</Button></Link>
          <Link to="/business/contact-sales"><Button variant="outline" size="lg" className="bg-background text-foreground">Complex requirements</Button></Link>
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessHub;