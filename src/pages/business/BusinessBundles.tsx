import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBundles } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { CheckCircle2 } from "lucide-react";

const BusinessBundlesPage = () => (
  <Layout>
    <SEO
      title="Business Bundles — Broadband + VoIP + SIM"
      description="Bundled business broadband, hosted VoIP and pooled SIMs from £39/mo + VAT. Startup, Growth and Scale plans built for UK SMEs."
      canonical="/business/bundles"
      keywords="business broadband bundle, business phone and internet bundle, small business telecom package UK"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14 text-center">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">Everything you need, one price.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Broadband, phones and SIMs bundled to save you setup time — and money.</p>
      </div>
    </section>
    <BusinessTrustBar />
    <section className="container mx-auto px-4 py-14">
      <div className="grid md:grid-cols-3 gap-6">
        {businessBundles.map((b, i) => (
          <div key={b.id} className={`border-4 border-foreground bg-background p-8 shadow-brutal flex flex-col ${i === 1 ? "lg:-translate-y-4 border-primary" : ""}`}>
            {i === 1 && <span className="inline-block self-start mb-3 px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase text-xs tracking-wider">Most popular</span>}
            <h3 className="font-display text-3xl mb-1">{b.name}</h3>
            <p className="text-sm text-muted-foreground mb-1">{b.tagline}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">{b.bestFor}</p>
            <VatExPrice amount={b.priceExVat} size="xl" />
            <ul className="mt-6 space-y-2.5 flex-1">
              {b.includes.map((f) => (
                <li key={f} className="flex gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}</li>
              ))}
            </ul>
            <Link to="/business/contact-sales" state={{ bundle: b.id }} className="mt-6">
              <Button variant={i === 1 ? "hero" : "outline"} className="w-full" size="lg">{b.cta ?? `Choose ${b.name}`}</Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  </Layout>
);

export default BusinessBundlesPage;