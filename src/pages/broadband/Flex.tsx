import { SEO } from "@/components/seo";
import { RollingDialArt } from "@/components/brand/illustrations";
import TermPlanLayout from "./TermPlanLayout";

const points = [
  "30-day rolling options available. Cancel with notice.",
  "All monthly and one-off charges shown before you order.",
  "Free standard installation where available and shown in your quote.",
  "Availability depends on your exact address.",
];

export default function FlexBroadband() {
  return (
    <TermPlanLayout
      seo={
        <SEO
          title="Flex Broadband — 30-day rolling"
          description="OCCTA Flex Broadband. 30-day rolling options. Charges shown before you order. Availability depends on your exact address."
          canonical="/broadband/flex"
        />
      }
      kicker="Flex Broadband"
      title={
        <>
          Broadband
          {" "}<span className="block text-primary">without the lock-in.</span>
        </>
      }
      intro={
        <>
          Flex Broadband is for customers who want flexibility over the lowest possible price.
          Choose a 30-day rolling option, cancel with notice, and pay only for what's shown in your quote.
        </>
      }
      art={<RollingDialArt className="mx-auto h-auto w-full max-w-[260px]" />}
      points={points}
      notes={[
        "Any setup, cease, equipment or supplier charges are shown before you order.",
        "Checks or deposits may apply depending on product/supplier.",
        "Speeds and final price depend on your confirmed address.",
        "14-day cooling-off period applies under the Consumer Contracts Regulations.",
      ]}
      crossSell={{
        title: "Want lower monthly pricing?",
        body: "Look at Contract Saver — keeps your monthly bill down in exchange for a longer term and stronger rewards eligibility.",
        to: "/broadband/contract-saver",
        label: "Contract Saver",
      }}
    />
  );
}
