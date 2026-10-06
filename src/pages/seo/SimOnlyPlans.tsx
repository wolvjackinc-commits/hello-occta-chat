import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function SimOnlyPlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="SIM-only plans UK — 5G data on the biggest network | OCCTA"
        metaDescription="OCCTA SIM-only plans on O2, Vodafone and EE, with 30-day and 24-month options where available. Live prices, allowances and contract terms are shown before checkout."
        canonical="/sim-only-plans"
        h1="SIM-only plans — clear prices and contract terms"
        shortAnswer="OCCTA offers selected SIM-only plans on O2, Vodafone and EE with 30-day rolling and 24-month terms where available. The live SIM catalogue shows the current VAT-inclusive consumer price, allowance, term and any applicable price-adjustment or early-termination information before checkout."
        intro="A SIM should be cheap, fast and forgettable. Ours is. Pick a data allowance, keep your number, and change it whenever you want."
        sections={[
          { heading: "The plans", body: "Lite 5GB £6, Everyday 20GB £9, Unlimited £14 — every plan includes unlimited UK minutes and texts, EU roaming up to 12GB, and 5G at no extra cost." },
          { heading: "eSIM or physical SIM", body: "iPhone 12 and newer, and most Android flagships from 2022 onward, support eSIM — you can be live in about 5 minutes. Prefer a physical SIM? Free next-day delivery." },
          { heading: "Keep your number", body: "PAC codes are honoured — port your number in without downtime. Most numbers move within one working day." },
          { heading: "Fair use, actually fair", body: "'Unlimited' means unlimited. No throttling after a hidden cap, no tethering restriction, no surprise 'peak time' rules." },
        ]}
        faqs={[
          { question: "Which network does OCCTA use?", answer: "We're an MVNO on the UK's largest 4G/5G network, so you get the same coverage without the parent-brand price tag." },
          { question: "Is 5G included?", answer: "Yes — 5G is on by default at no extra cost wherever the underlying network has coverage." },
          { question: "Can I use it abroad?", answer: "Yes — all plans include EU roaming up to a fair-use cap of 12GB per month at no extra charge." },
          { question: "Do you credit check?", answer: "No credit check for SIM-only plans. Payment is by Direct Debit or card on the first of each month." },
          { question: "How do I cancel?", answer: "Cancellation depends on the SIM term you choose. 30-day plans and 24-month plans have different notice and early-termination treatment; the exact terms are shown before checkout and in your accepted agreement." },
        ]}
        relatedLinks={[
          { label: "All SIM plans", to: "/sim", description: "Full plan grid and checkout." },
          { label: "eSIM vs physical SIM", to: "/learn/esim-vs-physical-sim", description: "Which one to pick." },
          { label: "Best SIM-only deals UK", to: "/learn/best-sim-only-deals-uk", description: "What to look for in 2026." },
          { label: "Coverage check", to: "/coverage-areas", description: "See where 5G is live." },
          { label: "Bundle broadband + SIM", to: "/broadband-plans", description: "One bill, one Direct Debit." },
          { label: "Business SIMs", to: "/business/sim", description: "Multi-line SIMs for teams." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="sim-only-plans-seo"
          title="Want us to pick the right SIM?"
          description="Tell us how much data you actually use and we'll match the right plan — no upsells."
          defaultInterest="sim"
          compact
        />
      </section>
    </>
  );
}