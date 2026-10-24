import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandSection, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";

const LINKS = {
  broadband: [
    { label: "Full fibre broadband", to: "/full-fibre-broadband" },
    { label: "Gigabit broadband", to: "/gigabit-broadband" },
    { label: "Ultrafast broadband", to: "/ultrafast-broadband" },
    { label: "Superfast broadband", to: "/superfast-broadband" },
    { label: "No-contract broadband", to: "/no-contract-broadband-uk" },
    { label: "Fixed-price broadband", to: "/fixed-price-broadband" },
    { label: "Broadband without a landline", to: "/broadband-without-landline" },
    { label: "Moving house broadband", to: "/moving-house-broadband" },
    { label: "Broadband in your area", to: "/coverage-areas" },
  ],
  sim: [
    { label: "Unlimited data SIM", to: "/unlimited-data-sim" },
    { label: "30-day SIM only", to: "/30-day-sim-only" },
    { label: "eSIM plans", to: "/esim" },
    { label: "Data-only SIM", to: "/data-only-sim" },
    { label: "SIM only on O2", to: "/o2-sim-only-deals" },
    { label: "SIM only on Vodafone", to: "/vodafone-sim-only-deals" },
    { label: "SIM only on EE", to: "/ee-sim-only-deals" },
    { label: "Business SIMs", to: "/business/sim" },
  ],
  business: [
    { label: "Business broadband", to: "/business/broadband" },
    { label: "Leased lines", to: "/business/leased-lines" },
    { label: "Hosted VoIP phone system", to: "/business/voice" },
    { label: "SIP trunks", to: "/business/sip-trunks" },
    { label: "Business SIMs", to: "/business/sim" },
    { label: "Business bundles", to: "/business/bundles" },
  ],
} as const;

const TITLES = { broadband: "Find the right broadband", sim: "Browse SIM plans by type", business: "Business connectivity" };

/** Contextual links from a hub page to its category landing pages. */
export default function CategoryLinks({ family, exclude }: { family: keyof typeof LINKS; exclude?: string }) {
  const links = LINKS[family].filter((l) => l.to !== exclude);
  return (
    <BrandSection tone="paper" className="border-t-[3px] border-foreground">
      <Reveal>
        <SectionEyebrow index="→" label="Browse" />
        <SectionTitle className="mt-5">{TITLES[family]}</SectionTitle>
      </Reveal>
      <nav aria-label={TITLES[family]} className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="flex items-center justify-between border-[3px] border-foreground bg-card px-5 py-4 font-display text-lg uppercase hover:bg-primary hover:text-black">
                {l.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </BrandSection>
  );
}
