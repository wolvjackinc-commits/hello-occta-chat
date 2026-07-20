import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessSim } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { CheckCircle2 } from "lucide-react";

const BusinessSimPage = () => (
  <Layout>
    <SEO
      title="Business SIMs — Pooled Data, 5G, EU Roaming"
      description="Business SIMs from £7.50/line + VAT. Pooled data, 5G where available, EU roaming, unlimited UK minutes and one consolidated invoice."
      canonical="/business/sim"
      keywords="business SIM UK, pooled data SIM, 5G business SIM, multi-line SIM UK"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">One SIM plan. Whole team. One bill.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">Pooled data means big users share with light users. Add and remove lines any month, no renegotiation.</p>
      </div>
    </section>
    <BusinessTrustBar />
    <section className="container mx-auto px-4 py-14">
      <div className="grid md:grid-cols-3 gap-6">
        {businessSim.map((p) => (
          <div key={p.id} className="border-4 border-foreground bg-background p-6 shadow-brutal flex flex-col">
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
          <LeadForm interest="sim" source="business_sim" heading="Rolling out 5+ SIMs?" />
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessSimPage;