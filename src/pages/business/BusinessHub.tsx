import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBundles, businessBroadband, businessIndustries, businessFAQs } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { ArrowRight, Wifi, PhoneCall, Smartphone, Building2, CheckCircle2 } from "lucide-react";

const BusinessHub = () => (
  <Layout>
    <SEO
      title="Business Broadband, VoIP & SIM — UK"
      description="Business broadband from £22.50+VAT, hosted VoIP from £6.95/seat+VAT, pooled business SIMs. Ex-VAT pricing, UK support, 4-hour fix target."
      canonical="/business"
      keywords="business broadband UK, hosted VoIP UK, business SIM, SIP trunks UK, small business telecom, leased line UK"
    />

    {/* Hero */}
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-3">
          <span className="inline-block px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase tracking-wider text-sm mb-6">
            For business
          </span>
          <h1 className="font-display text-5xl lg:text-7xl leading-[0.95] mb-6">
            Telecom that <span className="underline decoration-primary decoration-8">actually works</span> for your business.
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Broadband, hosted VoIP and pooled SIMs on one bill. Ex-VAT pricing, no hidden fees, UK support, 4-hour fix targets.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/business/bundles"><Button variant="hero" size="lg">See bundles <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            <Link to="/business/contact-sales"><Button variant="outline" size="lg">Talk to sales</Button></Link>
          </div>
          <div className="mt-6 text-sm text-muted-foreground">Prices from £22.50/mo <strong>+ VAT</strong>. No mid-contract price hikes.</div>
        </div>
        <div className="lg:col-span-2 border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <LeadForm compact heading="Get a quote in 1 working day" source="business_hub_hero" />
        </div>
      </div>
    </section>

    <BusinessTrustBar />

    {/* Services triple */}
    <section className="container mx-auto px-4 py-16">
      <h2 className="font-display text-4xl mb-10 text-center">One provider. Every service.</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: Wifi, title: "Business Broadband", desc: "SoGEA, full fibre and leased lines with static IPs and failover.", to: "/business/broadband", price: 22.5 },
          { icon: PhoneCall, title: "Hosted VoIP & SIP", desc: "UK numbers, softphones, call queues. Port your existing numbers.", to: "/business/voice", price: 6.95, unit: "/seat/mo" },
          { icon: Smartphone, title: "Business SIMs", desc: "Pooled data, 5G, EU roaming. One bill for the whole team.", to: "/business/sim", price: 7.5, unit: "/line/mo" },
        ].map((s) => (
          <Link key={s.title} to={s.to} className="group border-4 border-foreground bg-background p-6 shadow-brutal hover:-translate-y-1 hover:-translate-x-1 hover:shadow-brutal-lg transition-all">
            <s.icon className="w-10 h-10 mb-4 text-primary" />
            <h3 className="font-display text-2xl mb-2">{s.title}</h3>
            <p className="text-muted-foreground mb-4">{s.desc}</p>
            <div className="border-t-2 border-foreground pt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">From</div>
              <VatExPrice amount={s.price} unit={s.unit ?? "/mo"} size="md" showIncVat={false} />
            </div>
            <div className="mt-4 font-display flex items-center gap-2 group-hover:gap-3 transition-all">See plans <ArrowRight className="w-4 h-4" /></div>
          </Link>
        ))}
      </div>
    </section>

    {/* Bundles preview */}
    <section className="border-y-4 border-foreground bg-secondary">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-4xl">Bundle it, save more.</h2>
            <p className="text-muted-foreground mt-2">Broadband + voice + SIMs, one price, one bill.</p>
          </div>
          <Link to="/business/bundles"><Button variant="outline">Compare all bundles <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {businessBundles.map((b) => (
            <div key={b.id} className="border-4 border-foreground bg-background p-6 shadow-brutal">
              <h3 className="font-display text-2xl mb-1">{b.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{b.tagline}</p>
              <VatExPrice amount={b.priceExVat} size="lg" />
              <ul className="mt-4 space-y-2 text-sm">
                {b.includes.slice(0, 4).map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {i}</li>
                ))}
              </ul>
              <Link to="/business/bundles" className="mt-6 inline-block"><Button variant="hero" className="w-full">{b.cta ?? "Choose bundle"}</Button></Link>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Industries */}
    <section className="container mx-auto px-4 py-16">
      <h2 className="font-display text-4xl mb-10 text-center">Built for your industry.</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.values(businessIndustries).map((ind) => (
          <Link key={ind.slug} to={`/business/industries/${ind.slug}`} className="border-4 border-foreground bg-background p-5 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all">
            <Building2 className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-display text-lg">{ind.name}</h3>
          </Link>
        ))}
      </div>
    </section>

    {/* FAQs */}
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

    {/* Final CTA */}
    <section className="border-t-4 border-foreground bg-foreground text-background">
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-4xl lg:text-5xl mb-4">Ready to switch?</h2>
        <p className="text-lg opacity-80 mb-8">Quote in 1 working day. Install in as little as 5.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/business/contact-sales"><Button variant="hero" size="lg">Talk to sales</Button></Link>
          <Link to="/business/bundles"><Button variant="outline" size="lg" className="bg-background text-foreground">See bundles</Button></Link>
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessHub;