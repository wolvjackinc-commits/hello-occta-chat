import { useEffect } from "react";
import { SEO } from "@/components/seo";
import { logClientEvent } from "@/lib/activityLog";
import { LockStripArt } from "@/components/brand/illustrations";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";
import TermPlanLayout from "./TermPlanLayout";

// Route kept at /broadband/contract-saver for existing links; the product is
// sold as Price Lock 24.
const points = [
  "Your monthly broadband price is fixed for the full 24-month minimum term.",
  "No CPI, RPI or percentage-based annual price rises built into the contract.",
  "Our lowest monthly price on every speed band.",
  "Bring your own router for £0, or add one at checkout.",
  "Price, speed range, minimum term and every one-off charge shown in your Contract Summary before you order.",
  "After 24 months your service continues on a 30-day rolling basis unless you choose a new term.",
];

const faqs = [
  { q: "Can the price go up during the 24 months?", a: "Your recurring broadband price stays fixed for the minimum term, except where a change is required or permitted by law. Statutory changes such as a VAT rate change are passed through and itemised." },
  { q: "What if I need to leave early?", a: "If you leave during the minimum term and no penalty-free exit applies, an Early Termination Charge may apply. It's based on the recurring charges left, minus VAT no longer due and costs we avoid, and never exceeds the remaining charges. We tell you the exact figure first." },
  { q: "What if I move home?", a: "If your service can move without new network work, there's no home-move fee. If we can't provide an equivalent service at the new address, we review your case fairly and won't apply an unfair penalty just because you moved." },
  { q: "What happens at the end of the term?", a: "Your service continues on a 30-day rolling basis. You can stay, leave with notice, or choose a new term." },
];

export default function ContractSaverBroadband() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Price Lock 24 page", source_module: "marketing" });
  }, []);

  return (
    <TermPlanLayout
      term="lock24"
      faqs={faqs}
      seo={
        <SEO
          title="Price Lock 24 Broadband — fixed price for 24 months"
          description={`OCCTA Price Lock 24 broadband from £${CHARGED_PRICES.essential.lock24.toFixed(2)} a month incl. VAT. Price fixed for 24 months, no CPI or inflation-linked rises, full Contract Summary before you order.`}
          canonical="/broadband/contract-saver"
        />
      }
      kicker="Price Lock 24"
      title={
        <>
          Same price,
          {" "}<span className="block text-primary">every month.</span>
        </>
      }
      intro={
        <>
          Price Lock 24 gives you our lowest monthly price, fixed for 24 months — from £{CHARGED_PRICES.essential.lock24.toFixed(2)} a month including VAT.
          No inflation-linked rises, and your exact price, speed and charges are confirmed in your Contract Summary before you pay.
        </>
      }
      art={<LockStripArt className="mx-auto h-auto w-full max-w-[300px]" />}
      points={points}
      notes={[
        "An Early Termination Charge may apply if you leave during the 24-month minimum term and no penalty-free exit right applies — the exact figure is shown before you confirm.",
        "Any setup, installation or equipment charges are shown in your Contract Summary before you order.",
        "Speeds and final price depend on the products available at your confirmed address.",
        "You have 14 days to cancel under the Consumer Contracts Regulations. If you ask us to start sooner, a proportionate charge applies for service supplied.",
        "A separate network cease charge may apply only where lawful and actually incurred — capped at £114 inc VAT in the first 12 months and £60 inc VAT after.",
      ]}
      crossSell={{
        title: "Prefer no minimum term?",
        body: "Flex 30 is 30-day rolling with no remaining-month exit charge — a little more each month in exchange for complete flexibility.",
        to: "/broadband/flex",
        label: "Flex 30 broadband",
      }}
    />
  );
}
