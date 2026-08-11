import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function BroadbandPlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="UK broadband plans — full fibre from £34.99/mo | OCCTA"
        metaDescription="Compare OCCTA broadband plans: Essential, Superfast and Ultrafast full fibre on Flex 30 or Price Lock 24, with UK-based support. Check availability by postcode."
        canonical="/broadband-plans"
        h1="Broadband plans built for UK homes"
        shortAnswer="OCCTA broadband starts at £34.99/mo across three bands — Essential up to 80Mbps, Superfast up to 330Mbps and Ultrafast up to 1000Mbps. No plan includes a router — buy one from us one-off or monthly, or bring your own. No mid-contract price rises, and a choice of Flex 30 or Price Lock 24 terms where eligible."
        intro="One honest tariff sheet. No surprise renewals, no CPI+ hikes, no 'up to' asterisks that mean 40% of what you were promised."
        sections={[
          { heading: "The plans", body: "Three bands, all inc. VAT on Price Lock 24: Essential up to 80/20Mbps £34.99, Superfast up to 330/50Mbps £39.99, Ultrafast up to 1000/115Mbps £49.99. On Flex 30 rolling: £37.99, £44.99 and £52.99. Routers and setup are priced separately and confirmed before you order." },
          { heading: "Flex 30 vs Price Lock 24", body: "Flex 30 is rolling monthly — cancel with 30 days' notice. Price Lock 24 gives you a fixed monthly price for 24 months with no CPI rises. Both are available at most addresses." },
          { heading: "What's included, always", body: "UK-based support, static IP available for £5/mo, and One Touch Switch onboarding from your old provider. Routers are never bundled — bring your own for £0 or buy ours. Any setup or activation charge is shown before you order." },
          { heading: "Add SIM and Digital Voice", body: "Bundle a 5G SIM from £6/mo or keep your landline number with Digital Home Phone for £5/mo. One bill, one Direct Debit." },
        ]}
        faqs={[
          { question: "How fast will my broadband actually be?", answer: "Your maximum speed depends on the line technology at your address. Full fibre (FTTP) hits the headline speed reliably; SOGEA part-fibre delivers 30–70Mbps in real life. We show estimated download and upload speeds on your quote." },
          { question: "Do I get a router with my plan?", answer: "No. Routers are never included. You can buy a Wi-Fi 6 router from us as a one-off purchase or on a monthly charge, or bring your own compatible router." },
          { question: "Are there setup fees?", answer: "Setup depends on the work your line needs. Remote activation can be £0, standard setup is £49.99 and an engineer install is £134.99. Whatever applies is shown up front before you commit." },
          { question: "Can I keep my landline number?", answer: "Yes — add Digital Home Phone for £5/mo and we'll port your number during switchover." },
          { question: "Do you increase prices mid-contract?", answer: "No. Flex 30 stays the price you signed at; Price Lock 24 is fixed for 24 months. Any change requires 30 days' notice and a free right to leave." },
          { question: "How long does installation take?", answer: "Most switches complete in 10–14 days with no engineer visit needed. New FTTP installs take 2–4 weeks and include an engineer." },
        ]}
        relatedLinks={[
          { label: "Flex 30 broadband", to: "/broadband/flex", description: "Rolling monthly, cancel anytime." },
          { label: "Price Lock 24", to: "/broadband/contract-saver", description: "Fixed price for 24 months." },
          { label: "Coverage check", to: "/coverage-areas", description: "See what's live in your area." },
          { label: "Router options", to: "/routers", description: "Buy ours one-off or monthly, or bring your own." },
          { label: "How to switch", to: "/learn/how-to-switch-broadband", description: "One Touch Switch explained." },
          { label: "Broadband speed guide", to: "/learn/broadband-speed-guide", description: "Pick the right speed." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="broadband-plans-seo"
          title="Not sure which plan fits?"
          description="Tell us your postcode and household size — we'll recommend the right speed and term at your address."
          defaultInterest="broadband"
          compact
        />
      </section>
    </>
  );
}