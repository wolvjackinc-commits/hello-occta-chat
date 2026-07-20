import { Link, useParams, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessIndustries, businessBundles, type BusinessIndustrySlug } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { CheckCircle2, AlertCircle } from "lucide-react";

const BusinessIndustryPage = () => {
  const { slug } = useParams<{ slug: BusinessIndustrySlug }>();
  const industry = slug ? businessIndustries[slug as BusinessIndustrySlug] : undefined;
  if (!industry) return <Navigate to="/business" replace />;
  const bundle = businessBundles.find((b) => b.id === industry.bundle);

  return (
    <Layout>
      <SEO
        title={`Business Broadband & Phones for ${industry.name} — UK`}
        description={`${industry.hero} OCCTA business broadband, VoIP and SIMs for ${industry.name.toLowerCase()}. Ex-VAT pricing, UK support, 4-hour fix target.`}
        canonical={`/business/industries/${industry.slug}`}
        keywords={`business broadband for ${industry.name.toLowerCase()}, ${industry.name.toLowerCase()} phone system, business wifi ${industry.name.toLowerCase()}`}
      />
      <section className="border-b-4 border-foreground bg-background">
        <div className="container mx-auto px-4 py-14">
          <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">For {industry.name}</div>
          <h1 className="font-display text-5xl lg:text-6xl mb-4">{industry.hero}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">Made for {industry.name.toLowerCase()} teams that can't afford downtime.</p>
        </div>
      </section>
      <BusinessTrustBar />
      <section className="container mx-auto px-4 py-14 grid lg:grid-cols-2 gap-8">
        <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <h2 className="font-display text-2xl mb-2">Sound familiar?</h2>
          <p>{industry.pain}</p>
        </div>
        <div className="border-4 border-foreground bg-background p-6 shadow-brutal">
          <h2 className="font-display text-2xl mb-4">What we recommend</h2>
          <ul className="space-y-2">
            {industry.solution.map((s) => (
              <li key={s} className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /> {s}</li>
            ))}
          </ul>
        </div>
      </section>
      {bundle && (
        <section className="border-t-4 border-foreground bg-foreground text-background">
          <div className="container mx-auto px-4 py-14 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-sm uppercase tracking-wider opacity-80 mb-2">Recommended bundle</div>
              <h2 className="font-display text-4xl mb-3">{bundle.name}</h2>
              <p className="opacity-80 mb-4">{bundle.tagline}</p>
              <VatExPrice amount={bundle.priceExVat} size="xl" className="[&_span]:text-background" />
            </div>
            <div className="border-4 border-background bg-background text-foreground p-6">
              <ul className="space-y-2">
                {bundle.includes.map((f) => (
                  <li key={f} className="flex gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
              <Link to="/business/contact-sales" className="mt-6 block"><Button variant="hero" className="w-full">Get a quote</Button></Link>
            </div>
          </div>
        </section>
      )}
      <section className="container mx-auto px-4 py-14 max-w-2xl">
        <div className="border-4 border-foreground bg-background p-6 shadow-brutal">
          <LeadForm source={`industry_${industry.slug}`} heading={`Talk to a ${industry.name} specialist`} />
        </div>
      </section>
    </Layout>
  );
};

export default BusinessIndustryPage;