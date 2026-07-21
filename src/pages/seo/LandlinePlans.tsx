import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function LandlinePlansSeo() {
  return (
    <>
      <SeoContentLayout
        title="Digital home phone plans — keep your landline number | OCCTA"
        metaDescription="Digital Home Phone from £5/mo. Keep your existing landline number, unlimited UK calls, works over fibre. Ready for the 2027 PSTN switch-off."
        canonical="/landline-plans"
        h1="Landline plans that survive the PSTN switch-off"
        shortAnswer="OCCTA Digital Home Phone runs over your broadband for £5/mo. You keep your existing landline number, get unlimited UK landline and mobile calls, and stay covered when Openreach switches off the copper network by 2027."
        intro="The traditional landline is going away. Digital Home Phone (VoIP) replaces it — same handset, same number, same behaviour, just plugged into the router instead of the wall."
        sections={[
          { heading: "How it works", body: "Your existing corded or DECT phone plugs into the OCCTA router's green port. Anyone can still ring your number. You can still call 999. No new handset needed." },
          { heading: "What's included", body: "Unlimited UK landline and mobile calls, voicemail-to-email, caller display, number porting from your old provider. International calling available as a £3/mo add-on." },
          { heading: "Keeping your number", body: "We port your existing number as part of setup. Most numbers move within 5–10 working days with no downtime." },
          { heading: "Emergency calls and power cuts", body: "Because Digital Voice needs power and broadband, we send a battery back-up unit free to any customer over 65, disabled, or without a working mobile signal at home." },
        ]}
        faqs={[
          { question: "Do I need to buy a new phone?", answer: "No. Any BT-style corded or DECT cordless phone plugs into the router's phone port. If your handset has a normal RJ11 connector, it works." },
          { question: "Can I keep my number?", answer: "Yes, in almost all cases. Provide your existing landline number at checkout and we handle the port." },
          { question: "What happens in a power cut?", answer: "Digital Voice needs power. We supply a free battery back-up unit to eligible vulnerable customers, and always recommend a mobile as a secondary option. See our vulnerable customers policy." },
          { question: "Can I still dial 999?", answer: "Yes. 999 and 112 work exactly the same and your address is registered with the emergency operator." },
          { question: "Do I need OCCTA broadband to have Digital Home Phone?", answer: "Yes — Digital Voice runs over your OCCTA broadband. If you'd rather not switch broadband, we can point you at a standalone VoIP provider." },
        ]}
        relatedLinks={[
          { label: "Digital Voice explained", to: "/learn/digital-voice-explained", description: "The PSTN switch-off, in plain English." },
          { label: "Keep your landline number", to: "/learn/keeping-your-landline-number", description: "How porting works." },
          { label: "Bundle broadband + phone", to: "/broadband-plans", description: "One bill, one Direct Debit." },
          { label: "Coverage check", to: "/coverage-areas", description: "Fibre availability by postcode." },
          { label: "Vulnerable customers policy", to: "/legal/vulnerable-customers", description: "Battery back-up and support." },
          { label: "All landline info", to: "/landline", description: "Full landline product page." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="landline-plans-seo"
          title="Not sure if your phone will still work?"
          description="Send us your postcode and current phone provider — we'll confirm what stays, what moves, and when."
          defaultInterest="landline"
          compact
        />
      </section>
    </>
  );
}