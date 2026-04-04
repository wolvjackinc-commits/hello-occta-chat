import { getFromPrices } from './pricing/engine';
import { voiceProducts } from './pricing/catalogue';

export type BusinessPlan = {
  id: string;
  name: string;
  speed: string;
  price: string;
  priceValue: number;
  summary: string;
  inclusions: string[];
};

export type BusinessService = {
  id: string;
  title: string;
  price: string;
  typical: string;
  details: string[];
};

const prices = getFromPrices();
const bizVoipPayg = voiceProducts.find(v => v.id === 'biz-voip-payg');
const sipTrunkPayg = voiceProducts.find(v => v.id === 'sip-trunk-payg');

export const businessPlans: BusinessPlan[] = [
  {
    id: "startup-fibre",
    name: "Startup Fibre",
    speed: "150 Mbps",
    price: "£24",
    priceValue: 24,
    summary: "Best for cafés, salons, and new offices (1-5 seats).",
    inclusions: ["Unlimited data", "WiFi 6 router", "4G failover ready", "Next-day install"],
  },
  {
    id: "growth-fibre",
    name: "Growth Fibre",
    speed: "500 Mbps",
    price: "£34",
    priceValue: 34,
    summary: "For busy teams on cloud tools, video, and CRM.",
    inclusions: ["Unlimited data", "Static IP", "Priority support", "Guest WiFi portal"],
  },
  {
    id: "scale-fibre",
    name: "Scale Fibre",
    speed: "900 Mbps",
    price: "£54",
    priceValue: 54,
    summary: "Studios, agencies, and high-traffic sites.",
    inclusions: ["Unlimited data", "Pro router + mesh", "Managed security", "4-hour fix target"],
  },
];

export const businessServices: BusinessService[] = [
  {
    id: "hosted-voip",
    title: "Hosted VoIP",
    price: `£${bizVoipPayg?.retailMonthly.toFixed(2) ?? '6.95'}/seat`,
    typical: "Typical £9-12/seat",
    details: [
      "UK numbers, auto attendant, call recording",
      "Softphone apps for iOS/Android",
      "Call queues, hunt groups, voicemail to email",
    ],
  },
  {
    id: "sip-trunk",
    title: "SIP Trunks",
    price: `£${sipTrunkPayg?.retailMonthly.toFixed(2) ?? '5.95'}/trunk`,
    typical: "Typical £7-10/trunk",
    details: [
      "PAYG or 2000 minute bundles available",
      "Enhanced SIP add-on available",
      "TLS support on alternate ports",
    ],
  },
  {
    id: "managed-wifi",
    title: "Managed WiFi",
    price: "£14/site",
    typical: "Typical £15-20/site",
    details: [
      "Guest splash pages + access control",
      "Bandwidth shaping per device",
      "Monthly performance reports",
    ],
  },
  {
    id: "secure-dns",
    title: "Secure DNS & Web Filtering",
    price: "£4/user",
    typical: "Typical £5-7/user",
    details: [
      "Blocks phishing and malware domains",
      "Category-based content filtering",
      "Weekly threat summary",
    ],
  },
  {
    id: "m365-setup",
    title: "Microsoft 365 Setup",
    price: "£19/seat (one-off)",
    typical: "Typical £20-35/seat",
    details: [
      "Migration planning + mailbox moves",
      "Domain setup + DNS changes",
      "Teams + SharePoint baseline",
    ],
  },
  {
    id: "business-continuity",
    title: "Business Continuity 4G/5G",
    price: "£12/site",
    typical: "Typical £13-18/site",
    details: [
      "Automatic failover to mobile data",
      "Multi-network SIM",
      "Monthly usage monitoring",
    ],
  },
  {
    id: "leased-line-lite",
    title: "Leased Line Lite",
    price: "£248/mo",
    typical: "Typical £249-320/mo",
    details: [
      "Symmetric speeds from 100 Mbps",
      "99.9% uptime SLA",
      "Dedicated account manager",
    ],
  },
];
