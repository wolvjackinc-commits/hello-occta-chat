import SeoContentLayout from "@/components/seo/SeoContentLayout";

// SWITCH50 was switched off on 31 October 2026 (offer_campaigns.active=false).
// The page stays at the same URL so old links and search results land on a
// clear "this offer has ended" notice, with the original terms kept for
// customers who ordered while it ran.
const SWITCH50_TERMS =
  "SWITCH50 terms (switch50-2026-09-06-v1): New residential customers only. Applies only to an eligible Essential Fibre Price Lock 24 order placed by 31 October 2026. The £50 reward is separate from the broadband price and does not reduce the £34.99 monthly price. Availability, estimated speed, setup requirements, router/equipment choices, one-off charges and the final price are confirmed for the customer address before order. One SWITCH50 reward per eligible service address. The service must activate, remain live and not be in arrears or cancellation/cease status when eligibility is checked. The first broadband invoice must have been paid. The reward becomes eligible 30 days after service activation once all eligibility conditions are met. OCCTA may withhold or reverse a reward for duplicate, fraudulent, cancelled, ceased, unpaid or otherwise ineligible orders. Reward payment is recorded against the order and customer account. Statutory rights are unaffected.";

export default function Switch50OfferSeo() {
  return (
    <SeoContentLayout
      title="SWITCH50 £50 cashback offer has ended | OCCTA"
      metaDescription="The OCCTA SWITCH50 £50 switching cashback offer ended on 31 October 2026 and is no longer available for new orders. See our current broadband plans."
      canonical="/broadband-cashback-offer"
      h1="The SWITCH50 offer has ended"
      shortAnswer="SWITCH50, our £50 switching cashback offer, ended on 31 October 2026. It's no longer available for new orders. Essential Fibre on Price Lock 24 and our other broadband plans are still available."
      intro="Thank you to everyone who joined OCCTA during SWITCH50. New orders placed from now on don't include the £50 cashback reward. If you placed an order while the offer was running, the original terms below still apply to that order."
      sections={[
        {
          heading: "Ordering now",
          body: "You can still switch to OCCTA. Our current plans, prices and any setup charges are shown for your exact address before you order, and switching is handled for you through One Touch Switch.",
        },
        {
          heading: "If you ordered during SWITCH50",
          body: "Orders placed while SWITCH50 was running are assessed under the original terms shown at the bottom of this page. You can see the status of a reward in your OCCTA account. If you have a question about your reward, contact us on 0800 260 6626 or hello@occta.co.uk.",
        },
      ]}
      faqs={[
        { question: "Can I still get the £50 cashback?", answer: "Not on new orders. SWITCH50 ended on 31 October 2026." },
        { question: "I ordered before the offer ended. What happens to my reward?", answer: "Your order is assessed under the original SWITCH50 terms below. Contact us if you have any questions about it." },
        { question: "Are your broadband prices still the same?", answer: "Current prices are shown on our pricing page and confirmed for your address before you order." },
      ]}
      relatedLinks={[
        { label: "Broadband plans", to: "/broadband-plans", description: "See Essential Fibre and the other tiers." },
        { label: "Switch broadband provider", to: "/switch-broadband-provider", description: "How One Touch Switch works." },
        { label: "Pricing", to: "/pricing", description: "All prices, setup charges and add-ons." },
      ]}
      primaryCta={{ label: "See current plans", to: "/broadband-plans" }}
      compliance={`This offer has ended. For reference only — ${SWITCH50_TERMS}`}
    />
  );
}
