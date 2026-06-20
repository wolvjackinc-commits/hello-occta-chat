import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function BroadbandAndDigitalVoicePage() {
  return (
    <SeoContentLayout
      title="Broadband + Digital Voice / Home Phone | OCCTA"
      metaDescription="Add OCCTA Digital Voice / Home Phone to your broadband. Calls run over your broadband, so an active OCCTA broadband line is required. Honest pricing and clear billing."
      canonical="/broadband-and-digital-voice"
      h1="Broadband + Digital Voice / Home Phone"
      shortAnswer="Digital Voice / Home Phone is OCCTA's home phone service that works over your broadband connection. Because it runs over IP, an active OCCTA broadband line is required — there is no standalone landline product."
      intro={
        <p>The UK is moving home phones off the old copper network and onto broadband-based digital voice. OCCTA's Digital Voice / Home Phone is the broadband-based replacement. You can add it during a new broadband order or to an existing OCCTA broadband line.</p>
      }
      sections={[
        {
          heading: "How it works",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Your broadband router carries the phone calls — no separate copper line is needed.</li>
              <li>You can usually keep your existing landline number when you switch (subject to the donating provider's process).</li>
              <li>Calls work like any other landline — pick up the handset, dial out, receive incoming calls.</li>
              <li>If your broadband or power is down, the phone won't work — please plan ahead if anyone in the household relies on the line for healthcare or telecare.</li>
            </ul>
          ),
        },
        {
          heading: "What you need",
          body: (
            <p>An active OCCTA broadband line at your address, the router we provide, and a standard handset. We'll send any setup instructions during onboarding.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Can I buy Digital Voice without OCCTA broadband?", answer: "No. Digital Voice / Home Phone requires an active OCCTA broadband line — that's how the calls reach the network." },
        { question: "What about power cuts and 999?", answer: "Because Digital Voice runs over broadband, it depends on power and your internet connection. We discuss back-up options at sign-up for households where someone relies on the phone — see /vulnerable-customers." },
      ]}
      faqs={[
        { question: "Can I keep my existing landline number?", answer: "Usually yes. We start the number port during onboarding once your broadband is live." },
        { question: "Do I need a special phone handset?", answer: "Any standard corded or cordless DECT handset plugs into the router." },
        { question: "What if my broadband goes down?", answer: "The phone will be unavailable until broadband and power are restored. If anyone in your home depends on the line, please tell us at sign-up so we can discuss back-up options." },
      ]}
      relatedLinks={[
        { label: "Digital Voice / Home Phone", to: "/landline" },
        { label: "Fibre broadband", to: "/fibre-broadband" },
        { label: "Coverage check", to: "/coverage" },
        { label: "Vulnerable customers", to: "/vulnerable-customers" },
        { label: "Pricing", to: "/pricing" },
      ]}
      compliance={
        <p>Digital Voice / Home Phone requires power and an active broadband connection to make calls, including to 999. Plan back-up options if anyone in the household relies on the phone for healthcare or telecare.</p>
      }
    />
  );
}