import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function SimOnlyPlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="SIM-only plans UK — clear prices and terms | OCCTA"
        metaDescription="OCCTA SIM-only plans on O2, Vodafone and EE, with 30-day and 24-month options where available. Live prices, allowances and contract terms are shown before checkout."
        canonical="/sim-only-plans"
        h1="SIM-only plans — clear prices and contract terms"
        shortAnswer="OCCTA offers selected SIM-only plans on O2, Vodafone and EE with 30-day rolling and 24-month terms where available. The live SIM catalogue shows the current VAT-inclusive consumer price, allowance, term and any applicable price-adjustment or early-termination information before checkout."
        intro="Choose from the live SIM catalogue. Network, allowance, contract term, SIM type, roaming, price and any applicable charges are shown for the specific tariff before you order."
        sections={[
          { heading: "The plans", body: "OCCTA SIM plans are catalogue-driven. Selected 30-day and 24-month tariffs may be available on O2, Vodafone and EE. Use the live SIM page for the current allowance, VAT-inclusive consumer price, term, price-adjustment information and any early-termination treatment." },
          { heading: "eSIM or physical SIM", body: "eSIM and physical-SIM availability depends on the selected live tariff and device compatibility. Checkout shows the available SIM type and any delivery charge or timing before you order." },
          { heading: "Keep your number", body: "Number transfer is available on eligible orders using the applicable PAC process. The expected porting process and timing are confirmed for the order; we do not guarantee a universal next-day transfer." },
          { heading: "Allowances and fair use", body: "Data, calls, texts, roaming and fair-use rules depend on the selected tariff. The live catalogue and pre-contract information are the source of truth for the plan you choose." },
        ]}
        faqs={[
          { question: "Which networks are available?", answer: "Selected tariffs may be available on O2, Vodafone and EE. Choose the network and tariff shown in the live catalogue that best fits your needs." },
          { question: "Is 5G included?", answer: "5G availability depends on the selected tariff, compatible device and underlying network coverage. Check the live plan details before ordering." },
          { question: "Can I use it abroad?", answer: "Roaming destinations, fair-use limits and charges depend on the selected tariff. Check the live catalogue and pre-contract information for the plan you choose." },
          { question: "Are there eligibility checks?", answer: "Any identity, eligibility or account checks depend on the selected tariff and current ordering process. The checkout explains what applies before you commit." },
          { question: "How do I cancel?", answer: "Cancellation depends on the SIM term you choose. 30-day plans and 24-month plans have different notice and early-termination treatment; the exact terms are shown before checkout and in your accepted agreement." },
        ]}
        relatedLinks={[
          { label: "All SIM plans", to: "/sim", description: "Live plan grid and checkout." },
          { label: "eSIM vs physical SIM", to: "/learn/esim-vs-physical-sim", description: "Which one to pick." },
          { label: "Best SIM-only deals UK", to: "/learn/best-sim-only-deals-uk", description: "What to compare." },
          { label: "Coverage check", to: "/coverage-areas", description: "Check current coverage information." },
          { label: "Broadband", to: "/broadband", description: "Compare broadband options." },
          { label: "Business SIMs", to: "/business/sim", description: "SIM options for teams." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="sim-only-plans-seo"
          title="Need help choosing a SIM?"
          description="Tell us what you need and we can point you to the current live tariff options."
          defaultInterest="sim"
          compact
        />
      </section>
    </>
  );
}
