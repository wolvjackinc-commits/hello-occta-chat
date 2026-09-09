// Business catalogue (VAT-EXCLUDED customer display).
// Broadband retail anchors are deliberately kept above the current Giacom v4.0
// wholesale ranges and are only marketing "from" prices. Final product, term,
// setup, care level and any network charges are confirmed against the server-side
// supplier catalogue before a contract can be accepted.

export type BusinessProduct = {
  id: string;
  name: string;
  speed?: string;
  priceExVat?: number;
  unit: string; // "/mo", "/seat/mo", "/trunk/mo"
  summary: string;
  features: string[];
  category: "broadband" | "voice" | "sim" | "bundle" | "addon";
  pricingMode?: "from" | "quote";
  quoteReason?: string;
};

export const businessBroadband: BusinessProduct[] = [
  {
    id: "biz-sogea-80",
    name: "Business Essential 80",
    speed: "Up to 80 Mbps down / 20 Mbps up",
    priceExVat: 34.99,
    unit: "/mo",
    summary: "A dependable business connection for smaller sites and locations without higher-speed full fibre.",
    features: [
      "Standard network care included",
      "Enhanced care options available",
      "Static IP available on compatible routes",
      "4G/5G continuity option available by quote",
    ],
    category: "broadband",
    pricingMode: "from",
  },
  {
    id: "biz-fttp-160",
    name: "Business Fibre 160",
    speed: "Up to 160 Mbps down / 30 Mbps up",
    priceExVat: 39.99,
    unit: "/mo",
    summary: "Full fibre for cloud tools, video calls and growing teams.",
    features: [
      "Full fibre where available",
      "Standard network care included",
      "Wi-Fi 6 router options",
      "Static IP and enhanced care available",
    ],
    category: "broadband",
    pricingMode: "from",
  },
  {
    id: "biz-fttp-330",
    name: "Business Fibre 330",
    speed: "Up to 330 Mbps down / 50 Mbps up",
    priceExVat: 42.99,
    unit: "/mo",
    summary: "A strong default for busy offices using video, cloud apps and shared files.",
    features: [
      "Full fibre where available",
      "Standard network care included",
      "Router and static IP options",
      "Care upgrade priced to the selected network",
    ],
    category: "broadband",
    pricingMode: "from",
  },
  {
    id: "biz-fttp-550",
    name: "Business Fibre 550",
    speed: "Up to 550 Mbps down / 75 Mbps up",
    priceExVat: 49.99,
    unit: "/mo",
    summary: "For heavier cloud workloads, larger file transfers and high device counts.",
    features: [
      "Full fibre where available",
      "Standard network care included",
      "Enhanced care and static IP options",
      "Business Wi-Fi options quoted to suit the site",
    ],
    category: "broadband",
    pricingMode: "from",
  },
  {
    id: "biz-fttp-1000",
    name: "Business Gigabit",
    speed: "Up to 1000 Mbps",
    priceExVat: 59.99,
    unit: "/mo",
    summary: "High-capacity full fibre for demanding sites and larger teams.",
    features: [
      "Gigabit full fibre where available",
      "Upload speed confirmed for the selected network",
      "Enhanced care and static IP options",
      "Multi-site and continuity options available",
    ],
    category: "broadband",
    pricingMode: "from",
  },
  {
    id: "biz-leased-line",
    name: "Dedicated Leased Line",
    speed: "Dedicated symmetric options",
    unit: "/mo",
    summary: "Dedicated connectivity for sites that need committed bandwidth or bespoke service levels.",
    features: [
      "Symmetric bandwidth options",
      "Service level confirmed in writing",
      "Survey and excess construction charges checked before order",
      "Multi-site design available",
    ],
    category: "broadband",
    pricingMode: "quote",
    quoteReason: "Leased-line pricing depends on the exact site, carrier survey and service level.",
  },
];

export const businessVoice: BusinessProduct[] = [
  {
    id: "biz-voip-seat",
    name: "Hosted VoIP Seat",
    priceExVat: 6.95,
    unit: "/seat/mo",
    summary: "Softphone + desk phone ready. UK numbers included.",
    features: [
      "UK geographic or non-geo number",
      "Auto attendant, call queues, hunt groups",
      "Softphone apps (iOS/Android/desktop)",
      "Call recording available",
    ],
    category: "voice",
    pricingMode: "from",
  },
  {
    id: "biz-sip-trunk",
    name: "SIP Trunk",
    priceExVat: 5.95,
    unit: "/trunk/mo",
    summary: "Bring your own PBX. PAYG or bundled minutes.",
    features: [
      "PAYG or 2000-minute bundles",
      "Enhanced SIP add-on available",
      "TLS on alternate ports",
      "UK-based support",
    ],
    category: "voice",
    pricingMode: "from",
  },
];

export const businessSim: BusinessProduct[] = [
  {
    id: "biz-sim-lite",
    name: "Business SIM Lite",
    priceExVat: 7.5,
    unit: "/line/mo",
    summary: "20GB pooled, UK calls & texts.",
    features: ["20GB data (pooled across lines)", "Unlimited UK mins & texts", "5G where available", "Single monthly bill"],
    category: "sim",
    pricingMode: "from",
  },
  {
    id: "biz-sim-pro",
    name: "Business SIM Pro",
    priceExVat: 12.5,
    unit: "/line/mo",
    summary: "100GB pooled, EU roaming included.",
    features: ["100GB data (pooled)", "EU roaming included", "5G where available", "Consolidated invoicing"],
    category: "sim",
    pricingMode: "from",
  },
  {
    id: "biz-sim-unlimited",
    name: "Business SIM Unlimited",
    priceExVat: 18.5,
    unit: "/line/mo",
    summary: "Unlimited data for field teams and heavy users.",
    features: ["Unlimited 5G data", "EU roaming included", "Priority support", "Volume discounts on 5+ lines"],
    category: "sim",
    pricingMode: "from",
  },
];

export type BusinessBundle = {
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  includes: string[];
  cta?: string;
  priceExVat?: number;
  pricingMode: "from" | "quote";
};

// Broadband + voice + SIM bundles stay quote-led until every underlying service
// has been supplier-costed for the exact customer configuration. This prevents
// a visually attractive bundle from silently selling below wholesale cost.
export const businessBundles: BusinessBundle[] = [
  {
    id: "startup",
    name: "Startup",
    tagline: "A clean first-site setup with one provider and one bill.",
    bestFor: "1–5 seats. Cafés, salons and small offices.",
    pricingMode: "quote",
    includes: [
      "Business broadband matched to the site",
      "1 × Hosted VoIP seat",
      "1 × Business SIM option",
      "Router option matched to the selected network",
      "UK business support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "More bandwidth, more users and optional resilience.",
    bestFor: "5–15 seats. Growing teams on cloud tools.",
    pricingMode: "quote",
    includes: [
      "Business full fibre where available",
      "5 × Hosted VoIP seats",
      "3 × Business SIM options",
      "Static IP option",
      "Enhanced care option",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "A designed solution for larger or multi-site estates.",
    bestFor: "15+ seats or multi-site.",
    pricingMode: "quote",
    includes: [
      "Gigabit broadband or dedicated connectivity options",
      "10 × Hosted VoIP seats",
      "5 × Business SIM options",
      "4G/5G continuity option",
      "Consolidated account and billing design",
    ],
    cta: "Build my quote",
  },
];

export const businessIndustries = {
  cafes: {
    slug: "cafes",
    name: "Cafés & Restaurants",
    hero: "Connectivity for tills, bookings, guest Wi-Fi and phone orders.",
    pain: "Card terminals, booking systems and guest traffic all compete for the same connection.",
    solution: [
      "Business Essential 80 or full fibre according to site availability",
      "Business Wi-Fi and continuity options sized to the premises",
      "Hosted VoIP for customer calls and reservations",
    ],
    bundle: "startup",
  },
  salons: {
    slug: "salons",
    name: "Salons & Barbers",
    hero: "Keep booking apps, music, phones and card payments connected.",
    pain: "A weak connection can affect booking software, payments and client Wi-Fi at the same time.",
    solution: [
      "Business Fibre 160 or the best available site option",
      "Enhanced care where faster restoration matters",
      "Optional business SIM and continuity options",
    ],
    bundle: "startup",
  },
  offices: {
    slug: "offices",
    name: "Small Offices",
    hero: "Cloud apps, video calls and business Wi-Fi on one managed account.",
    pain: "Video calls, shared files and many connected devices expose weak or under-sized broadband quickly.",
    solution: [
      "Business Fibre 330 or 550 where available",
      "Hosted VoIP for the team",
      "Static IP and 4G/5G continuity options where required",
    ],
    bundle: "growth",
  },
  studios: {
    slug: "studios",
    name: "Studios & Agencies",
    hero: "Higher-capacity connectivity for big files and remote collaboration.",
    pain: "Large uploads, cloud sync and real-time collaboration need more than headline download speed.",
    solution: [
      "Business Fibre 550, Gigabit or a dedicated leased line",
      "Upload performance confirmed for the exact network route",
      "Business Wi-Fi design and static IP options",
    ],
    bundle: "scale",
  },
  retail: {
    slug: "retail",
    name: "Multi-site Retail",
    hero: "One commercial view across multiple sites and services.",
    pain: "Different contracts and renewal dates make multi-site telecom harder to control and support.",
    solution: [
      "A site-by-site broadband and continuity design",
      "Pooled Business SIM options for teams",
      "Consolidated billing and central service visibility",
    ],
    bundle: "scale",
  },
} as const;

export type BusinessIndustrySlug = keyof typeof businessIndustries;

export const businessFAQs = [
  {
    q: "Do business prices include VAT?",
    a: "Business pricing is shown primarily ex-VAT, with the inc-VAT equivalent alongside it. Your quote and Contract Summary show the full VAT breakdown before you accept anything.",
  },
  {
    q: "Do you offer static IP addresses?",
    a: "Yes, where the selected network and product support them. We show any static-IP charge in your quote rather than pretending it is included on every route.",
  },
  {
    q: "What's your fault fix target?",
    a: "It depends on the network and care level selected. Standard care is included on normal broadband routes, with enhanced or premium care available on many products. The exact restoration target and price are confirmed in writing before order.",
  },
  {
    q: "Can I have multiple sites on one account?",
    a: "Yes. We can quote site-by-site connectivity and consolidate account visibility and billing where the services support it.",
  },
  {
    q: "How does 4G/5G failover work?",
    a: "Where selected, a compatible router can use a mobile connection as a continuity path if the fixed connection is unavailable. Coverage, equipment and data plan are checked for the site and quoted separately.",
  },
  {
    q: "Can I port my existing numbers?",
    a: "Usually, subject to number eligibility and the losing provider's records. We confirm the port before promising a date and plan the change to minimise disruption.",
  },
];