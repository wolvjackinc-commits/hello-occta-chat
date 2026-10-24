import SeoContentLayout from "@/components/seo/SeoContentLayout";
import PartnerEnquiryForm from "@/components/partners/PartnerEnquiryForm";

export default function LettingAgentPartners() {
  return (
    <SeoContentLayout
      title="Letting agent broadband partner programme — £25 per tenant | OCCTA"
      metaDescription="Huddersfield broadband provider OCCTA pays letting agents and landlords £25 for each tenant who signs up through their link. Tenants get 30-day rolling broadband where available."
      canonical="/partners/letting-agents"
      h1="Broadband for your tenants. £25 for your agency."
      shortAnswer="Add your OCCTA partner link to your tenant welcome email or move-in pack. Tenants order themselves, and we pay your agency £25 for each one who signs up, once their second Direct Debit has been collected."
      intro="The first thing most tenants chase after moving in is the internet. OCCTA is a broadband provider based in Huddersfield. Our Flex 30 plans roll monthly where available, so tenants are never locked in past their tenancy, and every price is confirmed before they order."
      sections={[
        {
          heading: "How it works",
          body: "We set up a partner code for your agency and send you a short link, a QR code and a printable flyer. You add one line to your welcome email or move-in pack. Tenants who use your link or type your code when ordering are credited to you automatically for 30 days.",
        },
        {
          heading: "What you earn",
          body: "£25 per tenant, paid by bank transfer, with a monthly statement showing who signed up. Commission becomes due once the tenant's second Direct Debit has been collected and the service hasn't been cancelled. It is never charged to the tenant.",
        },
        {
          heading: "No data sharing, no admin",
          body: "You never send us tenant details. Tenants order themselves online, so there is no consent paperwork for your team and nothing to sign with us. You can stop at any time.",
        },
        {
          heading: "Why tenants like it",
          body: "Flex 30: 30-day rolling broadband where available. Price Lock 24 for longer stays, with the monthly price fixed for the term. The monthly price, setup and router cost are shown before ordering, and support is UK-based.",
        },
        {
          heading: "Landlords and HMOs",
          body: "Running HMOs or bills-included student houses? Ask about one line per property held in your name, so there is no gap in service between tenancies and tenants move into a working connection.",
        },
      ]}
      faqs={[
        { question: "Does it cost the agency anything?", answer: "No. There is no fee and nothing to sign. You only add our link or flyer to the information you already give tenants." },
        { question: "Is this allowed under the Tenant Fees Act?", answer: "Yes. The commission is paid by OCCTA, not by the tenant, and tenants are free to choose any provider." },
        { question: "When do you pay?", answer: "Commission becomes due once the referred customer's second Direct Debit has been collected. We pay by bank transfer each month with a statement." },
        { question: "What if a tenant forgets to use the link?", answer: "They can type your partner code in the 'Offer or reference code' box when ordering, and the order is still credited to you." },
        { question: "Which areas do you cover?", answer: "OCCTA broadband is available across the UK. Availability, speed and price depend on the address and are confirmed before the tenant orders." },
      ]}
      relatedLinks={[
        { label: "Moving house broadband", to: "/moving-house-broadband", description: "What tenants see when they move in." },
        { label: "No-contract broadband", to: "/no-contract-broadband-uk", description: "How Flex 30 rolling plans work." },
        { label: "Business broadband", to: "/business", description: "Broadband and phones for your own office." },
      ]}
      primaryCta={{ label: "Become a partner", to: "#partner-enquiry" }}
      secondaryCta={{ label: "See tenant plans", to: "/broadband" }}
      compliance={<p>Commission terms are confirmed in writing when your partner code is set up. OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU. Company No. 13828933.</p>}
      afterContent={<div id="partner-enquiry" className="scroll-mt-24"><PartnerEnquiryForm /></div>}
    />
  );
}
