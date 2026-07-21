import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function RoutersPage() {
  return (
    <>
      <SeoContentLayout
        title="Broadband routers explained — free router or bring your own | OCCTA"
        metaDescription="Every OCCTA broadband plan includes a free Wi-Fi router. Prefer your own? Bring it. Full setup guide, compatibility, and mesh Wi-Fi tips for UK homes."
        canonical="/routers"
        h1="Broadband routers — free with every plan, or bring your own"
        shortAnswer="OCCTA ships a free dual-band Wi-Fi 6 router with every broadband order and supports bring-your-own routers on FTTP and FTTC. Setup takes about ten minutes."
        intro="Your router is the single biggest factor in how fast your Wi-Fi feels — even faster than your broadband speed. We include a solid one for free, but if you already own a good router, you can plug it straight in."
        sections={[
          { heading: "The router we send", body: "A dual-band Wi-Fi 6 router that handles typical UK homes up to 4 bedrooms comfortably. Pre-configured, no logins, no CDs — plug in the fibre cable, wait five minutes, and you're online." },
          { heading: "Bring your own router (BYOR)", body: "Own a Netgear, ASUS, TP-Link, Google Nest, eero or Deco? Slot in your OCCTA credentials on FTTC, or connect directly to the fibre ONT on FTTP. We support both — no extra charge." },
          { heading: "When to add mesh Wi-Fi", body: "Homes over 120 m², thick walls, or multiple floors usually benefit from a mesh system. See our mesh Wi-Fi guide for our recommended kits at £99, £179 and £249 price points." },
          { heading: "Speeds and Wi-Fi 6 vs Wi-Fi 5", body: "If you're paying for 500Mbps+, Wi-Fi 6 makes a real difference on modern phones and laptops. On a 74Mbps plan any Wi-Fi 5 router will keep up." },
        ]}
        faqs={[
          { question: "Is the router really free?", answer: "Yes. No hire-purchase, no return fee if you cancel, no deposit. It's yours to keep." },
          { question: "Can I use my BT / Sky / Virgin router?", answer: "BT Smart Hubs work with FTTP but not FTTC (they're locked to BT credentials). Sky and Virgin routers can't be re-used on OCCTA. Third-party routers (ASUS, TP-Link, Netgear, etc.) work fine." },
          { question: "Does it come pre-configured?", answer: "Yes. Serial number, Wi-Fi name and password are printed on the sticker. Plug in on activation day and it just works." },
          { question: "What about static IPs and port forwarding?", answer: "The included router supports port forwarding, DDNS and guest Wi-Fi. Static IPs are available as a £5/mo add-on for FTTC/FTTP plans." },
          { question: "Do you support mesh systems like eero and Deco?", answer: "Yes — replace or extend the router with any mesh brand. On FTTP we can even put the mesh straight on the ONT and skip the OCCTA router entirely." },
        ]}
        relatedLinks={[
          { label: "Own-router setup guide", to: "/help/own-router-setup", description: "Step-by-step for FTTC and FTTP." },
          { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide", description: "When and why to add mesh." },
          { label: "Router buying guide", to: "/learn/router-buying-guide", description: "What to look for." },
          { label: "Broadband speed guide", to: "/learn/broadband-speed-guide", description: "Match the router to your plan." },
          { label: "Slow broadband fixes", to: "/learn/slow-broadband-fixes", description: "Speed up your Wi-Fi." },
          { label: "Home broadband plans", to: "/broadband", description: "Every plan ships with a router." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="routers-seo"
          title="Want us to pick the right router for your home?"
          description="Tell us your postcode and what you're after — we'll recommend the right router (or mesh kit) for your address."
          defaultInterest="router"
          compact
        />
      </section>
    </>
  );
}