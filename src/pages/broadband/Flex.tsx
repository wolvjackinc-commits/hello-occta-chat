import { SEO } from "@/components/seo";
import { RollingDialArt } from "@/components/brand/illustrations";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";
import TermPlanLayout from "./TermPlanLayout";

const points = [
  "30-day rolling contract with no minimum term.",
  "No remaining-month early termination charge — give 30 days' notice and go.",
  "No CPI, RPI or percentage-based annual price rises built into the contract.",
  "Bring your own router for £0, or add one at checkout.",
  "Price, speed range, notice period and every one-off charge shown in your Contract Summary before you order.",
  "Switch to Price Lock 24 later if you want a lower fixed price.",
];

const faqs = [
  { q: "How do I cancel Flex 30?", a: "Give 30 days' notice through your account, by email or by post. If you're switching to another provider, just sign up with them — under One Touch Switch they coordinate with us and we don't charge beyond the switch date." },
  { q: "Is there really no exit fee?", a: "There's no remaining-month early termination charge on Flex 30. Amounts already due up to the end date remain payable, and a network cease charge applies only where lawful and actually incurred." },
  { q: "Why is Flex 30 more than Price Lock 24?", a: "You're paying for the freedom to leave on 30 days' notice. The difference is shown for every speed band in the table above." },
  { q: "Can I move from Flex 30 to Price Lock 24?", a: "Yes. Ask us and we'll confirm the Price Lock 24 price for your line. A new minimum term only starts if you expressly agree to it." },
];

export default function FlexBroadband() {
  return (
    <TermPlanLayout
      term="flex30"
      faqs={faqs}
      seo={
        <SEO
          title="Flex 30 Broadband — 30-day rolling, no minimum term"
          description={`OCCTA Flex 30 broadband from £${CHARGED_PRICES.essential.flex30.toFixed(2)} a month incl. VAT. 30-day rolling, no remaining-month exit charge, full Contract Summary before you order.`}
          canonical="/broadband/flex"
        />
      }
      kicker="Flex 30"
      title={
        <>
          Broadband
          {" "}<span className="block text-primary">without the lock-in.</span>
        </>
      }
      intro={
        <>
          Flex 30 is 30-day rolling broadband from £{CHARGED_PRICES.essential.flex30.toFixed(2)} a month including VAT, with no minimum term and no remaining-month exit charge.
          Your exact price, speed range and any one-off charges are confirmed in your Contract Summary before you pay.
        </>
      }
      art={<RollingDialArt className="mx-auto h-auto w-full max-w-[260px]" />}
      points={points}
      notes={[
        "Any setup, installation or equipment charges are shown in your Contract Summary before you order.",
        "Speeds and final price depend on the products available at your confirmed address.",
        "You have 14 days to cancel under the Consumer Contracts Regulations. If you ask us to start sooner, a proportionate charge applies for service supplied.",
        "A separate network cease charge may apply only where lawful and actually incurred — capped at £114 inc VAT in the first 12 months and £60 inc VAT after.",
      ]}
      crossSell={{
        title: "Want a lower monthly price?",
        body: "Price Lock 24 fixes a lower monthly price for 24 months, with no inflation-linked rises.",
        to: "/broadband/contract-saver",
        label: "Price Lock 24",
      }}
    />
  );
}
