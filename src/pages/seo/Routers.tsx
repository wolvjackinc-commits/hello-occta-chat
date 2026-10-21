import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function RoutersPage() {
  return (
    <SeoContentLayout
      title="Broadband routers explained — buy ours or bring your own | OCCTA"
      metaDescription="OCCTA plans never include a router. Buy a Wi-Fi 6 router one-off or monthly, or bring your own. Setup guide, compatibility and mesh Wi-Fi tips for UK homes."
      canonical="/routers"
      h1="Broadband routers — get one from us, or bring your own"
      shortAnswer="OCCTA plans don't automatically include a router. Get a Wi-Fi 6 router from us — one-off or monthly where offered — or use your own compatible router for £0. Router options and any charges are shown in your order before you accept."
      intro="Your router is the single biggest factor in how fast your Wi-Fi feels — even faster than your broadband speed. Choose an OCCTA router during your order, or plug in a good router you already own."
      sections={[
        { heading: "Getting a router from us", body: "Choose an OCCTA Wi-Fi 6 router during your order, one-off or monthly where offered. It arrives pre-configured — no logins, no CDs — so you plug it in and get online. The price is shown in your order before you accept." },
        { heading: "Bring your own router (BYOR)", body: "Own a Netgear, ASUS, TP-Link, Google Nest, eero or Deco? Slot in your OCCTA credentials on FTTC, or connect directly to the fibre ONT on FTTP. We support both — no extra charge." },
        { heading: "When to add mesh Wi-Fi", body: "Homes over 120 m², thick walls, or multiple floors usually benefit from a mesh system. See our mesh Wi-Fi guide for our recommended kits at £99, £179 and £249 price points." },
        { heading: "Speeds and Wi-Fi 6 vs Wi-Fi 5", body: "If you're paying for 500Mbps+, Wi-Fi 6 makes a real difference on modern phones and laptops. On a 74Mbps plan any Wi-Fi 5 router will keep up." },
      ]}
      faqs={[
        { question: "Do I have to get a router from OCCTA?", answer: "No. You can use your own compatible router for £0, or choose an OCCTA router during your order. Any router charge is shown in your order before you accept." },
        { question: "Can I use my BT / Sky / Virgin router?", answer: "BT Smart Hubs work with FTTP but not FTTC (they're locked to BT credentials). Sky and Virgin routers can't be re-used on OCCTA. Third-party routers (ASUS, TP-Link, Netgear, etc.) work fine." },
        { question: "Does an OCCTA router come pre-configured?", answer: "Yes. Serial number, Wi-Fi name and password are printed on the sticker. Plug in on activation day and it just works." },
        { question: "What about static IPs and port forwarding?", answer: "Our routers support port forwarding, DDNS and guest Wi-Fi. Static IPs are available as a £5/mo add-on for FTTC/FTTP plans." },
        { question: "Do you support mesh systems like eero and Deco?", answer: "Yes — replace or extend the router with any mesh brand. On FTTP we can even put the mesh straight on the ONT and skip the OCCTA router entirely." },
      ]}
      relatedLinks={[
        { label: "Own-router setup guide", to: "/help/own-router-setup", description: "Step-by-step for FTTC and FTTP." },
        { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide", description: "When and why to add mesh." },
        { label: "Router buying guide", to: "/learn/router-buying-guide", description: "What to look for." },
        { label: "Broadband speed guide", to: "/learn/broadband-speed-guide", description: "Match the router to your plan." },
        { label: "Slow broadband fixes", to: "/learn/slow-broadband-fixes", description: "Speed up your Wi-Fi." },
        { label: "Home broadband plans", to: "/broadband", description: "Compare plans and router options." },
      ]}
      afterContent={
        <LeadCaptureWidget
          source="routers-seo"
          title="Want us to pick the right router for your home?"
          description="Tell us your postcode and what you're after — we'll recommend the right router (or mesh kit) for your address."
          defaultInterest="router"
          compact
        />
      }
    />
  );
}