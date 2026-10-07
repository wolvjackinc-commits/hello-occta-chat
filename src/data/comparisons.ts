export interface ComparisonPoint {
  feature: string;
  occta: string;
  competitor: string;
}

export interface ComparisonFAQ {
  question: string;
  answer: string;
}

export interface Comparison {
  slug: string;
  competitor: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  points: ComparisonPoint[];
  summary: string;
  faqs: ComparisonFAQ[];
}

const OCCTA_TERM =
  "Flex 30 is 30-day rolling with no fixed minimum term where offered. Price Lock 24 has a 24-month minimum term.";
const OCCTA_PRICE =
  "Residential broadband headline pricing starts from £34.99/month on Price Lock 24; Flex 30 is priced separately. Final price depends on the address, supplier product, setup and router choices.";
const OCCTA_CHANGE =
  "Contract version 2026.10.1 has no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring residential broadband subscription.";
const OCCTA_ENDING =
  "Flex 30 has no remaining-month Early Termination Charge. Price Lock 24 may have a fair-loss ETF during the minimum term. A separately valid network cease/migration charge may apply only where lawful, actually incurred and disclosed.";
const OCCTA_SPEED =
  "Public speed bands run up to 1000Mbps where available. Exact technology and contractual/address-specific speed information are confirmed before acceptance.";

function makeComparison(slug: string, competitor: string): Comparison {
  return {
    slug,
    competitor,
    metaTitle: `OCCTA vs ${competitor} Broadband — Compare Current Terms`,
    metaDescription: `Compare OCCTA broadband with ${competitor}. Review current monthly price, minimum term, scheduled price changes, setup, speeds and termination terms before choosing.`,
    keywords: `OCCTA vs ${competitor}, ${competitor} broadband comparison, broadband contract comparison, Flex 30, Price Lock 24`,
    heroTitle: `OCCTA vs ${competitor.toUpperCase()}`,
    heroSubtitle: "Compare current terms, not old headline claims.",
    intro: `Broadband prices, networks, promotions and contract terms change. This comparison explains OCCTA's current contract structure and tells you what to verify in ${competitor}'s current pre-contract information rather than relying on historic prices or assumptions.`,
    points: [
      { feature: "Monthly price", occta: OCCTA_PRICE, competitor: "Check the provider's current address-specific tariff and total monthly price." },
      { feature: "Minimum term", occta: OCCTA_TERM, competitor: "Check the current tariff's minimum term and post-term treatment." },
      { feature: "Scheduled price changes", occta: OCCTA_CHANGE, competitor: "Check the pounds-and-pence change and timing shown in the provider's current pre-contract information." },
      { feature: "Setup / activation / router", occta: "Any applicable setup, activation, engineer and router charges are shown before acceptance.", competitor: "Check the current order for setup, activation, engineer, delivery and equipment charges." },
      { feature: "Ending the service", occta: OCCTA_ENDING, competitor: "Check notice, early-termination and any network/cease charges in the current agreement." },
      { feature: "Network and speeds", occta: OCCTA_SPEED, competitor: "Check the exact address, access technology and contractual speed information for the provider's current offer." },
    ],
    summary: `Choose between OCCTA and ${competitor} using the customer-specific total cost, minimum term, speed information, setup requirements, price-change terms and termination charges supplied before you commit.`,
    faqs: [
      {
        question: `Is OCCTA cheaper than ${competitor}?`,
        answer: `We do not make a blanket cheapest-provider claim. Compare the current total cost for your address, including setup, router/equipment, scheduled price changes and any termination-related charges.`,
      },
      {
        question: `Will I get the same speed if I move from ${competitor} to OCCTA?`,
        answer: "Not necessarily. Speed depends on the exact address, access network and supplier product. OCCTA confirms the address-specific estimate and contractual speed information before acceptance.",
      },
      {
        question: `Can I switch from ${competitor} to OCCTA?`,
        answer: "Where One Touch Switch applies, the gaining provider normally coordinates the switch. The order journey confirms the expected date, any known downtime risk and applicable charges; OCCTA does not promise zero downtime.",
      },
    ],
  };
}

export const comparisons: Comparison[] = [
  makeComparison("occta-vs-bt", "BT"),
  makeComparison("occta-vs-sky", "Sky"),
  makeComparison("occta-vs-virgin-media", "Virgin Media"),
  makeComparison("occta-vs-talktalk", "TalkTalk"),
  makeComparison("occta-vs-plusnet", "Plusnet"),
  makeComparison("occta-vs-vodafone", "Vodafone"),
  makeComparison("occta-vs-now-broadband", "NOW Broadband"),
  makeComparison("occta-vs-community-fibre", "Community Fibre"),
  makeComparison("occta-vs-hyperoptic", "Hyperoptic"),
  makeComparison("occta-vs-ee", "EE"),
];

export const getComparisonBySlug = (slug: string): Comparison | undefined =>
  comparisons.find((c) => c.slug === slug);
