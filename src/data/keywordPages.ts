export interface KeywordPageFAQ {
  question: string;
  answer: string;
}

export interface KeywordPageSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface KeywordPage {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  sections: KeywordPageSection[];
  faqs: KeywordPageFAQ[];
  ctaTitle: string;
  ctaText: string;
  ctaLink: string;
  ctaButton: string;
  price?: string;
}

const TERM_COPY =
  "OCCTA offers Price Lock 24 and Flex 30 where eligible. Price Lock 24 has a 24-month minimum term. Flex 30 is 30-day rolling with no fixed minimum term and normally 30 days’ notice.";
const PRICE_COPY =
  "Price Lock 24 headline pricing starts from £34.99/month including VAT. Flex 30 is priced separately where offered. Final price depends on the address, selected supplier product, setup and router choices.";
const SPEED_COPY =
  "Public broadband speed bands run up to 1000Mbps where available. The exact technology, address-specific estimate and contractual speed information are confirmed before acceptance.";
const CHARGE_COPY =
  "Setup, activation, engineer, router/equipment and any other one-off charges that apply to the order are shown before acceptance.";
const ENDING_COPY =
  "Flex 30 has no remaining-month Early Termination Charge. Price Lock 24 may have a fair-loss ETF during the minimum term. A separately valid network cease/migration charge may apply only where lawful, actually incurred and disclosed.";
const BILLING_COPY =
  "Billing starts only after the service is confirmed live. Monthly subscription charges are then billed in advance on the agreed billing date; the first invoice may also include agreed one-off charges and a pro-rata amount.";

export const keywordPages: KeywordPage[] = [
  {
    slug: "fixed-price-broadband",
    metaTitle: "Fixed-Price Broadband UK — Price Lock 24 | OCCTA",
    metaDescription: "OCCTA Price Lock 24 has a 24-month minimum term and no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring residential broadband subscription under contract version 2026.10.1.",
    keywords: "fixed price broadband UK, broadband no price rise, price lock broadband, no mid contract price rise broadband, fixed broadband price",
    heroTitle: "FIXED-PRICE BROADBAND",
    heroHighlight: "PRICE LOCK 24",
    heroSubtitle: "Price certainty for the minimum term, with the exact address-specific service and charges confirmed before you accept.",
    sections: [
      { heading: "What Price Lock 24 means", paragraphs: ["Price Lock 24 has a 24-month minimum term. Under residential contract version 2026.10.1 there is no scheduled CPI-, RPI-, inflation-linked or percentage-based increase on the recurring broadband subscription during that minimum term.", "Customer-specific price, speed information, setup and one-off charges are shown before acceptance."] },
      { heading: "Compare total contract cost", paragraphs: [PRICE_COPY, CHARGE_COPY, "When comparing another provider, check the exact pounds-and-pence price-change disclosure, setup cost, equipment cost and total minimum-term commitment rather than only the headline monthly price."] },
      { heading: "Need more flexibility?", paragraphs: [TERM_COPY, "Flex 30 is the rolling alternative where eligible. It normally has a higher headline monthly price but no fixed minimum term and no remaining-month Early Termination Charge."] },
      { heading: "Check your actual line", paragraphs: [SPEED_COPY, ENDING_COPY] },
    ],
    faqs: [
      { question: "Is Price Lock 24 a fixed-price broadband plan?", answer: "Under residential contract version 2026.10.1, the recurring broadband subscription has no scheduled CPI-, RPI-, inflation-linked or percentage-based rise during the 24-month minimum term. Customer-specific charges and any permitted exceptions are shown in the Contract Summary and Contract Information before acceptance." },
      { question: "Does Price Lock 24 have a minimum term?", answer: "Yes. Price Lock 24 has a 24-month minimum term. An Early Termination Charge may apply if you leave during that minimum term, subject to the accepted agreement and any legal right to leave without penalty." },
      { question: "How is Flex 30 different?", answer: "Flex 30 is 30-day rolling with no fixed minimum term where eligible and normally requires 30 days' notice. It has no remaining-month Early Termination Charge, although a separately valid network cease or migration charge may apply where lawful, actually incurred and disclosed." },
      { question: "Is £34.99 available everywhere?", answer: "No. £34.99 is a headline starting price for Price Lock 24. Final price depends on the address, supplier product, setup and router choices and is confirmed before acceptance." },
    ],
    ctaTitle: "Check Fixed-Price Broadband at Your Address",
    ctaText: "See whether Price Lock 24 is available and review the exact price, speed information, setup and terms before you order.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "cheap-broadband-near-me",
    metaTitle: "Affordable Broadband Near Me — Check Your Address | OCCTA",
    metaDescription: "Check OCCTA broadband at your address. Compare Price Lock 24 and Flex 30 where eligible, with customer-specific price, speed information, setup and charges before acceptance.",
    keywords: "affordable broadband near me, broadband deals near me, local broadband availability, fibre broadband address check",
    heroTitle: "AFFORDABLE BROADBAND",
    heroHighlight: "AT YOUR ADDRESS",
    heroSubtitle: "Check the exact service, price, speed information and setup available where you live.",
    sections: [
      { heading: "Address-specific availability", paragraphs: [SPEED_COPY, PRICE_COPY] },
      { heading: "Compare the total cost", paragraphs: [TERM_COPY, CHARGE_COPY, ENDING_COPY] },
      { heading: "Before you accept", paragraphs: ["Your Contract Summary and Contract Information show the customer-specific service, price, minimum term, speed information, setup and applicable charges before you are asked to accept the agreement."] },
    ],
    faqs: [
      { question: "How do I see the price at my address?", answer: "Enter your postcode and select the exact address. The order journey resolves the available supplier product and confirms the final customer price before acceptance." },
      { question: "Will every address get the headline speed?", answer: SPEED_COPY },
      { question: "What contract options are available?", answer: TERM_COPY },
      { question: "Are setup or router charges possible?", answer: CHARGE_COPY },
    ],
    ctaTitle: "Check Your Address",
    ctaText: "See the broadband options and customer-specific terms available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-no-credit-check",
    metaTitle: "Broadband Eligibility & Ordering Requirements | OCCTA",
    metaDescription: "Understand OCCTA broadband ordering requirements, address availability, Price Lock 24 and Flex 30 options, setup and final price before you commit.",
    keywords: "broadband eligibility, broadband ordering requirements, broadband address check, flexible broadband UK",
    heroTitle: "BROADBAND",
    heroHighlight: "CLEAR ELIGIBILITY",
    heroSubtitle: "Ordering and eligibility requirements are explained before you commit.",
    sections: [
      { heading: "Eligibility is plan-specific", paragraphs: ["Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit."] },
      { heading: "Your address matters", paragraphs: [SPEED_COPY, PRICE_COPY] },
      { heading: "Clear terms before acceptance", paragraphs: [TERM_COPY, CHARGE_COPY] },
    ],
    faqs: [
      { question: "Does OCCTA always avoid credit checks?", answer: "Do not assume that. Any identity, credit or eligibility check depends on the selected service and current ordering process, and is explained before you commit." },
      { question: "Can eligibility affect the service offered?", answer: "Availability primarily depends on the address and supplier product. Any additional ordering or eligibility requirement is shown during the current journey." },
      { question: "Are deposits or upfront charges possible?", answer: "Any deposit or upfront/setup charge depends on the selected order. Exact one-off charges are shown before acceptance." },
      { question: "What contract terms can I choose?", answer: TERM_COPY },
    ],
    ctaTitle: "Check Current Requirements",
    ctaText: "Check the address and see what service and ordering requirements apply.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-students",
    metaTitle: "Student Broadband — Flex 30 & Price Lock 24 | OCCTA",
    metaDescription: "Broadband for students and renters: compare Flex 30 and Price Lock 24, understand setup, moving-home rules and customer-specific pricing before ordering.",
    keywords: "student broadband UK, broadband for renters, flexible broadband students, student internet",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "STUDENTS",
    heroSubtitle: "Compare flexibility, price and moving-home terms before you choose.",
    sections: [
      { heading: "Choose the term that fits", paragraphs: [TERM_COPY, "Flex 30 may suit shorter or uncertain stays; Price Lock 24 may suit customers who expect to remain for the minimum term and want a lower headline monthly price."] },
      { heading: "Moving home", paragraphs: ["Moving does not automatically cancel every charge. OCCTA checks the new address, explains whether the same or a genuinely equivalent service can be provided, and discloses any new installation/network work before it is ordered."] },
      { heading: "Setup and speed", paragraphs: [SPEED_COPY, CHARGE_COPY] },
    ],
    faqs: [
      { question: "Can I cancel when my tenancy ends?", answer: "That depends on the plan you accepted. Flex 30 normally uses 30 days’ notice. Price Lock 24 may have an ETF during the minimum term. Moving-home and any applicable network charges follow the accepted agreement." },
      { question: "How quickly can student broadband be installed?", answer: "Installation timing depends on the address, network and required work. The provisional service date is shown where available and remains subject to network confirmation unless expressly committed." },
      { question: "Can I use my own router?", answer: "Where the selected service permits compatible customer-owned equipment, you may use it. Router options and any charge are shown before acceptance." },
      { question: "How do I choose a speed?", answer: SPEED_COPY },
    ],
    ctaTitle: "Check Your Student Address",
    ctaText: "See the available service, term, price and setup before you order.",
    ctaLink: "/broadband",
    ctaButton: "Check Address",
    price: "34.99",
  },
  {
    slug: "best-broadband-deals-uk",
    metaTitle: "Broadband Deals UK 2026 — Compare Total Cost | OCCTA",
    metaDescription: "Compare OCCTA broadband using the total cost, minimum term, scheduled price-change policy, setup, router, speed information and termination terms.",
    keywords: "broadband deals UK, broadband comparison, broadband total cost, Flex 30, Price Lock 24",
    heroTitle: "COMPARE BROADBAND",
    heroHighlight: "TOTAL COST",
    heroSubtitle: "Headline price is only one part of the decision.",
    sections: [
      { heading: "Compare more than the headline", paragraphs: [PRICE_COPY, CHARGE_COPY, "For any competing tariff, compare the current pounds-and-pence scheduled price change and timing shown before sign-up."] },
      { heading: "Compare contract terms", paragraphs: [TERM_COPY, ENDING_COPY] },
      { heading: "Compare the actual line", paragraphs: [SPEED_COPY] },
    ],
    faqs: [
      { question: "Is OCCTA always the cheapest?", answer: "No blanket cheapest-provider claim is made. Value depends on your address, selected speed band, term, setup, equipment and competing offers." },
      { question: "Does Price Lock 24 have scheduled inflation-linked rises?", answer: "Contract version 2026.10.1 has no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring residential broadband subscription during the Price Lock 24 minimum term." },
      { question: "What is the difference between Flex 30 and Price Lock 24?", answer: TERM_COPY },
      { question: "What should I compare before switching?", answer: "Compare total monthly and one-off cost, term, speed information, setup, scheduled price changes, router/equipment and termination-related charges." },
    ],
    ctaTitle: "Compare at Your Address",
    ctaText: "Check the customer-specific OCCTA offer before deciding.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-gaming",
    metaTitle: "Broadband for Gaming UK — Check Speed & Latency | OCCTA",
    metaDescription: "Gaming broadband depends on latency, Wi-Fi and the address-specific connection as well as headline speed. Check OCCTA availability and contract options at your address.",
    keywords: "gaming broadband UK, low latency broadband, fibre broadband gaming, gaming internet",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "GAMING",
    heroSubtitle: "Check the connection at your address — not just the headline Mbps.",
    sections: [
      { heading: "Speed is not the whole story", paragraphs: ["Gaming performance depends on latency, packet loss, Wi-Fi quality, server location and the actual access line as well as download speed.", SPEED_COPY] },
      { heading: "Choose your term", paragraphs: [TERM_COPY] },
      { heading: "Equipment and setup", paragraphs: [CHARGE_COPY, "A wired Ethernet connection is often the most reliable way to test or use latency-sensitive applications."] },
    ],
    faqs: [
      { question: "What speed do I need for gaming?", answer: "There is no single required speed for every household. Check the game/application requirements and consider other simultaneous household usage; latency and connection quality matter as well." },
      { question: "Does full fibre help gaming?", answer: "FTTP can provide high capacity and low latency, but actual performance still depends on the network path, home equipment and game server." },
      { question: "Can I take Flex 30 for gaming?", answer: "Flex 30 is available on eligible combinations. Price Lock 24 is also available where offered. The exact address-specific service and term are confirmed before acceptance." },
      { question: "Are speeds guaranteed?", answer: SPEED_COPY },
    ],
    ctaTitle: "Check Gaming Broadband",
    ctaText: "See the available technology and speed information at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-working-from-home",
    metaTitle: "Broadband for Working From Home | OCCTA",
    metaDescription: "Check address-specific broadband for video calls, cloud work and remote access. Compare OCCTA speed information, Flex 30 and Price Lock 24 terms before ordering.",
    keywords: "working from home broadband, WFH broadband, remote work internet, home office broadband",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "WORKING FROM HOME",
    heroSubtitle: "Choose using address-specific download and upload information.",
    sections: [
      { heading: "Check both download and upload", paragraphs: ["Video calls, cloud backups and file sharing can depend heavily on upload performance. Use the address-specific download and upload information provided before acceptance.", SPEED_COPY] },
      { heading: "Reliability and home Wi-Fi", paragraphs: ["Broadband line quality and home Wi-Fi are different. Wired testing can help separate a Wi-Fi issue from an access-line issue."] },
      { heading: "Contract and setup", paragraphs: [TERM_COPY, CHARGE_COPY] },
    ],
    faqs: [
      { question: "What speed do I need for home working?", answer: "It depends on your applications and the number of simultaneous users. Check the requirements of your employer, VPN and video platform against the address-specific speed information." },
      { question: "Is there a guaranteed business SLA on residential broadband?", answer: "Do not assume one. Any care level, repair target or SLA must be explicitly stated for the selected service." },
      { question: "Can I claim broadband as a business expense?", answer: "Tax treatment depends on your circumstances. Check current HMRC guidance or ask your accountant." },
      { question: "What contract options are available?", answer: TERM_COPY },
    ],
    ctaTitle: "Check Your Home Office Address",
    ctaText: "Review the service and speed information available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-no-upfront-cost",
    metaTitle: "Broadband Setup Cost — £0 Setup Where Available | OCCTA",
    metaDescription: "£0 setup may be available on eligible OCCTA orders. Exact setup, activation, engineer, router and delivery charges are shown before acceptance.",
    keywords: "broadband setup cost, broadband £0 setup, broadband activation cost, router cost broadband",
    heroTitle: "BROADBAND",
    heroHighlight: "SETUP COSTS",
    heroSubtitle: "£0 setup may be available — your exact upfront charges are shown before acceptance.",
    sections: [
      { heading: "What £0 setup means", paragraphs: ["Some eligible orders may have £0 setup. Other addresses or installation scenarios can require chargeable network or engineer work.", CHARGE_COPY] },
      { heading: "Router choice", paragraphs: ["Where customer-owned equipment is supported, you may choose a compatible router. Available OCCTA router options and any one-off or monthly charge are shown in the order journey."] },
      { heading: "When billing starts", paragraphs: [BILLING_COPY] },
      { heading: "Before you order", paragraphs: ["The Contract Summary and Contract Information show the applicable monthly and one-off charges before acceptance. If a charge is not known because it depends on later customer-caused or network work, the contractual basis for any later pass-through charge must already have been disclosed."] },
    ],
    faqs: [
      { question: "Is setup always £0?", answer: "No. £0 setup is available only where the selected order qualifies. Exact setup/installation charges are shown before acceptance." },
      { question: "Do I have to buy an OCCTA router?", answer: "Not always. Router requirements depend on the selected service, and Digital Voice requires compatible equipment. The order journey shows the available choices and charges." },
      { question: "When does broadband billing start?", answer: BILLING_COPY },
      { question: "Can an engineer charge apply?", answer: "Yes, where an engineer visit or chargeable network work is required and the charge is properly disclosed. Customer-caused or abortive-visit charges may also apply only where the contractual basis was disclosed and the third-party charge is fair and actually incurred." },
      { question: "Can I see the first-bill components before accepting?", answer: "The order and contract documents show the agreed monthly and one-off charges. The first invoice may also contain a pro-rata amount because billing begins only after the service is live." },
    ],
    ctaTitle: "See Your Setup Cost",
    ctaText: "Check the address to see the applicable setup, router and service options.",
    ctaLink: "/broadband",
    ctaButton: "Check My Address",
    price: "34.99",
  },
];

export const getKeywordPageBySlug = (slug: string): KeywordPage | undefined =>
  keywordPages.find((p) => p.slug === slug);
