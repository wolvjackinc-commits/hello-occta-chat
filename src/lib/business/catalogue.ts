// Business pricing catalogue (VAT-EXCLUDED).
// Residential prices in the wholesale/retail engine already include VAT for
// residential customers. Business customers see the ex-VAT price with an
// explicit "+ VAT" label per project memory.

export type BusinessProduct = {
  id: string;
  name: string;
  speed?: string;
  priceExVat: number;
  unit: string; // "/mo", "/seat/mo", "/trunk/mo"
  summary: string;
  features: string[];
  category: "broadband" | "voice" | "sim" | "bundle" | "addon";
};

export const businessBroadband: BusinessProduct[] = [
  {
    id: "biz-sogea-80",
    name: "Business SoGEA 80",
    speed: "80 Mbps",
    priceExVat: 22.5,
    unit: "/mo",
    summary: "Reliable copper-fibre for small offices, cafés and salons.",
    features: ["Unlimited data", "UK static IP available", "Next-day fault fix target", "4G failover ready"],
    category: "broadband",
  },
  {
    id: "biz-fttp-150",
    name: "Business Fibre 150",
    speed: "150 Mbps",
    priceExVat: 27.5,
    unit: "/mo",
    summary: "Full-fibre for growing teams and cloud-first offices.",
    features: ["Unlimited data", "WiFi 6 router", "Priority business support", "Static IP included"],
    category: "broadband",
  },
  {
    id: "biz-fttp-500",
    name: "Business Fibre 500",
    speed: "500 Mbps",
    priceExVat: 34.99,
    unit: "/mo",
    summary: "For busy teams on video, cloud apps and file transfers.",
    features: ["Unlimited data", "Static IP", "4-hour fix target", "Guest WiFi portal"],
    category: "broadband",
  },
  {
    id: "biz-fttp-900",
    name: "Business Fibre 900",
    speed: "900 Mbps",
    priceExVat: 49.99,
    unit: "/mo",
    summary: "Studios, agencies and high-traffic sites.",
    features: ["Unlimited data", "Pro router + mesh", "Managed security", "4-hour fix target"],
    category: "broadband",
  },
  {
    id: "biz-leased-lite",
    name: "Leased Line Lite",
    speed: "100–1000 Mbps symmetric",
    priceExVat: 248,
    unit: "/mo",
    summary: "Dedicated bandwidth with an uptime SLA.",
    features: ["Symmetric speeds", "99.9% uptime SLA", "Dedicated account manager", "Install quoted per site"],
    category: "broadband",
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
  },
  {
    id: "biz-sim-pro",
    name: "Business SIM Pro",
    priceExVat: 12.5,
    unit: "/line/mo",
    summary: "100GB pooled, EU roaming included.",
    features: ["100GB data (pooled)", "EU roaming included", "5G where available", "Consolidated invoicing"],
    category: "sim",
  },
  {
    id: "biz-sim-unlimited",
    name: "Business SIM Unlimited",
    priceExVat: 18.5,
    unit: "/line/mo",
    summary: "Unlimited data for field teams and heavy users.",
    features: ["Unlimited 5G data", "EU roaming included", "Priority support", "Volume discounts on 5+ lines"],
    category: "sim",
  },
];

export type BusinessBundle = {
  id: string;
  name: string;
  tagline: string;
  priceExVat: number;
  bestFor: string;
  includes: string[];
  cta?: string;
};

export const businessBundles: BusinessBundle[] = [
  {
    id: "startup",
    name: "Startup",
    tagline: "Everything a new office needs on day one.",
    priceExVat: 39,
    bestFor: "1–5 seats. Cafés, salons, new offices.",
    includes: [
      "Business SoGEA 80 broadband",
      "1 × Hosted VoIP seat",
      "1 × Business SIM Lite",
      "WiFi 6 router",
      "UK support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Room to scale without switching provider.",
    priceExVat: 79,
    bestFor: "5–15 seats. Growing teams on cloud tools.",
    includes: [
      "Business Fibre 500 broadband",
      "5 × Hosted VoIP seats",
      "3 × Business SIM Pro (100GB pooled)",
      "Static IP",
      "Priority 4-hour fix target",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For studios, agencies and multi-site brands.",
    priceExVat: 169,
    bestFor: "15+ seats or multi-site.",
    includes: [
      "Business Fibre 900 broadband",
      "10 × Hosted VoIP seats",
      "5 × Business SIM Unlimited",
      "4G/5G failover",
      "Dedicated account manager",
    ],
    cta: "Talk to sales",
  },
];

export const businessIndustries = {
  cafes: {
    slug: "cafes",
    name: "Cafés & Restaurants",
    hero: "Fast till broadband, guest WiFi and a landline that works.",
    pain: "Card machines dropping, guest WiFi congestion, phone orders you can't hear.",
    solution: [
      "Business SoGEA 80 or Fibre 150 with 4G failover",
      "Guest WiFi portal with time limits",
      "Hosted VoIP so phone orders never miss a beat",
    ],
    bundle: "startup",
  },
  salons: {
    slug: "salons",
    name: "Salons & Barbers",
    hero: "Booking apps, music streaming and card payments — always on.",
    pain: "Booking software freezes, chip-and-PIN times out, WiFi kicks off clients.",
    solution: [
      "Fibre 150 with priority support",
      "Guest WiFi with client login",
      "Optional business SIM for on-the-go booking",
    ],
    bundle: "startup",
  },
  offices: {
    slug: "offices",
    name: "Small Offices",
    hero: "Cloud apps, Teams calls and secure WiFi for the whole team.",
    pain: "Video calls glitching, staff phones scattered, no failover if the line drops.",
    solution: [
      "Business Fibre 500 with static IP",
      "Hosted VoIP for the whole team",
      "4G/5G failover for zero downtime",
    ],
    bundle: "growth",
  },
  studios: {
    slug: "studios",
    name: "Studios & Agencies",
    hero: "Big file transfers, remote collaboration, symmetrical upload.",
    pain: "Uploads take hours, clients can't preview files, VPN drops mid-call.",
    solution: [
      "Business Fibre 900 or Leased Line Lite",
      "Symmetrical bandwidth and static IPs",
      "Managed WiFi across the studio",
    ],
    bundle: "scale",
  },
  retail: {
    slug: "retail",
    name: "Multi-site Retail",
    hero: "One partner for every site. One monthly bill.",
    pain: "Every branch on a different contract, chasing outages, no consolidated billing.",
    solution: [
      "Consistent Business Fibre + failover per site",
      "Pooled Business SIMs for staff",
      "Consolidated invoicing and one account manager",
    ],
    bundle: "scale",
  },
} as const;

export type BusinessIndustrySlug = keyof typeof businessIndustries;

export const businessFAQs = [
  {
    q: "Do business prices include VAT?",
    a: "No — all business prices on OCCTA are shown ex-VAT and clearly labelled. Standard UK VAT (20%) is added on invoice, in line with HMRC B2B invoicing conventions.",
  },
  {
    q: "Do you offer static IP addresses?",
    a: "Yes. Static IPs are included on Business Fibre 150 and above, and available as an add-on for Business SoGEA 80.",
  },
  {
    q: "What's your fault fix target?",
    a: "Next-business-day on Business SoGEA 80 and 4-hour fix target on Business Fibre 500 and above.",
  },
  {
    q: "Can I have multiple sites on one account?",
    a: "Yes. Multi-site accounts get consolidated monthly invoicing and a named account manager on Growth and Scale bundles.",
  },
  {
    q: "How does 4G/5G failover work?",
    a: "A backup SIM in your router automatically takes over if the fixed line drops, so your card machines, phones and cloud apps keep working.",
  },
  {
    q: "Can I port my existing numbers?",
    a: "Yes — we port UK geographic and non-geographic numbers to Hosted VoIP or SIP Trunks with no downtime.",
  },
];