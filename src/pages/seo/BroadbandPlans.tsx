import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function BroadbandPlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="UK broadband plans — fibre from £34.99/mo | OCCTA"
        metaDescription="Compare OCCTA broadband plans: Essential, Superfast, Ultrafast and Gigabit on Flex 30 or Price Lock 24 where offered. Final service availability is validated for your address."
        canonical="/broadband-plans"
        h1="Broadband plans built for UK homes"
        shortAnswer="OCCTA broadband starts at £34.99/mo across four speed bands — Essential up to 80Mbps, Superfast up to 330Mbps, Ultrafast up to 550Mbps and Gigabit up to 1000Mbps. No plan includes a router — buy one from us one-off or monthly where offered, or bring your own compatible router. Flex 30 and Price Lock 24 options depend on the selected plan and service availability."
        intro="A clear choice of speed bands and terms, with the price and contractual information shown before you accept your order."
        sections={[
          { heading: "The plans", body: "Four OCCTA speed bands are shown in our system: Essential up to 80Mbps, Superfast up to 330Mbps, Ultrafast up to 550Mbps and Gigabit up to 1000Mbps. Headline Price Lock 24 prices are £34.99, £39.99, £49.99 and £49.99 respectively; Flex 30 headline prices are £37.99, £44.99, £52.99 and £52.99 where that term is offered. The order journey calculates the exact price for the selectable combination and shows VAT before acceptance. Routers and setup are priced separately." },
          { heading: "Availability at your address", body: "Plans shown are current OCCTA offers and may not all be available at every address. Final availability, speed and network technology are subject to network and supplier validation for the installation address. If a selected plan cannot be supplied, OCCTA contacts the customer with available options before provisioning and does not substitute a different plan or price without agreement." },
          { heading: "Flex 30 vs Price Lock 24", body: "Flex 30 is a rolling option where offered, with the notice period shown before acceptance. Price Lock 24 gives a fixed monthly broadband price for the agreed 24-month term, subject to the scope and exceptions stated in the Contract Summary and Contract Information." },
          { heading: "What's included", body: "UK-based support, optional add-ons where available, and a clear first-bill view. Routers are not automatically bundled — bring your own compatible router for £0 or select an available router option. Any setup or activation charge is shown before you accept the agreement." },
          { heading: "Add SIM and Digital Voice", body: "SIM and Digital Voice services can be selected separately where available. Digital Voice runs over broadband and has important power-cut and emergency-call information shown before it is added." },
        ]}
        faqs={[
          { question: "How fast will my broadband actually be?", answer: "Available technology and achievable speed depend on the installation address and network. The order journey shows speed information for the selected service, and the Contract Summary and Contract Information set out the service details you review before acceptance." },
          { question: "Do I get a router with my plan?", answer: "A router is not automatically included. You can select an available OCCTA router option or use your own compatible router." },
          { question: "Are there setup fees?", answer: "Setup depends on the selected service and the work required. Any setup or activation charge that applies to the order is shown before you accept the agreement." },
          { question: "Can I keep my landline number?", answer: "Number porting may be available with Digital Voice. The order journey asks what you want to do with your number and OCCTA confirms the porting arrangement." },
          { question: "Do you increase prices mid-contract?", answer: "Price Lock 24 keeps the monthly broadband price fixed for the agreed term within the scope stated in your contract. Flex 30 terms and any applicable price-change rights are shown in your Contract Summary and Contract Information before acceptance." },
          { question: "How long does installation take?", answer: "Activation timing depends on the service and network work required. You can choose a preferred start date, and OCCTA confirms the actual activation date after final service validation." },
        ]}
        relatedLinks={[
          { label: "Flex 30 broadband", to: "/broadband/flex", description: "See the rolling option and its terms." },
          { label: "Price Lock 24", to: "/broadband/contract-saver", description: "Fixed broadband price for the agreed term." },
          { label: "Coverage check", to: "/coverage-areas", description: "Start with your address and see OCCTA plan options." },
          { label: "Router options", to: "/routers", description: "Available router choices and bring-your-own guidance." },
          { label: "How to switch", to: "/learn/how-to-switch-broadband", description: "Switching explained." },
          { label: "Broadband speed guide", to: "/learn/broadband-speed-guide", description: "Understand broadband speed bands." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="broadband-plans-seo"
          title="Not sure which plan fits?"
          description="Tell us your postcode and household size — we'll help narrow the options, with final service availability validated before provisioning."
          defaultInterest="broadband"
          compact
        />
      </section>
    </>
  );
}
