import { Link } from "react-router-dom";
import CategoryLinks from "@/components/seo/CategoryLinks";
import PageExplainer from "@/components/seo/PageExplainer";
import { MotionConfig } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessVoice } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessLeadBand, BusinessProductCard, LeadForm } from "@/components/business/BusinessKit";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { VoiceArt } from "@/components/brand/illustrations";

const BusinessVoicePage = () => (
  <Layout>
    <SEO
      title="Hosted VoIP & SIP Trunks for Business — UK"
      description="Hosted VoIP from £6.95/seat + VAT. SIP trunks from £5.95 + VAT. UK numbers, call queues, softphones, TLS, and free number porting."
      canonical="/business/voice"
      keywords="hosted VoIP UK, business phone system, SIP trunks UK, cloud PBX, number porting"
    />
    <MotionConfig reducedMotion="user">
      <PosterStage ghost="VOIP">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Hosted VoIP & SIP" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-20">
          <div>
            <HeroKicker>Hosted VoIP &amp; SIP</HeroKicker>
            <HeroTitle size="md">
              Business VoIP phone system.
              {" "}<span className="block text-primary">Zero on-prem headache.</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">Softphones, desk phones, auto attendants, call queues, recording. Port your existing numbers with no downtime.</p>
            <Link to="/business/contact-sales" className="mt-8 inline-block">
              <Button variant="hero" size="lg">Get a quote <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
          <TicketSlab className="mr-3 mb-3">
            <div className="border-[3px] border-white bg-primary p-8">
              <VoiceArt className="mx-auto h-auto w-full max-w-[300px]" />
            </div>
          </TicketSlab>
        </div>
      </PosterStage>
      <BusinessTrustBar />
      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Plans" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Pick your phone system</h2>
        </Reveal>
        <Reveal stagger className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
          {businessVoice.map((p, i) => (
            <BusinessProductCard
              key={p.id}
              name={p.name}
              summary={p.summary}
              price={<VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />}
              features={p.features}
              ctaTo="/business/contact-sales"
              ctaLabel="Get a quote"
              featured={i === 0}
            />
          ))}
        </Reveal>
      </BrandSection>
      <BusinessLeadBand index="02" title="Need help sizing seats?">
        <LeadForm interest="voice" source="business_voice" heading="Need help sizing seats?" />
      </BusinessLeadBand>
      <PageExplainer
        title="Hosted VoIP and SIP trunks, explained"
        paragraphs={[
          "Hosted VoIP is a cloud phone system. Instead of a phone system box in a cupboard, your extensions, call routing, auto attendant, queues and voicemail run in the cloud, and staff take calls on desk phones, a computer or a mobile app. You pay per user (seat) each month.",
          "SIP trunks are the alternative when you already own a phone system (PBX) you want to keep. They connect that PBX to the phone network over your internet connection, replacing ISDN and analogue lines, which are being retired as part of the UK's move off the old copper telephone network.",
          "Both need a reliable business internet connection. OCCTA business broadband and leased lines are designed for voice, and we can quote the connection and phone system together.",
        ]}
        faqs={[
          { question: "What is hosted VoIP?", answer: "A business phone system that runs in the cloud. Calls go over the internet to desk phones, softphone apps or mobiles, with features like auto attendants, call queues, hunt groups and call recording." },
          { question: "How much does OCCTA hosted VoIP cost?", answer: `From £${businessVoice.find((p) => p.id === "biz-voip-seat")?.priceExVat?.toFixed(2)} per seat per month excluding VAT. SIP trunks start from £${businessVoice.find((p) => p.id === "biz-sip-trunk")?.priceExVat?.toFixed(2)} per trunk per month excluding VAT.` },
          { question: "Can I keep my business phone numbers?", answer: "Yes. Existing geographic and non-geographic numbers can usually be ported to OCCTA." },
          { question: "Do I need new phones?", answer: "Not necessarily. Softphone apps work on computers and mobiles, and many existing SIP desk phones can be reused. We'll check during the quote." },
          { question: "Hosted VoIP or SIP trunks?", answer: "Choose hosted VoIP to move the whole phone system to the cloud. Choose SIP trunks to keep a PBX you already own. See our SIP trunks page for more detail." },
        ]}
        schema={[
          {
            "@type": "Service",
            name: "OCCTA hosted VoIP and SIP trunks",
            serviceType: "Business VoIP",
            url: "https://www.occta.co.uk/business/voice",
            provider: { "@id": "https://www.occta.co.uk/#organization" },
            areaServed: { "@type": "Country", name: "United Kingdom" },
            offers: businessVoice.filter((p) => p.priceExVat != null).map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: p.priceExVat!.toFixed(2),
              priceCurrency: "GBP",
              priceSpecification: { "@type": "UnitPriceSpecification", price: p.priceExVat!.toFixed(2), priceCurrency: "GBP", valueAddedTaxIncluded: false },
            })),
          },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.occta.co.uk/" },
            { "@type": "ListItem", position: 2, name: "Business", item: "https://www.occta.co.uk/business" },
            { "@type": "ListItem", position: 3, name: "Hosted VoIP & SIP", item: "https://www.occta.co.uk/business/voice" },
          ] },
        ]}
      />
      <CategoryLinks family="business" exclude="/business/voice" />
    </MotionConfig>
  </Layout>
);

export default BusinessVoicePage;
