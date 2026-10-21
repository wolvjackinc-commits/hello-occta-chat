import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import LeadForm from "@/components/business/LeadForm";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { Phone, Mail, Clock } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, TicketSlab } from "@/components/brand/kit";

const BusinessContactSales = () => (
  <Layout>
    <SEO
      title="Talk to Business Sales — OCCTA"
      description="Get a business quote from a UK-based OCCTA specialist within 1 working day. Broadband, hosted VoIP, business SIMs and bundles."
      canonical="/business/contact-sales"
    />
    <PosterStage>
      <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Contact sales" }]} />
      <HeroKicker>Business sales</HeroKicker>
      <HeroTitle size="md">Talk to business sales.</HeroTitle>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">Real UK humans. One working day response. No sales-y nonsense.</p>
    </PosterStage>
    <BrandSection tone="paper">
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-16">
        <TicketSlab className="mr-3 mb-3 lg:col-span-3">
          <div className="border-[3px] border-foreground bg-card p-6 sm:p-8">
            <LeadForm source="business_contact_sales" heading="Tell us about your business" />
          </div>
        </TicketSlab>
        <aside className="lg:col-span-2 lg:sticky lg:top-28 lg:self-start">
          <dl className="border-t-[3px] border-foreground">
            <div className="flex items-start gap-4 border-b-[3px] border-foreground py-6">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center bg-primary text-black"><Phone className="h-5 w-5" /></span>
              <div>
                <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Call us</dt>
                <dd><a href={CONTACT_PHONE_TEL} className="font-display text-3xl leading-none hover:underline">{CONTACT_PHONE_DISPLAY}</a></dd>
              </div>
            </div>
            <div className="flex items-start gap-4 border-b-[3px] border-foreground py-6">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center bg-primary text-black"><Mail className="h-5 w-5" /></span>
              <div>
                <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Email</dt>
                <dd><a href="mailto:business@occta.co.uk" className="text-lg font-semibold underline decoration-primary decoration-2 underline-offset-4">business@occta.co.uk</a></dd>
              </div>
            </div>
            <div className="flex items-start gap-4 border-b-[3px] border-foreground py-6">
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center bg-primary text-black"><Clock className="h-5 w-5" /></span>
              <div>
                <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Hours</dt>
                <dd className="text-lg">Mon–Fri, 8am–6pm UK</dd>
              </div>
            </div>
          </dl>
        </aside>
      </div>
    </BrandSection>
  </Layout>
);

export default BusinessContactSales;
