import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function FibreBroadbandPage() {
  return (
    <SeoContentLayout
      title="Fibre Broadband UK — Honest, Flexible Plans | OCCTA"
      metaDescription="OCCTA fibre broadband for UK homes. Full fibre and FTTC where available, flexible monthly options where applicable, and billing that starts only after activation."
      canonical="/fibre-broadband"
      h1="Fibre broadband"
      shortAnswer="OCCTA sells fibre broadband to UK homes — full fibre (FTTP) where the network has reached your address, or part-fibre (FTTC) where it hasn't. We don't claim to be the cheapest or the fastest; we just keep billing, support and switching honest."
      intro={
        <p>Most of the UK is moving to full-fibre broadband. The product available at your address depends on what's been built — so the first step is always the availability check. Once we know your line type, we can show real eligible plans and a clean monthly price.</p>
      }
      sections={[
        {
          heading: "What you get",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Fibre broadband on the line technology available at your address.</li>
              <li>UK-based support by email, phone and the Ollie assistant in the corner of every page.</li>
              <li>Itemised quote — no surprise bundle uplifts.</li>
              <li>Direct Debit setup or pay-by-card via secure Worldpay payment links.</li>
              <li>Flexible monthly options where applicable to the plan and line type.</li>
            </ul>
          ),
        },
        {
          heading: "Full fibre vs FTTC",
          body: (
            <p>Full fibre (FTTP) runs a fibre strand all the way to your home. FTTC runs fibre to a street cabinet, then copper to your home. Both are sold as "fibre broadband" — what we offer at your address depends on the network.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Is OCCTA fibre full fibre?", answer: "Where the Openreach or partner network has built FTTP to your address, yes. Where it hasn't, we sell the eligible FTTC product instead. The availability check shows which." },
        { question: "How fast is the broadband?", answer: "Estimated speeds are shown for each eligible plan before you order. They are wholesale-network estimates, not guaranteed speeds." },
      ]}
      faqs={[
        { question: "Do you offer rolling monthly fibre broadband?", answer: "Where a flexible monthly option is applicable to the plan and line type, yes. The plan card and your accepted agreement state the term." },
        { question: "Does fibre broadband include a phone line?", answer: "Most modern fibre products are broadband-only. If you want a home phone, add OCCTA Digital Voice / Home Phone — it runs over your broadband." },
        { question: "When does the first invoice arrive?", answer: "After your service activation is confirmed. The first invoice may include an activation fee (if any) and pro-rata charges for the partial month — see /first-invoice-explained." },
      ]}
      relatedLinks={[
        { label: "Coverage check", to: "/coverage" },
        { label: "Broadband + Digital Voice", to: "/broadband-and-digital-voice" },
        { label: "Pricing", to: "/pricing" },
        { label: "Billing explained", to: "/billing-explained" },
        { label: "Build your plan", to: "/order" },
      ]}
      compliance={
        <p>Speeds are estimates from the underlying wholesale network and are not guaranteed. Your accepted agreement is the binding source of truth on price, term and cancellation.</p>
      }
    />
  );
}