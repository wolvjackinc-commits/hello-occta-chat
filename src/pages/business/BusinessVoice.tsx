import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessVoice } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { CheckCircle2 } from "lucide-react";

const BusinessVoicePage = () => (
  <Layout>
    <SEO
      title="Hosted VoIP & SIP Trunks for Business — UK"
      description="Hosted VoIP from £6.95/seat + VAT. SIP trunks from £5.95 + VAT. UK numbers, call queues, softphones, TLS, and free number porting."
      canonical="/business/voice"
      keywords="hosted VoIP UK, business phone system, SIP trunks UK, cloud PBX, number porting"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">Cloud phone system. Zero on-prem headache.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">Softphones, desk phones, auto attendants, call queues, recording. Port your existing numbers with no downtime.</p>
      </div>
    </section>
    <BusinessTrustBar />
    <section className="container mx-auto px-4 py-14">
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {businessVoice.map((p) => (
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
          <LeadForm interest="voice" source="business_voice" heading="Need help sizing seats?" />
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessVoicePage;