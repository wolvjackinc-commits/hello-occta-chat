import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import LeadForm from "@/components/business/LeadForm";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { Phone, Mail, Clock } from "lucide-react";

const BusinessContactSales = () => (
  <Layout>
    <SEO
      title="Talk to Business Sales — OCCTA"
      description="Get a business quote from a UK-based OCCTA specialist within 1 working day. Broadband, hosted VoIP, business SIMs and bundles."
      canonical="/business/contact-sales"
    />
    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14">
        <h1 className="font-display text-5xl lg:text-6xl mb-4">Talk to business sales.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">Real UK humans. One working day response. No sales-y nonsense.</p>
      </div>
    </section>
    <section className="container mx-auto px-4 py-14 grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 border-4 border-foreground bg-background p-6 shadow-brutal">
        <LeadForm source="business_contact_sales" heading="Tell us about your business" />
      </div>
      <aside className="lg:col-span-2 space-y-4">
        <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <Phone className="w-6 h-6 text-primary mb-2" />
          <div className="font-display text-lg">Call us</div>
          <a href={CONTACT_PHONE_TEL} className="font-display text-2xl hover:text-primary">{CONTACT_PHONE_DISPLAY}</a>
        </div>
        <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <Mail className="w-6 h-6 text-primary mb-2" />
          <div className="font-display text-lg">Email</div>
          <a href="mailto:business@occta.co.uk" className="text-primary underline">business@occta.co.uk</a>
        </div>
        <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <Clock className="w-6 h-6 text-primary mb-2" />
          <div className="font-display text-lg">Hours</div>
          <div className="text-sm text-muted-foreground">Mon–Fri, 9am–6pm UK</div>
        </div>
      </aside>
    </section>
  </Layout>
);

export default BusinessContactSales;