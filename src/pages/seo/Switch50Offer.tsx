import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function Switch50OfferSeo() {
  return (
    <>
      <SeoContentLayout
        title="£50 broadband switch cashback — SWITCH50 offer"
        metaDescription="Switch to OCCTA Essential Fibre on Price Lock 24 by 31 October 2026 and get £50 cashback. £34.99/mo incl. VAT, price fixed for 24 months. Terms apply."
        canonical="/broadband-cashback-offer"
        h1="£50 cashback when you switch to OCCTA broadband"
        shortAnswer="New residential customers who order Essential Fibre on Price Lock 24 by 31 October 2026 get £50 cashback. The reward is paid 30 days after your service activates, once your first broadband invoice is paid. It is separate from your monthly price."
        intro="SWITCH50 is our launch offer for people moving to OCCTA from another provider. You get a fixed £34.99 a month (incl. VAT) for 24 months on Essential Fibre, plus a one-off £50 cashback reward once you're up and running and your first bill is settled. No hidden strings — the full terms are on this page."
        sections={[
          {
            heading: "What you get",
            body: "£50 cashback recorded against your order and account, on top of Essential Fibre Price Lock 24 at £34.99 per month including VAT. Price Lock means the monthly price is fixed for the 24-month term — no mid-contract inflation rises. The £50 is a separate reward; it does not reduce or discount the monthly price.",
          },
          {
            heading: "Who can claim it",
            body: "New residential OCCTA customers, ordering an eligible Essential Fibre Price Lock 24 broadband service, placed by 31 October 2026. One reward per service address. It does not apply to Flex 30 monthly plans, Superfast or Ultrafast tiers, or business orders.",
          },
          {
            heading: "How the £50 is paid",
            body: "Your service must activate and stay live, your account must not be in arrears, cancellation or cease status, and your first broadband invoice must be paid. Thirty days after activation we check eligibility and the reward becomes payable. You can follow its status in your OCCTA account under Rewards — queued, eligible, then paid.",
          },
          {
            heading: "Switching is handled for you",
            body: "OCCTA is a One Touch Switch participant, so we contact your current provider — you should not cancel with them yourself. Most switches complete in 10–14 days. Availability, estimated speeds, setup requirements, equipment choices and any one-off charges are confirmed for your exact address before you order.",
          },
          {
            heading: "How to claim",
            body: "Enter your postcode, choose Essential Fibre on Price Lock 24, and complete the order. The offer is applied automatically to eligible orders during checkout and shown in your contract documents — there is no code to type in and nothing to claim afterwards.",
          },
        ]}
        faqs={[
          { question: "Is the £50 a discount off my bill?", answer: "No. It is a separate cashback reward recorded against your order and account. Your Essential Fibre Price Lock 24 price stays £34.99 a month including VAT." },
          { question: "When exactly do I get the £50?", answer: "Eligibility is checked 30 days after your service activates. Your first broadband invoice must be paid and the service must still be live and not in arrears or cancellation." },
          { question: "Does the offer work on the Flex 30 monthly plan?", answer: "No. SWITCH50 applies only to an eligible Essential Fibre order on the Price Lock 24 term. Flexible monthly options are still available, just without this reward." },
          { question: "Can two people at the same address both claim?", answer: "No. One SWITCH50 reward per eligible service address." },
          { question: "What is the deadline?", answer: "The order must be placed by 31 October 2026." },
          { question: "What if I cancel during the switch?", answer: "OCCTA may withhold or reverse the reward for duplicate, fraudulent, cancelled, ceased, unpaid or otherwise ineligible orders. Your statutory rights are unaffected." },
        ]}
        relatedLinks={[
          { label: "Broadband plans", to: "/broadband-plans", description: "See Essential Fibre and the other tiers." },
          { label: "Switch broadband provider", to: "/switch-broadband-provider", description: "How One Touch Switch works." },
          { label: "Coverage check", to: "/coverage-areas", description: "Confirm your address is served." },
          { label: "Pricing", to: "/pricing", description: "All prices, setup charges and add-ons." },
        ]}
        primaryCta={{ label: "Check availability", to: "/broadband?offer=SWITCH50&utm_source=occta&utm_medium=onsite&utm_campaign=SWITCH50&utm_content=seo_offer_page" }}
        compliance="SWITCH50 terms (switch50-2026-09-06-v1): New residential customers only. Applies only to an eligible Essential Fibre Price Lock 24 order placed by 31 October 2026. The £50 reward is separate from the broadband price and does not reduce the £34.99 monthly price. Availability, estimated speed, setup requirements, router/equipment choices, one-off charges and the final price are confirmed for the customer address before order. One SWITCH50 reward per eligible service address. The service must activate, remain live and not be in arrears or cancellation/cease status when eligibility is checked. The first broadband invoice must have been paid. The reward becomes eligible 30 days after service activation once all eligibility conditions are met. OCCTA may withhold or reverse a reward for duplicate, fraudulent, cancelled, ceased, unpaid or otherwise ineligible orders. Reward payment is recorded against the order and customer account. Statutory rights are unaffected."
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="switch50-offer-seo"
          title="Want us to check your address first?"
          description="Postcode and your current provider — we'll confirm availability, likely speed and whether the £50 offer applies before you commit."
          defaultInterest="broadband"
          compact
        />
      </section>
    </>
  );
}
