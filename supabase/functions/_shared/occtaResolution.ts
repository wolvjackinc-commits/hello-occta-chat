import type { AccountIntent } from "./companionCore.ts";

export type OcctaGuide = {
  slug: string;
  title: string;
  keywords: string[];
};

export const OCCTA_GUIDES: OcctaGuide[] = [
  {
    slug: "getting-started",
    title: "Getting Started With Your OCCTA Service",
    keywords: ["getting started", "new service", "new broadband", "setup", "set up", "activation day", "first day", "connect devices"],
  },
  {
    slug: "router-setup",
    title: "Router Setup: Lights, Ports & Common Issues",
    keywords: ["router", "router setup", "router light", "lights", "wan", "internet light", "red light", "ports", "connect router"],
  },
  {
    slug: "no-internet-troubleshooting",
    title: "No Internet? Try This Before You Call",
    keywords: ["no internet", "internet down", "broadband down", "not working", "offline", "los", "pon", "connection", "troubleshoot"],
  },
  {
    slug: "slow-wifi-fix",
    title: "Why Your Wi-Fi is Slow (and 6 Things That Actually Fix It)",
    keywords: ["slow wifi", "slow wi-fi", "slow internet", "buffering", "weak wifi", "wifi coverage", "poor signal", "speed"],
  },
  {
    slug: "digital-voice-setup",
    title: "Digital Voice (Home Phone) Setup",
    keywords: ["digital voice", "home phone", "landline", "phone setup", "handset", "dial tone", "phone number", "voice"],
  },
  {
    slug: "billing",
    title: "Billing Explained: When and How You'll Be Charged",
    keywords: ["billing", "bill", "invoice", "charge", "payment", "amount due", "owe", "own", "balance", "refund", "vat"],
  },
  {
    slug: "direct-debit-setup-help",
    title: "Setting Up & Managing Direct Debit",
    keywords: ["direct debit", "dd", "mandate", "bank mandate", "payment method", "change bank", "setup direct debit"],
  },
  {
    slug: "first-invoice-explained-help",
    title: "Your First Invoice, Explained",
    keywords: ["first invoice", "first bill", "part month", "pro rata", "prorata", "setup charge", "activation charge"],
  },
  {
    slug: "own-router-setup",
    title: "Using Your Own Router With OCCTA",
    keywords: ["own router", "third party router", "pppoe", "wan credentials", "router credentials", "use my router"],
  },
];

export function normaliseOcctaText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\b(?:occrta|occcta|occtta|ooccta|occta)\b/g, "occta")
    .replace(/[^a-z0-9£.%@+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandedAccountIntent(text: string): AccountIntent | null {
  const value = normaliseOcctaText(text);

  if (
    /\b(?:do i owe|do i own|owe you|own you|owe occta|own occta|money i owe|money i own|how much i owe|how much i own|how much do i owe|how much do i own|amount due|outstanding balance|outstanding amount|account balance|arrears|money due|what do i owe|what do i own)\b/.test(value)
  ) return "invoices";

  if (/\b(?:my bill|my invoice|my invoices|my billing|latest invoice|latest bill|show.*bill|want.*bill)\b/.test(value)) return "invoices";
  if (/\b(?:my order|track my order|order status|my activation|my installation|go live date)\b/.test(value)) {
    return /activation|installation|go live/.test(value) ? "installation" : "orders";
  }
  if (/\b(?:my service|my broadband|my sim|my mobile|my plan|my package)\b/.test(value)) return "services";
  if (/\b(?:my ticket|my support case|my complaint status)\b/.test(value)) return "tickets";
  if (/\b(?:my contract|my receipt|my document)\b/.test(value)) return "documents";
  if (/\b(?:my account|account details|account overview|my profile)\b/.test(value)) return "overview";

  return null;
}

export function expandedPublicIntent(text: string): string | null {
  const value = normaliseOcctaText(text);

  if (
    /\b(?:available|availability|coverage|cover|serve|service)\b/.test(value)
    && /\b(?:occta|broadband|internet|fibre|fiber|huddersfield|postcode|area|address)\b/.test(value)
  ) return "availability";

  if (
    /\b(?:bt|sky|virgin(?: media)?|talktalk|plusnet|vodafone|ee|zen)\b/.test(value)
    && /\b(?:fast|faster|speed|better|reliable|reliability|compare|comparison|versus|vs|cheaper|price|cost|difference)\b/.test(value)
  ) return "provider_comparison";

  if (/\b(?:fast internet|fast broadband|faster internet|faster broadband|gigabit|1000 ?mbps|1 ?gbps)\b/.test(value)) return "broadband";

  if (/\b(?:guide|guides|how to|how do i|instructions|manual|help page|show me how)\b/.test(value)) {
    if (/\b(?:router|wan|pppoe|ont)\b/.test(value)) return "router";
    if (/\b(?:no internet|internet.*not working|broadband.*not working|offline|los)\b/.test(value)) return "no_internet";
    if (/\b(?:slow|wifi|wi-fi|buffering|coverage)\b/.test(value)) return "slow_wifi";
    if (/\b(?:direct debit|mandate)\b/.test(value)) return "direct_debit";
    if (/\b(?:first bill|first invoice)\b/.test(value)) return "first_invoice";
    if (/\b(?:digital voice|home phone|landline)\b/.test(value)) return "voice";
  }

  return null;
}

const INTENT_GUIDES: Record<string, string[]> = {
  no_internet: ["no-internet-troubleshooting", "router-setup"],
  router_lights: ["router-setup", "no-internet-troubleshooting"],
  router: ["router-setup", "own-router-setup"],
  pppoe_missing: ["own-router-setup", "router-setup"],
  slow_wifi: ["slow-wifi-fix", "router-setup"],
  voice: ["digital-voice-setup"],
  direct_debit: ["direct-debit-setup-help", "billing"],
  first_invoice: ["first-invoice-explained-help", "billing"],
  vat: ["billing", "first-invoice-explained-help"],
};

function tokens(value: string): string[] {
  return normaliseOcctaText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !["the", "and", "with", "from", "have", "want", "need", "show", "help", "page", "guide"].includes(token));
}

export function matchOcctaGuides(query: string, intent = "general", limit = 3): OcctaGuide[] {
  const preferred = new Set(INTENT_GUIDES[intent] ?? []);
  const queryValue = normaliseOcctaText(query);
  const queryTokens = tokens(queryValue);

  const scored = OCCTA_GUIDES.map((guide) => {
    let score = preferred.has(guide.slug) ? 100 : 0;
    const haystack = normaliseOcctaText(`${guide.title} ${guide.keywords.join(" ")}`);
    for (const keyword of guide.keywords) {
      if (queryValue.includes(normaliseOcctaText(keyword))) score += 12;
    }
    for (const token of queryTokens) {
      if (haystack.includes(token)) score += 2;
    }
    return { guide, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title));

  const seen = new Set<string>();
  return scored.flatMap(({ guide }) => {
    if (seen.has(guide.slug)) return [];
    seen.add(guide.slug);
    return [guide];
  }).slice(0, Math.max(1, limit));
}

export function guideLinksMarkdown(query: string, intent = "general", limit = 2): string {
  const guides = matchOcctaGuides(query, intent, limit);
  if (!guides.length) return "";
  return guides
    .map((guide) => `• [**${guide.title} →**](https://www.occta.co.uk/help/${guide.slug})`)
    .join("\n");
}
