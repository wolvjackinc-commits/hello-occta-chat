import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function SimOnlyPlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="SIM-only plans UK — 5G data on the biggest network | OCCTA"
        metaDescription="Rolling monthly SIM-only plans from £6/mo. 5G data, unlimited UK minutes and texts, eSIM ready. No credit checks, no lock-in — cancel anytime."
        canonical="/sim-only-plans"
        h1="SIM-only plans — 5G, rolling monthly, no lock-in"
        shortAnswer="OCCTA SIM-only plans start at £6/mo with 5G data on the UK's largest 4G/5G network. All plans are rolling monthly with no minimum term. eSIM available on iPhone and modern Android."
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
          { question: "How do I cancel?", answer: "One month's notice, any time, from your dashboard. No exit fee, no clawback." },
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