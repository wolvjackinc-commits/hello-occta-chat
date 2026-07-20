import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBroadband } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { CheckCircle2 } from "lucide-react";

const BusinessBroadbandPage = () => (
  <Layout>
    <SEO
      title="Business Broadband UK — SoGEA, Full Fibre & Leased Line"
      description="Business broadband from £22.50/mo + VAT. SoGEA 80, full fibre up to 900 Mbps, leased lines with 99.9% SLA. Static IPs, 4G failover, UK support."
      canonical="/business/broadband"
      keywords="business broadband UK, business fibre broadband, sogea business, leased line UK, static IP broadband"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">Business broadband, sized to your team.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">SoGEA, full fibre and leased lines. Static IPs, priority support and 4G failover as standard on our top tiers.</p>
      </div>
    </section>
    <BusinessTrustBar />
    <section className="container mx-auto px-4 py-14">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businessBroadband.map((p) => (
          <div key={p.id} className="border-4 border-foreground bg-background p-6 shadow-brutal flex flex-col">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">{p.speed}</div>
            <h3 className="font-display text-2xl mb-1">{p.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{p.summary}</p>
            <VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />
            <ul className="mt-5 space-y-2 text-sm flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}</li>
              ))}
            </ul>
            <Link to="/business/contact-sales" className="mt-6"><Button variant="hero" className="w-full">Get a quote</Button></Link>
          </div>
        ))}
      </div>
    </section>
    <section className="border-t-4 border-foreground bg-secondary">
      <div className="container mx-auto px-4 py-14 max-w-2xl">
        <div className="border-4 border-foreground bg-background p-6 shadow-brutal">
          <LeadForm interest="broadband" source="business_broadband" heading="Not sure which tier?" />
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessBroadbandPage;