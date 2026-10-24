/**
 * Product-category landing pages (/full-fibre-broadband, /unlimited-data-sim …).
 *
 * Each page targets a search people actually make for an OCCTA product and
 * answers it properly: what the product is, live prices/plans, the honest
 * terms, FAQs and links onward. Rendered by src/pages/ProductLanding.tsx.
 *
 * Price tokens in copy are replaced at render time from the live pricing
 * engine / catalogues so the page never drifts from what customers pay:
 *   {essential} {superfast} {ultrafast} {gigabit}   Price Lock 24 band price
 *   {essentialFlex} {superfastFlex} {ultrafastFlex} {gigabitFlex}   Flex 30
 *   {bb} cheapest broadband · {landline} Digital Voice from · {sim} SIM from
 *   {voip} Hosted VoIP seat (ex VAT) · {sip} SIP trunk (ex VAT)
 *
 * Copy rules (see AGENTS.md and SEO_GROWTH_RELEASE.md): no "cancel anytime",
 * "no contracts", "free installation" or "24/7 support"; availability, speed
 * and charges are always address/order specific; payment is Direct Debit or
 * bank transfer only.
 */
import type { SpeedBucket } from "@/lib/pricing/fairPricing";

export type ProductFamily = "broadband" | "sim" | "business";

export interface SimPlanFilter {
  networks?: string[];
  term?: "30_day" | "24_month";
  categories?: ("single_user" | "mobile_broadband" | "promo_unlimited")[];
  unlimitedOnly?: boolean;
  esimOnly?: boolean;
}

export interface ProductLanding {
  slug: string;
  family: ProductFamily;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  breadcrumb: string;
  kicker: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  /** Broadband speed bands to show as live price cards. */
  bands?: SpeedBucket[];
  /** Live SIM catalogue filter (consumer plans). */
  simFilter?: SimPlanFilter;
  /** Business catalogue product ids to show. */
  businessProducts?: string[];
  intro: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  faqs: { question: string; answer: string }[];
  related: { label: string; to: string }[];
  cta: { title: string; text: string; to: string; button: string };
}

const BB_TERMS =
  "Every OCCTA broadband band is available as Price Lock 24 (a 24-month minimum term with no scheduled inflation-linked or percentage rise on the recurring subscription) or Flex 30 (30-day rolling, normally 30 days' notice) where eligible.";
const BB_CHECK =
  "Availability, technology and the speed estimate depend on the exact address. The checker shows what your line can take, and the Contract Summary confirms the price, term, speed information and any one-off charges before you accept.";
const PAYMENT =
  "OCCTA takes payment by Direct Debit or bank transfer only. Billing starts once your service is confirmed live.";
const SIM_TERMS =
  "30-day plans roll monthly and may carry a cease charge depending on the service. 24-month plans have a minimum term and may have an early termination charge. All plans are subject to network availability, fair usage and annual price adjustments, shown before you order.";

export const productLandings: ProductLanding[] = [
  /* ───────────────────────────── Broadband ───────────────────────────── */
  {
    slug: "full-fibre-broadband",
    family: "broadband",
    metaTitle: "Full Fibre Broadband Deals UK — FTTP up to 1Gbps | OCCTA",
    metaDescription:
      "Full fibre (FTTP) broadband from OCCTA: Superfast, Ultrafast and Gigabit bands up to 1000Mbps where available. Price Lock 24 or Flex 30. Check your address.",
    keywords:
      "full fibre broadband, full fibre broadband deals, FTTP broadband, fibre to the premises, full fibre UK, cheap full fibre broadband, full fibre no contract",
    breadcrumb: "Full fibre broadband",
    kicker: "FTTP · up to 1000Mbps",
    heroTitle: "Full fibre broadband",
    heroHighlight: "fibre all the way in",
    heroSubtitle:
      "Fibre-optic cable from the exchange right into your home. Faster, steadier and ready for the 2027 landline switch-off — from {superfast}/mo on Price Lock 24 where your address can take it.",
    bands: ["superfast", "ultrafast", "gigabit"],
    intro:
      "Full fibre — also called FTTP (fibre to the premises) — replaces the old copper line with fibre-optic cable all the way to your property. It is the technology behind OCCTA's Superfast, Ultrafast and Gigabit bands.",
    sections: [
      {
        heading: "What makes full fibre different",
        paragraphs: [
          "Most older “fibre” broadband (FTTC) runs fibre only as far as the green street cabinet, then uses copper telephone wire for the last stretch. Copper loses speed with distance, which is why FTTC tops out around 80Mbps and slows down the further you are from the cabinet.",
          "Full fibre has no copper section. Speed doesn't fade with distance, upload speeds are much higher, and the connection is less affected by weather and electrical interference.",
        ],
        bullets: [
          "Download speed bands up to 330Mbps, 550Mbps or 1000Mbps where available",
          "Much faster uploads for video calls, cloud backups and streaming",
          "A small ONT box is fitted where the fibre enters your home; your router plugs into it",
          "No phone line or line rental needed — add Digital Voice from {landline}/mo if you want a home number",
        ],
      },
      {
        heading: "Which OCCTA band should you pick?",
        paragraphs: [
          "Superfast (up to 330Mbps) suits most households with several people streaming and working from home. Ultrafast (up to 550Mbps) is for busy homes with 4K TV, gaming and big downloads. Gigabit (up to 1000Mbps) is for heavy users, home studios and the very well connected.",
          "If full fibre isn't available at your address yet, OCCTA's Essential band (up to 80Mbps) runs over the existing fibre-to-the-cabinet network instead. Our guide to what broadband speed you need explains how to size it.",
        ],
      },
      {
        heading: "Price certainty or flexibility",
        paragraphs: [BB_TERMS, "Gigabit is {gigabit}/mo on Price Lock 24. Ultrafast is {ultrafast}/mo and Superfast {superfast}/mo, with Flex 30 priced separately where offered."],
      },
      {
        heading: "Getting full fibre installed",
        paragraphs: [
          "If your property has never had full fibre, an engineer usually needs to visit to bring the fibre in and fit the ONT. If fibre is already installed, activation is often a simple switch-over. Any engineer or setup charge is shown before you accept, and our FTTP installation guide walks through the day.",
          BB_CHECK,
        ],
      },
    ],
    faqs: [
      { question: "Is full fibre the same as fibre broadband?", answer: "Not always. “Fibre broadband” is often used for FTTC, where copper carries the last part of the connection. Full fibre (FTTP) is fibre all the way into your home, which is faster and more reliable." },
      { question: "How do I know if I can get full fibre?", answer: "Enter your postcode and choose your address in the OCCTA checker. It shows which technology and speed bands your line can take before you order." },
      { question: "Do I need a landline for full fibre?", answer: "No. OCCTA full fibre is broadband only, with no line rental. If you want to keep or get a home phone number, add Digital Voice, which runs over the broadband." },
      { question: "How much is OCCTA full fibre?", answer: "Full fibre bands start at {superfast}/mo on Price Lock 24 (Superfast, up to 330Mbps). Ultrafast is {ultrafast}/mo and Gigabit {gigabit}/mo. Flex 30 rolling prices are shown where eligible." },
      { question: "Will I need an engineer?", answer: "Only if fibre isn't already installed at the property. The order shows whether an engineer visit is needed and any charge before you accept." },
    ],
    related: [
      { label: "Gigabit broadband", to: "/gigabit-broadband" },
      { label: "What is FTTP?", to: "/learn/what-is-fttp" },
      { label: "FTTP installation: what to expect", to: "/learn/fttp-installation-what-to-expect" },
      { label: "Fibre vs full fibre explained", to: "/guides/fibre-vs-full-fibre-explained" },
      { label: "What broadband speed do I need?", to: "/guides/what-broadband-speed-do-i-need" },
      { label: "All broadband plans", to: "/broadband" },
    ],
    cta: { title: "Check full fibre at your address", text: "See the bands and prices your line can actually take.", to: "/broadband", button: "Check availability" },
  },
  {
    slug: "gigabit-broadband",
    family: "broadband",
    metaTitle: "Gigabit Broadband Deals — 1Gbps Full Fibre | OCCTA",
    metaDescription:
      "OCCTA Gigabit full fibre broadband up to 1000Mbps where available, {gigabit}/mo on Price Lock 24 or Flex 30. Fast uploads, no line rental. Check your address.",
    keywords:
      "gigabit broadband, 1gb broadband, 1Gbps broadband deals, 900Mb broadband, gigabit full fibre, fastest broadband UK, 1000Mbps broadband",
    breadcrumb: "Gigabit broadband",
    kicker: "Up to 1000Mbps",
    heroTitle: "Gigabit broadband",
    heroHighlight: "up to 1000Mbps",
    heroSubtitle:
      "OCCTA's fastest band. Full fibre up to 1Gbps for homes that download, upload, stream and game all at once — {gigabit}/mo on Price Lock 24 where available.",
    bands: ["gigabit", "ultrafast"],
    intro:
      "Gigabit broadband means download speeds up to 1000Mbps (1Gbps). In the UK it is delivered over full fibre (FTTP), and OCCTA's Gigabit band is our top speed tier.",
    sections: [
      {
        heading: "Who actually needs gigabit?",
        paragraphs: [
          "A single 4K stream needs around 25Mbps, so gigabit isn't about one device. It is for homes where lots happens at once: several 4K TVs, large game downloads, video calls, cloud backups and dozens of smart devices.",
          "It also suits creators and home workers who upload large files. Full fibre upload speeds are far higher than copper-based broadband, so sending a video or syncing a backup takes minutes, not hours.",
        ],
        bullets: [
          "Download a 100GB game in roughly 15 minutes at full speed, versus hours on slower lines",
          "Plenty of headroom for households of five or more heavy users",
          "Low latency for competitive online gaming",
          "Future-proofed for the next decade of streaming and smart-home kit",
        ],
      },
      {
        heading: "Getting the most from 1Gbps",
        paragraphs: [
          "Wi-Fi is usually the bottleneck, not the line. To see gigabit speeds, connect your main devices by Ethernet or use a Wi-Fi 6 or Wi-Fi 6E router, and consider mesh Wi-Fi in larger homes. Our router and mesh guides explain the options.",
          "Speed tests over Wi-Fi on a phone will often show less than the line delivers. Test with a wired computer to see the real figure.",
        ],
      },
      {
        heading: "Price and terms",
        paragraphs: [BB_TERMS, "Gigabit is {gigabit}/mo on Price Lock 24 and {gigabitFlex}/mo on Flex 30 where eligible. If gigabit is more than you need, Ultrafast (up to 550Mbps) is {ultrafast}/mo."],
      },
      { heading: "Check your address", paragraphs: [BB_CHECK, PAYMENT] },
    ],
    faqs: [
      { question: "Is 1Gbps the same as 1000Mbps?", answer: "Yes. 1 gigabit per second is 1000 megabits per second. Providers sometimes sell “900Mb” plans; OCCTA's Gigabit band is up to 1000Mbps where available." },
      { question: "Will I get 1000Mbps on Wi-Fi?", answer: "Rarely on a single Wi-Fi device. Wired Ethernet connections get closest to the line speed. A modern Wi-Fi 6 or mesh system helps share the speed around the home." },
      { question: "How much is OCCTA gigabit broadband?", answer: "{gigabit}/mo on Price Lock 24, or {gigabitFlex}/mo on Flex 30 where eligible. Any setup or router charge is shown before you accept." },
      { question: "Can I get gigabit broadband without a contract?", answer: "Flex 30 is OCCTA's 30-day rolling option, offered where eligible. It has no fixed minimum term and normally needs 30 days' notice to leave." },
      { question: "What do I need for gigabit at home?", answer: "Full fibre (FTTP) at the address, a gigabit-capable router, and ideally Ethernet or Wi-Fi 6 for your main devices." },
    ],
    related: [
      { label: "Full fibre broadband", to: "/full-fibre-broadband" },
      { label: "Ultrafast broadband", to: "/ultrafast-broadband" },
      { label: "Broadband for gaming", to: "/broadband-for-gaming" },
      { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide" },
      { label: "Upload speed explained", to: "/learn/upload-speed-explained" },
      { label: "Routers", to: "/routers" },
    ],
    cta: { title: "Can your address get gigabit?", text: "Check in seconds and see the exact price before you order.", to: "/broadband", button: "Check availability" },
  },
  {
    slug: "ultrafast-broadband",
    family: "broadband",
    metaTitle: "Ultrafast Broadband up to 550Mbps — Full Fibre | OCCTA",
    metaDescription:
      "OCCTA Ultrafast full fibre broadband up to 550Mbps where available, from {ultrafast}/mo on Price Lock 24 or Flex 30. Built for busy homes. Check your address.",
    keywords: "ultrafast broadband, ultrafast fibre broadband, 500Mb broadband, 550Mbps broadband, ultrafast broadband deals, fast broadband UK",
    breadcrumb: "Ultrafast broadband",
    kicker: "Up to 550Mbps",
    heroTitle: "Ultrafast broadband",
    heroHighlight: "up to 550Mbps",
    heroSubtitle: "Full fibre with room for the whole household: 4K streaming, gaming and video calls at the same time. {ultrafast}/mo on Price Lock 24 where available.",
    bands: ["ultrafast", "superfast", "gigabit"],
    intro:
      "“Ultrafast” is the industry term for broadband of 300Mbps and above. OCCTA's Ultrafast band runs at up to 550Mbps over full fibre, sitting between Superfast and Gigabit.",
    sections: [
      {
        heading: "Built for busy households",
        paragraphs: [
          "Ultrafast is the sweet spot for families and house shares where several people stream, game and work online at once. Big downloads finish quickly, and video calls stay steady while someone else is streaming in 4K.",
        ],
        bullets: [
          "Up to 550Mbps download where available",
          "Fast uploads over full fibre for backups and content creation",
          "Comfortable for 4–6 heavy users",
          "No line rental — Digital Voice home phone available from {landline}/mo",
        ],
      },
      {
        heading: "Ultrafast vs Superfast vs Gigabit",
        paragraphs: [
          "Superfast (up to 330Mbps, {superfast}/mo) covers most homes. Ultrafast ({ultrafast}/mo) adds headroom for heavier use. Gigabit ({gigabit}/mo) is for the very heaviest users. All prices are Price Lock 24; Flex 30 is priced separately where eligible.",
          "If you're unsure, our speed guide helps you match a band to the way your household actually uses the internet.",
        ],
      },
      { heading: "Terms and availability", paragraphs: [BB_TERMS, BB_CHECK] },
    ],
    faqs: [
      { question: "What counts as ultrafast broadband?", answer: "Ofcom defines ultrafast as 300Mbps or more. OCCTA's Ultrafast band is up to 550Mbps where available." },
      { question: "Is ultrafast broadband full fibre?", answer: "Speeds above 80Mbps generally need full fibre (FTTP) at the address. The checker confirms the technology your line uses." },
      { question: "How much is OCCTA ultrafast broadband?", answer: "{ultrafast}/mo on Price Lock 24, or {ultrafastFlex}/mo on Flex 30 where eligible." },
      { question: "Do I need a new router?", answer: "A router that supports the speed and modern Wi-Fi standards helps. OCCTA offers router options, or you can use your own compatible router." },
    ],
    related: [
      { label: "Gigabit broadband", to: "/gigabit-broadband" },
      { label: "Superfast broadband", to: "/superfast-broadband" },
      { label: "Full fibre broadband", to: "/full-fibre-broadband" },
      { label: "Broadband speed guide", to: "/learn/broadband-speed-guide" },
      { label: "Broadband for working from home", to: "/broadband-for-working-from-home" },
    ],
    cta: { title: "See what your line can take", text: "Address-specific speeds and prices in seconds.", to: "/broadband", button: "Check availability" },
  },
  {
    slug: "superfast-broadband",
    family: "broadband",
    metaTitle: "Superfast Broadband Deals up to 330Mbps | OCCTA",
    metaDescription:
      "OCCTA Superfast broadband up to 330Mbps where available, from {superfast}/mo on Price Lock 24 or Flex 30. Essential up to 80Mbps from {essential}. Check your address.",
    keywords: "superfast broadband, superfast fibre broadband, superfast broadband deals, cheap superfast broadband, 300Mb broadband, fibre broadband deals",
    breadcrumb: "Superfast broadband",
    kicker: "Up to 330Mbps",
    heroTitle: "Superfast broadband",
    heroHighlight: "for everyday homes",
    heroSubtitle: "Enough speed for streaming, working from home and video calls without the premium price. Superfast from {superfast}/mo, or Essential from {essential}/mo on Price Lock 24.",
    bands: ["essential", "superfast", "ultrafast"],
    intro:
      "Superfast broadband is officially anything over 30Mbps. OCCTA offers two bands in that range: Essential (up to 80Mbps) and Superfast (up to 330Mbps, over full fibre where available).",
    sections: [
      {
        heading: "Essential or Superfast?",
        paragraphs: [
          "Essential (up to 80Mbps, {essential}/mo) runs over fibre-to-the-cabinet and is widely available. It handles HD and 4K streaming, video calls and browsing for a small household.",
          "Superfast (up to 330Mbps, {superfast}/mo) uses full fibre where available. It gives a busier home much more headroom and far faster uploads.",
        ],
        bullets: [
          "1–2 people, light use: Essential is usually enough",
          "3–4 people, streaming and home working: Superfast",
          "Heavy gaming, 4K on several screens, big uploads: consider Ultrafast or Gigabit",
        ],
      },
      { heading: "Price certainty or a rolling plan", paragraphs: [BB_TERMS, "Essential is {essentialFlex}/mo and Superfast {superfastFlex}/mo on Flex 30 where eligible."] },
      { heading: "No line rental", paragraphs: ["OCCTA broadband doesn't need a separate phone line or line rental. If you want a home phone, Digital Voice runs over the broadband from {landline}/mo and you can usually keep your number.", BB_CHECK] },
    ],
    faqs: [
      { question: "What is superfast broadband?", answer: "In the UK, superfast broadband means download speeds of 30Mbps or more. OCCTA's Essential (up to 80Mbps) and Superfast (up to 330Mbps) bands are both in that range." },
      { question: "How much is OCCTA superfast broadband?", answer: "Essential is {essential}/mo and Superfast {superfast}/mo on Price Lock 24. Flex 30 prices are shown where eligible." },
      { question: "Is 80Mbps fast enough?", answer: "For one or two people streaming, browsing and making video calls, usually yes. Larger or heavier-use households benefit from a faster band." },
      { question: "Can I get superfast broadband on a 30-day plan?", answer: "Yes, where eligible. Flex 30 is 30-day rolling with no fixed minimum term and normally 30 days' notice." },
    ],
    related: [
      { label: "Ultrafast broadband", to: "/ultrafast-broadband" },
      { label: "Cheap broadband UK", to: "/guides/cheap-broadband-uk" },
      { label: "Fibre broadband", to: "/fibre-broadband" },
      { label: "No-contract broadband", to: "/no-contract-broadband-uk" },
      { label: "What speed do I need?", to: "/guides/what-broadband-speed-do-i-need" },
    ],
    cta: { title: "Check your address", text: "See your speed bands and exact prices.", to: "/broadband", button: "Check availability" },
  },
  {
    slug: "broadband-without-landline",
    family: "broadband",
    metaTitle: "Broadband Without a Landline — No Line Rental | OCCTA",
    metaDescription:
      "OCCTA broadband needs no landline and no line rental. Fibre and full fibre from {bb}/mo, Price Lock 24 or Flex 30. Add a Digital Voice home phone only if you want one.",
    keywords: "broadband without landline, broadband only, no line rental broadband, broadband without phone line, broadband no landline UK, internet without landline",
    breadcrumb: "Broadband without a landline",
    kicker: "No line rental",
    heroTitle: "Broadband without",
    heroHighlight: "a landline",
    heroSubtitle: "Pay for the internet, not a phone line you never use. OCCTA broadband runs without line rental from {bb}/mo — add a home phone only if you want one.",
    bands: ["essential", "superfast", "gigabit"],
    intro:
      "You no longer need to pay for a landline to get broadband. OCCTA broadband uses single-order fibre (SOGEA) or full fibre (FTTP), neither of which needs a traditional phone line or line rental.",
    sections: [
      {
        heading: "Why the landline is disappearing",
        paragraphs: [
          "The UK's old copper telephone network (the PSTN) is being retired, with the switch-off due by 31 January 2027. Broadband no longer has to be bundled with a phone line, and home phones move to digital services that run over the internet instead.",
          "With OCCTA you get broadband on its own. There's no line rental charge on your bill, and nothing to pay for a phone you don't use.",
        ],
        bullets: [
          "Broadband only: no line rental",
          "Essential up to 80Mbps from {essential}/mo; full fibre up to 1000Mbps where available",
          "Want a home phone? Digital Voice from {landline}/mo, and you can usually keep your existing number",
          "Mobile-only household? Pair with an OCCTA SIM from {sim}/mo",
        ],
      },
      {
        heading: "What about the socket on the wall?",
        paragraphs: [
          "Single-order fibre still uses the copper wire into your home, but only to carry broadband, so the router plugs into the same master socket. Full fibre uses an ONT box where the fibre enters the property. Either way, no phone service or line rental is needed.",
        ],
      },
      {
        heading: "Telecare and alarms",
        paragraphs: [
          "If anyone in the home uses a personal alarm, telecare device or a security alarm that dials out over the phone line, tell us before you order. These devices need to be checked for compatibility with digital services. Our telecare guide explains what to ask.",
        ],
      },
      { heading: "Terms and checking your address", paragraphs: [BB_TERMS, BB_CHECK] },
    ],
    faqs: [
      { question: "Can I get broadband without a landline?", answer: "Yes. OCCTA broadband needs no landline and no line rental. It runs over single-order fibre or full fibre." },
      { question: "Will I still need a phone socket?", answer: "Single-order fibre uses the existing master socket to carry broadband only. Full fibre uses a separate ONT box. Neither needs an active phone service." },
      { question: "Can I keep my landline number?", answer: "Usually, yes. Add Digital Voice from {landline}/mo and request a number port during your order. The number then works through your broadband." },
      { question: "Is broadband without a landline cheaper?", answer: "There's no line rental to pay. OCCTA broadband starts at {bb}/mo on Price Lock 24, with any setup or router charge shown before you accept." },
      { question: "What happens to my landline in 2027?", answer: "The old copper phone network is being switched off by 31 January 2027. Landline calls move to digital services such as Digital Voice." },
    ],
    related: [
      { label: "Digital Voice home phone", to: "/landline" },
      { label: "Landline switch-off 2027", to: "/learn/landline-switch-off-2027-uk" },
      { label: "Keep your landline number", to: "/learn/keep-landline-number-digital-switch" },
      { label: "Telecare and digital landlines", to: "/learn/telecare-personal-alarm-digital-landline" },
      { label: "Broadband and Digital Voice", to: "/broadband-and-digital-voice" },
      { label: "All broadband plans", to: "/broadband" },
    ],
    cta: { title: "Broadband only, from {bb}/mo", text: "Check your address and see the exact price.", to: "/broadband", button: "Check availability" },
  },
  {
    slug: "moving-house-broadband",
    family: "broadband",
    metaTitle: "Broadband for Moving House — New Home Deals | OCCTA",
    metaDescription:
      "Moving home? Order OCCTA broadband for your new address ahead of your move. Price Lock 24 or 30-day Flex 30, from {bb}/mo. Check the new address in seconds.",
    keywords: "moving house broadband, broadband for new home, broadband when moving house, new home broadband deals, moving home internet, broadband new build",
    breadcrumb: "Moving house broadband",
    kicker: "New address",
    heroTitle: "Moving house?",
    heroHighlight: "Sort broadband first",
    heroSubtitle: "Check what your new address can get, order before you move and choose a fixed price or a 30-day rolling plan. From {bb}/mo.",
    bands: ["essential", "superfast", "ultrafast", "gigabit"],
    intro:
      "Broadband is one of the easiest things to forget when you move. Ordering early means your new home is far more likely to be connected when you get the keys.",
    sections: [
      {
        heading: "How to get connected at your new home",
        paragraphs: ["The sooner you order, the more choice you have over the activation date. Here's the order of play:"],
        bullets: [
          "Check the new address in our availability checker; speeds there may be very different from your old home",
          "Order once you know your move date and choose an activation date on or after it",
          "If an engineer visit is needed, for example for full fibre, it is booked and shown in your order",
          "Plug in the router on moving day once the service is live",
        ],
      },
      {
        heading: "Renting or not sure how long you'll stay?",
        paragraphs: [
          "Flex 30 is OCCTA's 30-day rolling option where eligible. There's no fixed minimum term, so it suits renters, students and anyone who might move again soon. If you're settling in, Price Lock 24 gives price certainty for 24 months.",
          BB_TERMS,
        ],
      },
      {
        heading: "Leaving your old provider",
        paragraphs: [
          "If you're moving and leaving another provider, check their notice period and any early termination charges. One Touch Switch applies when switching provider at the same address. When you're moving home, you'll normally give notice to your old provider yourself. Our guides to leaving BT, Sky, TalkTalk and Virgin Media cover the details.",
        ],
      },
      { heading: "New-build homes", paragraphs: ["Many new builds come with full fibre installed by a developer's network partner. Enter the new address (or ask the developer for the postcode and plot address) to see what's available.", BB_CHECK] },
    ],
    faqs: [
      { question: "How early should I order broadband when moving?", answer: "As soon as you know your move date. Ordering early gives the most choice of activation date and time to book an engineer if one is needed." },
      { question: "Can I take OCCTA broadband with me when I move?", answer: "Existing customers can ask to move their service. Availability, speed and price at the new address are checked first. See our moving home help page." },
      { question: "Is there a short-term option for renters?", answer: "Yes, where eligible. Flex 30 is 30-day rolling with no fixed minimum term and normally 30 days' notice." },
      { question: "What if my new home has no broadband line?", answer: "The checker will show what's possible. Full fibre or new line installations may need an engineer visit, and any charge is shown before you accept." },
    ],
    related: [
      { label: "Moving home help", to: "/help/move-home" },
      { label: "Broadband for renters", to: "/guides/broadband-for-renters" },
      { label: "No-contract broadband", to: "/no-contract-broadband-uk" },
      { label: "How to switch broadband", to: "/guides/how-to-switch-broadband" },
      { label: "Broadband for students", to: "/broadband-for-students" },
    ],
    cta: { title: "Check your new address", text: "Speeds and prices for the home you're moving to.", to: "/broadband", button: "Check availability" },
  },

  /* ───────────────────────────────── SIM ───────────────────────────────── */
  {
    slug: "unlimited-data-sim",
    family: "sim",
    metaTitle: "Unlimited Data SIM Only Deals — O2, Vodafone, EE | OCCTA",
    metaDescription:
      "Unlimited data SIM only plans from OCCTA on O2, Vodafone and EE, with unlimited calls and texts. 30-day or 24-month, eSIM or physical SIM. See live prices.",
    keywords: "unlimited data SIM, unlimited data SIM only, unlimited SIM only deals, cheap unlimited data SIM, unlimited 5G SIM, unlimited data SIM no contract",
    breadcrumb: "Unlimited data SIM",
    kicker: "Unlimited data · calls · texts",
    heroTitle: "Unlimited data SIM",
    heroHighlight: "stop watching the meter",
    heroSubtitle: "Unlimited data with unlimited UK calls and texts on the O2, Vodafone or EE network. Rolling 30-day or 24-month plans, with eSIM available.",
    simFilter: { unlimitedOnly: true, categories: ["single_user", "promo_unlimited"] },
    intro:
      "An unlimited data SIM means you don't have to ration data for streaming, hotspotting or maps. OCCTA unlimited plans run on the UK's major networks, so you pick the coverage that works best where you live and work.",
    sections: [
      {
        heading: "Why go unlimited?",
        paragraphs: [
          "If you regularly use more than 50GB a month — streaming video, tethering a laptop, or using your phone instead of home broadband — unlimited often costs little more than a big data bundle, and you never hit a cap mid-month.",
        ],
        bullets: [
          "Unlimited UK data, calls and texts",
          "Choice of O2, Vodafone or EE network coverage",
          "30-day rolling or 24-month terms",
          "eSIM or physical SIM; keep your number with a PAC",
          "5G where your phone and the network support it",
        ],
      },
      {
        heading: "Rolling or 24-month?",
        paragraphs: [
          "30-day unlimited plans give you freedom to change or leave with notice. 24-month plans cost less each month in exchange for the minimum term. Promotional unlimited plans may have extra conditions, such as being for customers bringing their number, and these are shown on the plan.",
          SIM_TERMS,
        ],
      },
      {
        heading: "Fair usage",
        paragraphs: ["Unlimited plans are for normal personal use and are subject to the network's fair usage policy, which prevents things like running the SIM in a fixed router for a whole household. Full details are shown before you order."],
      },
    ],
    faqs: [
      { question: "Is OCCTA unlimited data really unlimited?", answer: "Yes, for normal personal use in the UK, subject to the network's fair usage policy, which is shown before you order." },
      { question: "Which networks are OCCTA unlimited SIMs on?", answer: "OCCTA offers unlimited plans on the O2, Vodafone and EE networks, so you can choose the coverage that's strongest where you are." },
      { question: "Can I get an unlimited data SIM on a 30-day plan?", answer: "Yes. 30-day rolling unlimited plans are available alongside lower-priced 24-month plans." },
      { question: "Can I keep my number?", answer: "Yes. Get a PAC code from your current provider (text PAC to 65075) and enter it at checkout." },
      { question: "How do I pay?", answer: "By Direct Debit or bank transfer. OCCTA doesn't take card payments." },
    ],
    related: [
      { label: "All SIM only plans", to: "/sim" },
      { label: "30-day SIM only", to: "/30-day-sim-only" },
      { label: "eSIM plans", to: "/esim" },
      { label: "Best SIM only deals UK", to: "/learn/best-sim-only-deals-uk" },
      { label: "Cheap SIM only deals guide", to: "/guides/cheap-sim-only-deals" },
    ],
    cta: { title: "Choose your unlimited plan", text: "Live prices on O2, Vodafone and EE.", to: "/sim", button: "See all SIM plans" },
  },
  {
    slug: "30-day-sim-only",
    family: "sim",
    metaTitle: "30-Day SIM Only Deals — Rolling, No Long Contract | OCCTA",
    metaDescription:
      "30-day rolling SIM only plans from OCCTA on O2, Vodafone and EE. 2GB to unlimited data, unlimited calls and texts, eSIM available. Change or leave with notice.",
    keywords: "30 day SIM only, 30 day SIM only deals, rolling SIM only, monthly SIM only, SIM only no contract, 1 month SIM only, cheap 30 day SIM",
    breadcrumb: "30-day SIM only",
    kicker: "Rolling monthly",
    heroTitle: "30-day SIM only",
    heroHighlight: "no long contract",
    heroSubtitle: "Rolling monthly SIM plans with unlimited calls and texts, from 2GB to unlimited data on O2, Vodafone or EE. Change plan or leave with notice.",
    simFilter: { term: "30_day", categories: ["single_user"] },
    intro:
      "A 30-day SIM only plan rolls month to month. You're not tied into a 12 or 24-month contract, so you can move up or down a data size, or leave, when your needs change.",
    sections: [
      {
        heading: "Who a rolling SIM suits",
        paragraphs: ["Rolling plans are ideal if you're not sure how much data you need, you're between phones, you're in the UK short term, or you just don't want to be locked in."],
        bullets: [
          "Data from 2GB up to unlimited",
          "Unlimited UK calls and texts on every plan",
          "O2, Vodafone or EE network",
          "eSIM or physical SIM",
          "Keep your existing number with a PAC code",
        ],
      },
      {
        heading: "30-day vs 24-month",
        paragraphs: [
          "Rolling plans cost a little more each month than the equivalent 24-month plan. The trade-off is flexibility. If you know you'll keep the plan for two years, the 24-month version is cheaper overall.",
          SIM_TERMS,
        ],
      },
      { heading: "Ordering and payment", paragraphs: ["Choose a plan, pick eSIM or a physical SIM, and add your PAC if you're keeping your number. Payment is by Direct Debit or bank transfer. OCCTA doesn't take card payments."] },
    ],
    faqs: [
      { question: "What is a 30-day SIM only plan?", answer: "A SIM-only plan that rolls monthly with no long minimum term. You can change or leave with notice, subject to any cease charge shown on the plan." },
      { question: "Are 30-day SIMs more expensive?", answer: "Slightly, compared with the same allowance on a 24-month term. You're paying for the flexibility." },
      { question: "Can I switch to a bigger data plan?", answer: "Yes. You can move to a different allowance, normally from your next billing date." },
      { question: "Can I use eSIM on a 30-day plan?", answer: "Yes, on compatible phones. Choose eSIM at checkout." },
    ],
    related: [
      { label: "All SIM only plans", to: "/sim" },
      { label: "Unlimited data SIM", to: "/unlimited-data-sim" },
      { label: "eSIM plans", to: "/esim" },
      { label: "Data-only SIM", to: "/data-only-sim" },
      { label: "eSIM vs physical SIM", to: "/learn/esim-vs-physical-sim" },
    ],
    cta: { title: "Pick a rolling plan", text: "See every 30-day plan with live prices.", to: "/sim", button: "See all SIM plans" },
  },
  {
    slug: "esim",
    family: "sim",
    metaTitle: "eSIM UK — eSIM Only Plans on O2, Vodafone & EE | OCCTA",
    metaDescription:
      "Get an OCCTA eSIM: no physical SIM card, no waiting for the post. eSIM plans on O2, Vodafone and EE, 30-day or 24-month, from 2GB to unlimited data.",
    keywords: "eSIM UK, eSIM plans UK, eSIM only deals, eSIM SIM only, digital SIM, eSIM provider UK, how to get an eSIM, eSIM iPhone UK",
    breadcrumb: "eSIM plans",
    kicker: "Digital SIM",
    heroTitle: "eSIM plans",
    heroHighlight: "no card, no post",
    heroSubtitle: "An eSIM is a digital SIM built into your phone. Choose a plan on O2, Vodafone or EE and get connected without waiting for a SIM card in the post.",
    simFilter: { esimOnly: true, categories: ["single_user", "promo_unlimited"] },
    intro:
      "Most recent iPhones, Google Pixels and Samsung Galaxy phones support eSIM. Instead of inserting a plastic card, you add your plan to the phone digitally.",
    sections: [
      {
        heading: "How eSIM works",
        paragraphs: ["When you choose eSIM at checkout, you'll receive the details to add the plan to your phone. On most phones that's a QR code scanned in Settings > Mobile/Cellular > Add eSIM."],
        bullets: [
          "No SIM card to post, lose or swap",
          "Run two numbers on one phone (eSIM plus a physical SIM, or two eSIMs on newer phones)",
          "Keep your existing number with a PAC code",
          "Same plans, networks and prices as physical SIMs",
        ],
      },
      {
        heading: "Is my phone eSIM compatible?",
        paragraphs: [
          "iPhone XS and newer, Google Pixel 3 and newer and most Samsung Galaxy S, Z and recent A-series phones support eSIM, but some models sold in certain regions or locked to a network don't. Check Settings for an “Add eSIM” option, or look up your exact model before ordering.",
          "If your phone doesn't support eSIM, choose a physical SIM. The plans are the same.",
        ],
      },
      { heading: "Plans and terms", paragraphs: [SIM_TERMS, "Payment is by Direct Debit or bank transfer. OCCTA doesn't take card payments."] },
    ],
    faqs: [
      { question: "What is an eSIM?", answer: "An embedded, digital SIM built into your phone. You download your mobile plan to it instead of inserting a physical SIM card." },
      { question: "Does OCCTA offer eSIM?", answer: "Yes. eSIM is available on OCCTA voice and data plans across O2, Vodafone and EE. Choose eSIM at checkout on a compatible phone." },
      { question: "Can I move my number to an eSIM?", answer: "Yes. Get a PAC code from your current provider and enter it at checkout. Your number moves across to the eSIM." },
      { question: "What if I change phones?", answer: "eSIMs can be transferred to a new compatible phone. Contact OCCTA support if you need a new eSIM profile." },
      { question: "Are eSIM plans more expensive?", answer: "No. eSIM and physical SIM versions of a plan cost the same." },
    ],
    related: [
      { label: "eSIM vs physical SIM", to: "/learn/esim-vs-physical-sim" },
      { label: "All SIM only plans", to: "/sim" },
      { label: "30-day SIM only", to: "/30-day-sim-only" },
      { label: "Unlimited data SIM", to: "/unlimited-data-sim" },
      { label: "Wi-Fi calling explained", to: "/learn/wifi-calling-explained" },
    ],
    cta: { title: "Get connected digitally", text: "Choose any eSIM-ready plan.", to: "/sim", button: "See all SIM plans" },
  },
  {
    slug: "data-only-sim",
    family: "sim",
    metaTitle: "Data-Only SIM & Mobile Broadband SIM Deals | OCCTA",
    metaDescription:
      "Data-only SIMs from OCCTA for tablets, laptops, 4G/5G routers and dongles. O2 and Vodafone networks, 1GB to unlimited data, 30-day or 24-month plans.",
    keywords: "data only SIM, data SIM, mobile broadband SIM, data SIM for tablet, data SIM for router, 4G router SIM, mobile broadband deals, unlimited data only SIM",
    breadcrumb: "Data-only SIM",
    kicker: "Mobile broadband",
    heroTitle: "Data-only SIM",
    heroHighlight: "for tablets & routers",
    heroSubtitle: "Mobile broadband SIMs with data only — no calls or texts — for tablets, laptops, dongles and 4G/5G routers. O2 or Vodafone network, 1GB to unlimited.",
    simFilter: { categories: ["mobile_broadband"] },
    intro:
      "A data-only SIM gives a device internet access over the mobile network without a phone number or call allowance. It's how tablets, laptops with SIM slots, portable Wi-Fi hotspots and mobile broadband routers get online.",
    sections: [
      {
        heading: "Common uses",
        paragraphs: ["Data-only SIMs are popular as a backup connection, for travel and holiday lets, and for anywhere a fixed line isn't practical."],
        bullets: [
          "iPads and Android tablets with a SIM slot",
          "Laptops with built-in mobile broadband",
          "Portable 4G/5G Wi-Fi hotspots (MiFi)",
          "Home or van routers for occasional use",
          "Backup internet if your fixed broadband goes down",
        ],
      },
      {
        heading: "Choosing a data allowance",
        paragraphs: [
          "Light browsing and email on a tablet: 1–5GB. Regular streaming or work on a laptop: 25–50GB. Using it as a main internet connection: unlimited, where offered and within fair usage. Plans are on the O2 or Vodafone network.",
          SIM_TERMS,
        ],
      },
      {
        heading: "Mobile broadband vs home broadband",
        paragraphs: ["If you need a permanent connection for a whole household, fixed broadband is usually faster, more consistent and better value. A data SIM is best for portability, backup or as a stop-gap while you wait for a line. OCCTA offers both."],
      },
    ],
    faqs: [
      { question: "What is a data-only SIM?", answer: "A SIM card with a mobile data allowance but no calls or texts, for devices such as tablets, laptops and mobile broadband routers." },
      { question: "Can I put a data SIM in a 4G or 5G router?", answer: "Yes, as long as the router is unlocked and supports the network's frequencies. Fair usage applies, particularly on unlimited plans." },
      { question: "Is eSIM available on data-only plans?", answer: "Data-only plans are supplied as physical SIMs." },
      { question: "Which networks are available?", answer: "OCCTA data-only plans run on the O2 and Vodafone networks." },
    ],
    related: [
      { label: "All SIM only plans", to: "/sim" },
      { label: "Business broadband backup guide", to: "/learn/business-broadband-backup-guide" },
      { label: "Broadband plans", to: "/broadband" },
      { label: "Unlimited data SIM", to: "/unlimited-data-sim" },
    ],
    cta: { title: "Choose a data SIM", text: "Live data-only plans and prices.", to: "/sim", button: "See all SIM plans" },
  },
  ...(["O2", "Vodafone", "EE"] as const).map<ProductLanding>((network) => {
    const slug = `${network.toLowerCase()}-sim-only-deals`;
    const others = (["O2", "Vodafone", "EE"] as const).filter((n) => n !== network);
    return {
      slug,
      family: "sim",
      metaTitle: `SIM Only Deals on the ${network} Network | OCCTA`,
      metaDescription: `OCCTA SIM only plans on the ${network} network: 2GB to unlimited data, unlimited calls and texts, 30-day or 24-month, eSIM available. Keep your number with a PAC.`,
      keywords: `${network} SIM only deals, ${network} network SIM, SIM only on ${network}, cheap ${network} SIM, ${network} coverage SIM only, ${network} eSIM`,
      breadcrumb: `${network} network SIM only`,
      kicker: `${network} network coverage`,
      heroTitle: `SIM only on ${network}`,
      heroHighlight: "OCCTA plans, clear terms",
      heroSubtitle: `Get the coverage of the ${network} network on an OCCTA plan: unlimited calls and texts, data from 2GB to unlimited, rolling or 24-month.`,
      simFilter: { networks: [network], categories: ["single_user", "promo_unlimited"] },
      intro: `OCCTA plans can use the ${network} network, so you get ${network}'s mast coverage with OCCTA's pricing, billing and UK-based support. Pick ${network} if it's the strongest signal where you live, work and travel.`,
      sections: [
        {
          heading: `Why choose ${network} coverage?`,
          paragraphs: [
            `Coverage varies street by street. If ${network} gives the best signal at home and work, choosing an OCCTA plan on ${network} means you keep that coverage. Check ${network}'s and Ofcom's coverage checkers for your postcodes before you order.`,
            `Not sure? OCCTA also offers plans on ${others.join(" and ")}, so you can compare all three networks in one place.`,
          ],
          bullets: [
            "Unlimited UK calls and texts on voice plans",
            "Data from 2GB to unlimited",
            "30-day rolling or 24-month terms",
            "eSIM or physical SIM; keep your number with a PAC",
            "5G where your phone and the network support it",
          ],
        },
        {
          heading: "Is this the same as joining " + network + "?",
          paragraphs: [
            `No. OCCTA is the provider. Your contract, bill and customer service are with OCCTA, while calls and data are carried on the ${network} network. ${network} is a trademark of its owner; OCCTA is not ${network}.`,
            SIM_TERMS,
          ],
        },
        { heading: "Ordering", paragraphs: ["Choose a plan, pick eSIM or a physical SIM and add your PAC code if you're keeping your number. Payment is by Direct Debit or bank transfer. OCCTA doesn't take card payments."] },
      ],
      faqs: [
        { question: `Do OCCTA SIMs use the ${network} network?`, answer: `Yes. The plans on this page use the ${network} network. OCCTA also offers plans on ${others.join(" and ")}.` },
        { question: "Is OCCTA part of " + network + "?", answer: `No. OCCTA is an independent UK provider. Your plan uses ${network}'s network coverage, but your contract and support are with OCCTA.` },
        { question: "Can I keep my number?", answer: "Yes. Request a PAC from your current provider (text PAC to 65075) and enter it at checkout." },
        { question: "Is eSIM available?", answer: `Yes, on ${network} voice and data plans with a compatible phone.` },
      ],
      related: [
        ...others.map((n) => ({ label: `SIM only on ${n}`, to: `/${n.toLowerCase()}-sim-only-deals` })),
        { label: "All SIM only plans", to: "/sim" },
        { label: "Unlimited data SIM", to: "/unlimited-data-sim" },
        { label: "30-day SIM only", to: "/30-day-sim-only" },
      ],
      cta: { title: `See every ${network} plan`, text: "Filter by network, data and term.", to: "/sim", button: "See all SIM plans" },
    };
  }),

  /* ─────────────────────────────── Business ─────────────────────────────── */
  {
    slug: "business/leased-lines",
    family: "business",
    metaTitle: "Leased Lines for Business — Dedicated Symmetric | OCCTA",
    metaDescription:
      "Dedicated business leased lines from OCCTA: symmetric bandwidth, an agreed service level and multi-site design. Priced by site survey — request a quote.",
    keywords: "leased line, business leased line, leased line quote, dedicated internet access, symmetric business broadband, ethernet leased line UK, leased line cost",
    breadcrumb: "Leased lines",
    kicker: "Dedicated connectivity",
    heroTitle: "Business leased lines",
    heroHighlight: "dedicated, symmetric",
    heroSubtitle: "An uncontended fibre connection reserved for your business, with matching upload and download speeds and a service level confirmed in writing.",
    businessProducts: ["biz-leased-line", "biz-fttp-1000", "biz-fttp-550"],
    intro:
      "A leased line is a private, dedicated fibre connection between your premises and the network. Unlike business broadband, the bandwidth isn't shared with other customers, and uploads are as fast as downloads.",
    sections: [
      {
        heading: "When a leased line makes sense",
        paragraphs: ["Leased lines suit businesses where the internet connection is critical: busy offices, cloud-first teams, sites hosting servers or VoIP for many users, and multi-site organisations."],
        bullets: [
          "Symmetric bandwidth: the same speed up and down",
          "Uncontended: the capacity is yours, even at peak times",
          "Service level agreed in writing",
          "Static IP addresses and multi-site design available",
        ],
      },
      {
        heading: "Leased line or business full fibre?",
        paragraphs: [
          "OCCTA business full fibre (up to 1000Mbps) is a strong, lower-cost option for many small and medium businesses. A leased line costs more because the capacity is dedicated and the service level is stronger. We'll tell you honestly which fits your site.",
        ],
      },
      {
        heading: "How pricing works",
        paragraphs: [
          "Leased line pricing depends on the exact site, the carrier survey and the service level. Any excess construction charges are identified and agreed before you order, so there are no surprises. Request a quote with your address and requirements.",
        ],
      },
    ],
    faqs: [
      { question: "What is a leased line?", answer: "A dedicated, uncontended fibre connection for one business, with symmetric upload and download speeds and an agreed service level." },
      { question: "How much does a leased line cost?", answer: "It depends on the site, the carrier survey and the service level. OCCTA quotes after checking the address, and any construction charges are agreed before you order." },
      { question: "How long does a leased line take to install?", answer: "Lead times depend on the survey and any construction needed. The quote sets out the expected timeline." },
      { question: "Is business full fibre an alternative?", answer: "Often, yes. OCCTA business full fibre up to 1000Mbps suits many smaller businesses at lower cost, without the dedicated capacity of a leased line." },
    ],
    related: [
      { label: "Business broadband", to: "/business/broadband" },
      { label: "Business VoIP", to: "/business/voice" },
      { label: "SIP trunks", to: "/business/sip-trunks" },
      { label: "Static IP explained", to: "/learn/static-ip-address-explained" },
      { label: "Business broadband backup", to: "/learn/business-broadband-backup-guide" },
      { label: "Get a business quote", to: "/business/quote" },
    ],
    cta: { title: "Get a leased line quote", text: "Tell us the address and what you need.", to: "/business/quote", button: "Request a quote" },
  },
  {
    slug: "business/sip-trunks",
    family: "business",
    metaTitle: "SIP Trunks for Business — Keep Your PBX | OCCTA",
    metaDescription:
      "OCCTA SIP trunks from {sip}/trunk/month ex VAT. Connect your existing PBX to the internet, keep your numbers and replace ISDN before the switch-off.",
    keywords: "SIP trunk, SIP trunking UK, SIP trunk provider, business SIP, ISDN replacement, SIP channels, PBX SIP trunk, cheap SIP trunk",
    breadcrumb: "SIP trunks",
    kicker: "From {sip}/trunk ex VAT",
    heroTitle: "SIP trunks",
    heroHighlight: "keep your phone system",
    heroSubtitle: "Connect your existing PBX to the internet, keep your business numbers and replace ISDN lines before the switch-off. From {sip} per trunk per month ex VAT.",
    businessProducts: ["biz-sip-trunk", "biz-voip-seat"],
    intro:
      "A SIP trunk is a virtual phone line that connects an on-site phone system (PBX) to the telephone network over your internet connection. It replaces ISDN and analogue lines, which are being retired.",
    sections: [
      {
        heading: "Why SIP trunks?",
        paragraphs: ["If you've invested in a PBX that works well, SIP trunks let you keep it while moving calls onto modern, internet-based lines."],
        bullets: [
          "Keep your existing PBX and handsets",
          "Port your existing business numbers",
          "Pay-as-you-go calls or 2000-minute bundles",
          "TLS encryption on alternate ports; enhanced SIP add-on available",
          "UK-based support",
        ],
      },
      {
        heading: "SIP trunks or hosted VoIP?",
        paragraphs: [
          "If your PBX is ageing or you want to stop maintaining hardware, hosted VoIP may suit you better: the phone system lives in the cloud and costs from {voip} per seat per month ex VAT. Our business team can compare both for your setup.",
        ],
      },
      {
        heading: "What you'll need",
        paragraphs: ["A SIP-compatible PBX (or an adaptor), and a reliable business internet connection with enough upload capacity for your concurrent calls. OCCTA business broadband and leased lines are built for this."],
      },
    ],
    faqs: [
      { question: "What is a SIP trunk?", answer: "A virtual phone line that connects your phone system to the telephone network over the internet, replacing ISDN or analogue lines." },
      { question: "How much is an OCCTA SIP trunk?", answer: "From {sip} per trunk per month excluding VAT, with pay-as-you-go calls or minute bundles." },
      { question: "Can I keep my business numbers?", answer: "Yes. Existing numbers can usually be ported to OCCTA SIP trunks." },
      { question: "How many SIP trunks do I need?", answer: "One per simultaneous call you want to support. We'll help size it from your current line count and call patterns." },
    ],
    related: [
      { label: "Hosted VoIP phone system", to: "/business/voice" },
      { label: "Leased lines", to: "/business/leased-lines" },
      { label: "Business broadband", to: "/business/broadband" },
      { label: "PSTN switch-off guide", to: "/guides/pstn-switch-off-uk" },
      { label: "Get a business quote", to: "/business/quote" },
    ],
    cta: { title: "Talk to our business team", text: "We'll size SIP trunks or VoIP for your setup.", to: "/business/quote", button: "Request a quote" },
  },
];

export const getProductLandingBySlug = (slug: string): ProductLanding | undefined =>
  productLandings.find((page) => page.slug === slug);
