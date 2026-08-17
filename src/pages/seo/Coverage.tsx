import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function CoveragePage() {
  return (
    <SeoContentLayout
      title="UK Broadband Coverage — How to Check Availability | OCCTA"
      metaDescription="How OCCTA checks UK broadband availability at your address. Understand full fibre, FTTC and copper options, and what you'll see on your quote."
      canonical="/coverage"
      h1="Broadband coverage at your address"
      shortAnswer="OCCTA serves UK addresses on the Openreach and partner wholesale networks. The line technology available at your address (full fibre, FTTC, or a copper alternative) determines which plans we can quote you — start the availability check to see real options for your postcode."
      intro={
        <p>This page explains how UK broadband coverage works and what an OCCTA availability check tells you. It is not a customer-specific result — for that, run the address check from any plan page or the build-plan flow.</p>
      }
      sections={[
        {
          heading: "What we check",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Line technology:</strong> whether your address has full fibre (FTTP), part-fibre (FTTC) or only a copper-based alternative.</li>
              <li><strong>Estimated speeds:</strong> the indicative download/upload range for the available products.</li>
              <li><strong>Setup requirements:</strong> whether a new line, an engineer visit or self-install is needed.</li>
            </ul>
          ),
        },
        {
          heading: "Why coverage varies",
          body: (
            <p>The UK is in the middle of a long-term upgrade from copper to full fibre. Two homes on the same street can have different products available because the cabinet, duct and last-drop infrastructure was built out at different times. Your postcode alone is not enough — we check at the full address level.</p>
          ),
        },
        {
          heading: "Digital Voice / Home Phone and coverage",
          body: (
            <p>Traditional landlines are being switched off across the UK. OCCTA's Digital Voice / Home Phone runs over your broadband, so you'll need an active OCCTA broadband line to use it. If your address can take broadband, you can add Digital Voice.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Can I get OCCTA broadband at my address?", answer: "Run the availability check from any plan page. We confirm the underlying line type and indicative speeds at your full address before showing eligible plans." },
        { question: "What if my address has no fibre yet?", answer: "Where only a copper-based alternative is available, we'll show the eligible product (or none, if none is appropriate). We won't sell you a plan your line can't support." },
      ]}
      faqs={[
        { question: "Is OCCTA available across the whole UK?", answer: "OCCTA serves UK addresses where its wholesale partner networks have reach. The check confirms what's available at your specific address." },
        { question: "Do you guarantee a specific speed?", answer: "No. We show estimated speeds based on the underlying wholesale data. Real-world speed depends on your in-home setup, wiring, distance from the cabinet and concurrent usage." },
        { question: "What happens if my address has no available product?", answer: "We won't be able to take an order. You can leave your details with us so we can let you know if the network upgrades reach you." },
      ]}
      relatedLinks={[
        { label: "Broadband plans", to: "/broadband" },
        { label: "Fibre broadband", to: "/fibre-broadband" },
        { label: "Broadband + Digital Voice", to: "/broadband-and-digital-voice" },
        { label: "Pricing", to: "/pricing" },
        { label: "Build your plan", to: "/order" },
      ]}
      primaryCta={{ label: "Check my address", to: "/order" }}
      compliance={
        <p>Speeds shown during the availability check are indicative wholesale estimates and are not a guarantee. Final speeds depend on your installation, equipment and how the line performs in service.</p>
      }
    />
  );
}