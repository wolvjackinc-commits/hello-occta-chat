import { useEffect } from "react";
import { SEO } from "@/components/seo";
import { logClientEvent } from "@/lib/activityLog";
import { LockStripArt } from "@/components/brand/illustrations";
import TermPlanLayout from "./TermPlanLayout";

const points = [
  "Lower indicative monthly pricing in exchange for a longer minimum term.",
  "Eligible for the OCCTA Rewards programme (launching soon).",
  "All monthly and one-off charges shown before you order.",
  "Availability depends on your exact address.",
];

export default function ContractSaverBroadband() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Contract Saver page", source_module: "marketing" });
  }, []);

  return (
    <TermPlanLayout
      seo={
        <SEO
          title="Contract Saver Broadband"
          description="OCCTA Contract Saver Broadband. Lower indicative monthly pricing in exchange for a longer minimum term. Final price and key terms confirmed in your Contract Summary before you pay."
          canonical="/broadband/contract-saver"
        />
      }
      kicker="Contract Saver Broadband"
      title={
        <>
          Lower monthly bill,
          {" "}<span className="block text-primary">longer term.</span>
        </>
      }
      intro={
        <>
          Contract Saver is for customers who want a lower monthly price and don't mind committing for longer.
          Final price, contract length, fees, speed and key terms will be confirmed in your Contract Summary before you pay.
        </>
      }
      art={<LockStripArt className="mx-auto h-auto w-full max-w-[300px]" />}
      points={points}
      notes={[
        "Early termination fees may apply if you leave before the minimum term ends — shown in your Contract Summary.",
        "Any setup, equipment or supplier charges are shown before you order.",
        "Speeds and final price depend on your confirmed address.",
        "14-day cooling-off period applies under the Consumer Contracts Regulations.",
      ]}
      crossSell={{
        title: "Prefer no minimum term?",
        body: "Look at Flex — 30-day rolling, cancel with notice.",
        to: "/broadband/flex",
        label: "Flex Broadband",
      }}
    />
  );
}
