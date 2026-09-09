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
      description="Build a business telecom bundle around your real sites, users and resilience needs. Broadband, VoIP and SIM pricing is checked against the selected service route before contract."
      canonical="/business/bundles"
      keywords="business broadband bundle, business phone and internet bundle, small business telecom package UK"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14 text-center">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">One bundle. Priced from the real requirement.</h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">Choose a bundle design, then OCCTA prices the exact broadband route, voice seats, SIMs, equipment and care options. That keeps the quote commercially sustainable and avoids hidden substitutions later.</p>
      </div>
    </section>
    <BusinessTrustBar />
    <section className="container mx-auto px-4 py-14">
      <div className="grid md:grid-cols-3 gap-6">
        {businessBundles.map((b, i) => (
          <div key={b.id} className={`border-4 border-foreground bg-background p-8 shadow-brutal flex flex-col ${i === 1 ? "lg:-translate-y-4 border-primary" : ""}`}>
            {i === 1 && <span className="inline-block self-start mb-3 px-3 py-1 border-4 border-foreground bg-primary text-primary-foreground font-display uppercase text-xs tracking-wider">Popular design</span>}
            <h3 className="font-display text-3xl mb-1">{b.name}</h3>
            <p className="text-sm text-muted-foreground mb-1">{b.tagline}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">{b.bestFor}</p>
            {b.priceExVat != null ? (
              <VatExPrice amount={b.priceExVat} size="xl" />
            ) : (
              <div className="border-2 border-foreground bg-secondary px-4 py-3">
                <div className="font-display text-3xl">Tailored quote</div>
                <div className="text-xs text-muted-foreground mt-1">No loss-leading bundle price: each underlying service is costed first.</div>
              </div>
            )}
            <ul className="mt-6 space-y-2.5 flex-1">
              {b.includes.map((f) => (
                <li key={f} className="flex gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}</li>
              ))}
            </ul>
            <Link to={`/business/quote?service=bundle&bundle=${encodeURIComponent(b.id)}`} className="mt-6">
              <Button variant={i === 1 ? "hero" : "outline"} className="w-full" size="lg">{b.cta ?? `Build ${b.name} quote`}</Button>
            </Link>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-8 max-w-4xl mx-auto text-center">Any broadband installation, router, static IP, enhanced care, mobile roaming or number-porting charges are shown separately where applicable. The final contractual price and minimum term are confirmed before acceptance.</p>
    </section>
  </Layout>
);

export default BusinessBundlesPage;