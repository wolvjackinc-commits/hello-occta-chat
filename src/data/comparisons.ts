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

export const comparisons: Comparison[] = [
  {
    slug: "occta-vs-bt",
    competitor: "BT",
    metaTitle: "OCCTA vs BT Broadband — Honest Comparison",
    metaDescription: "Compare OCCTA vs BT broadband. See how OCCTA offers cheaper prices, no contracts, and no mid-contract price rises versus BT\u2019s 24-month lock-ins.",
    keywords: "OCCTA vs BT, BT broadband alternative, cheaper than BT, BT broadband comparison, no contract broadband vs BT",
    heroTitle: "OCCTA vs BT",
    heroSubtitle: "Same network. Better deal.",
    intro: "BT is the UK\u2019s biggest broadband provider, but bigger doesn\u2019t always mean better value. Both OCCTA and BT use the same Openreach fibre network, so you get the same infrastructure \u2014 but at very different prices. Here\u2019s how they compare.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A331.99/mo" },
      { feature: "Contract length", occta: "No contract \u2014 rolling monthly", competitor: "24-month contract" },
      { feature: "Mid-contract price rises", occta: "None \u2014 price fixed", competitor: "CPI + 3.9% annual increase" },
      { feature: "Setup fees", occta: "Setup from £0 where available. Bring your own router for £0, or choose a router at checkout", competitor: "\u00A39.99\u2013\u00A359.99 setup fee" },
      { feature: "Exit fees", occta: "None on Flex", competitor: "Up to \u00A3230+ early termination" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 900Mbps" },
    ],
    summary: "BT and OCCTA use the same Openreach network, so speeds and reliability are comparable. The difference is price and flexibility. With OCCTA, you pay less, keep the same price every month, and can leave whenever you want \u2014 no hassle.",
    faqs: [
      { question: "Is OCCTA as fast as BT?", answer: "Yes. Both use the same Openreach fibre network, so speeds are comparable \u2014 up to 900Mbps on full fibre." },
      { question: "Why is OCCTA cheaper than BT?", answer: "OCCTA has lower overheads \u2014 no TV bundles, no high-street shops, no expensive sponsorship deals. We pass those savings directly to customers." },
      { question: "Can I switch from BT to OCCTA?", answer: "Yes. The One Touch Switch process makes it simple. Sign up with OCCTA and we handle the rest \u2014 no need to contact BT." },
      { question: "Will my BT broadband speed change if I switch?", answer: "No. Since both providers use the same Openreach network, your line speed stays the same." },
    ],
  },
  {
    slug: "occta-vs-sky",
    competitor: "Sky",
    metaTitle: "OCCTA vs Sky Broadband — Honest Comparison",
    metaDescription: "Compare OCCTA vs Sky broadband. Cheaper prices, no contracts, no hidden fees. See why OCCTA is a smarter alternative to Sky.",
    keywords: "OCCTA vs Sky, Sky broadband alternative, cheaper than Sky, Sky broadband comparison, no contract vs Sky",
    heroTitle: "OCCTA vs SKY",
    heroSubtitle: "Cut the bundle. Keep the speed.",
    intro: "Sky is known for TV bundles, but if you just want fast, cheap broadband without the extras, you might be overpaying. OCCTA offers the same Openreach-powered fibre without the bundle bloat.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A329/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18-month contract" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "\u00A329.95 setup" },
      { feature: "Exit fees", occta: "None", competitor: "Remaining contract charges" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "TV bundle required", occta: "No \u2014 broadband only", competitor: "Often bundled with TV" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 900Mbps" },
    ],
    summary: "Sky broadband works well if you want their TV service, but for broadband-only customers, OCCTA offers better value with more flexibility. No bundles, no lock-in, and a price that stays the same.",
    faqs: [
      { question: "Is OCCTA better than Sky for broadband only?", answer: "For broadband-only, yes. OCCTA is cheaper, has no contract, and no mid-term price rises. Sky\u2019s value comes from TV bundles." },
      { question: "Can I switch from Sky to OCCTA?", answer: "Yes. Use the One Touch Switch process \u2014 sign up with OCCTA and we handle the switchover automatically." },
      { question: "Does OCCTA use the same network as Sky?", answer: "Yes. Both use the Openreach fibre network for broadband delivery." },
      { question: "Will I lose my Sky TV if I switch broadband?", answer: "You can keep Sky TV separately via satellite or Sky Glass. Only the broadband connection changes." },
    ],
  },
  {
    slug: "occta-vs-virgin-media",
    competitor: "Virgin Media",
    metaTitle: "OCCTA vs Virgin Media — Honest Comparison",
    metaDescription: "Compare OCCTA vs Virgin Media broadband. See how OCCTA offers better value with no contracts and fixed pricing on the Openreach network.",
    keywords: "OCCTA vs Virgin Media, Virgin Media alternative, cheaper than Virgin Media, Virgin broadband comparison",
    heroTitle: "OCCTA vs VIRGIN MEDIA",
    heroSubtitle: "Different network. Better value.",
    intro: "Virgin Media uses its own cable network, while OCCTA uses Openreach fibre. Both offer ultrafast speeds, but the pricing and contract terms are very different.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A333/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18-month contract" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "\u00A335 setup fee" },
      { feature: "Exit fees", occta: "None", competitor: "Remaining months charged" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network", occta: "Openreach fibre", competitor: "Virgin Media cable" },
      { feature: "Coverage", occta: "Nationwide (Openreach)", competitor: "~55% of UK" },
    ],
    summary: "Virgin Media offers fast speeds on its own cable network, but coverage is limited and contracts are long. OCCTA covers more of the UK via Openreach, with no contracts and lower prices.",
    faqs: [
      { question: "Is OCCTA faster than Virgin Media?", answer: "Both offer speeds up to 900Mbps+. Virgin\u2019s Gig1 plan peaks higher, but most households don\u2019t need more than 500Mbps." },
      { question: "Can I get OCCTA where Virgin Media isn\u2019t available?", answer: "Most likely, yes. OCCTA uses the Openreach network which covers around 97% of UK premises." },
      { question: "Can I switch from Virgin Media to OCCTA?", answer: "Yes. Since they use different networks, you\u2019ll need to cancel Virgin separately and sign up with OCCTA." },
      { question: "Why is OCCTA cheaper than Virgin Media?", answer: "Lower overheads, no TV bundles, no expensive infrastructure to maintain. We focus on broadband and pass savings to customers." },
    ],
  },
  {
    slug: "occta-vs-talktalk",
    competitor: "TalkTalk",
    metaTitle: "OCCTA vs TalkTalk — Honest Comparison",
    metaDescription: "Compare OCCTA vs TalkTalk broadband. Both are budget-friendly, but OCCTA offers no contracts and no price rises. See the full comparison.",
    keywords: "OCCTA vs TalkTalk, TalkTalk alternative, cheaper than TalkTalk, TalkTalk broadband comparison",
    heroTitle: "OCCTA vs TALKTALK",
    heroSubtitle: "Budget broadband. Without the catch.",
    intro: "TalkTalk is known for budget broadband, but their contracts still come with lock-ins and annual price rises. OCCTA matches the low price and removes the restrictions.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A324/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18 or 24 months" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.7% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "Free (promotional)" },
      { feature: "Exit fees", occta: "None", competitor: "Up to \u00A3240+" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 500Mbps" },
    ],
    summary: "TalkTalk competes on price but still locks you into contracts with annual increases. OCCTA gives you the same budget pricing with more speed options and flexibility.",
    faqs: [
      { question: "Is OCCTA cheaper than TalkTalk?", answer: "OCCTA starts from \u00A334.99/mo. When you factor in TalkTalk\u2019s annual price rises, OCCTA is often cheaper over 12 months." },
      { question: "Does OCCTA have faster speeds than TalkTalk?", answer: "Yes. OCCTA offers speeds up to 900Mbps, while TalkTalk tops out at around 500Mbps." },
      { question: "Can I switch from TalkTalk to OCCTA?", answer: "Yes. Both use Openreach, so the One Touch Switch process handles everything automatically." },
    ],
  },
  {
    slug: "occta-vs-plusnet",
    competitor: "Plusnet",
    metaTitle: "OCCTA vs Plusnet — Honest Comparison",
    metaDescription: "Compare OCCTA vs Plusnet broadband. Both offer value broadband, but OCCTA has no contracts and no hidden price rises. Full comparison inside.",
    keywords: "OCCTA vs Plusnet, Plusnet alternative, cheaper than Plusnet, Plusnet broadband comparison",
    heroTitle: "OCCTA vs PLUSNET",
    heroSubtitle: "Real value. No strings attached.",
    intro: "Plusnet (owned by BT) markets itself as friendly, good-value broadband. OCCTA takes that further with no contracts, no price rises, and genuinely fixed pricing.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A325.99/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18 or 24 months" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "\u00A35\u2013\u00A310 activation" },
      { feature: "Exit fees", occta: "None", competitor: "Remaining contract charges" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 500Mbps" },
    ],
    summary: "Plusnet offers decent value but still ties you into contracts with annual increases. OCCTA delivers the same Openreach broadband with faster speed options, no lock-in, and a fixed price.",
    faqs: [
      { question: "Is OCCTA better value than Plusnet?", answer: "Yes. OCCTA is cheaper, has faster top speeds, and doesn\u2019t increase your price mid-contract." },
      { question: "Does OCCTA use the same network as Plusnet?", answer: "Yes. Both use the Openreach fibre network." },
      { question: "Can I switch from Plusnet to OCCTA easily?", answer: "Yes. The One Touch Switch process handles the transfer automatically." },
    ],
  },
  {
    slug: "occta-vs-vodafone",
    competitor: "Vodafone",
    metaTitle: "OCCTA vs Vodafone Broadband — Honest Comparison",
    metaDescription: "Compare OCCTA vs Vodafone broadband. See how OCCTA's flexible monthly options, no mid-contract price rises and simple pricing stack up against Vodafone Pro II.",
    keywords: "OCCTA vs Vodafone, Vodafone broadband alternative, cheaper than Vodafone, Vodafone broadband comparison",
    heroTitle: "OCCTA vs VODAFONE",
    heroSubtitle: "Same fibre. Simpler plan.",
    intro: "Vodafone Broadband and OCCTA both ride the Openreach network. Vodafone leans on Pro II bundles and 24-month tie-ins; OCCTA keeps it simple with rolling monthly and price-lock options.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A327/mo (rises after promo)" },
      { feature: "Contract length", occta: "Flex 30-day or Price Lock 24", competitor: "24-month standard" },
      { feature: "Mid-contract price rises", occta: "None on Price Lock; 30-day notice on Flex", competitor: "CPI-linked in-contract rise" },
      { feature: "Setup fees", occta: "Setup from \u00A30 where available", competitor: "\u00A310\u2013\u00A329 activation" },
      { feature: "Exit fees", occta: "None on Flex", competitor: "Remaining months payable" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach + CityFibre in some areas" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 900Mbps (Full Fibre only)" },
    ],
    summary: "If you want Vodafone Pro II's device ecosystem, stay with Vodafone. If you just want fast fibre without a 24-month lock-in, OCCTA is a cleaner deal.",
    faqs: [
      { question: "Is OCCTA cheaper than Vodafone in the long run?", answer: "Usually yes \u2014 Vodafone's headline price rises after the promo period and again mid-contract. OCCTA's price stays put." },
      { question: "Can I switch from Vodafone to OCCTA?", answer: "Yes \u2014 One Touch Switch handles it automatically for Openreach-to-Openreach moves." },
      { question: "Do OCCTA and Vodafone use the same network?", answer: "Mostly yes \u2014 both use Openreach. Vodafone also uses CityFibre in select cities." },
    ],
  },
  {
    slug: "occta-vs-now-broadband",
    competitor: "NOW Broadband",
    metaTitle: "OCCTA vs NOW Broadband — Honest Comparison",
    metaDescription: "Compare OCCTA vs NOW Broadband. Both offer flexible options, but see who wins on speed, price rises and no-strings pricing.",
    keywords: "OCCTA vs NOW Broadband, NOW broadband alternative, cheaper than NOW, NOW Broadband comparison",
    heroTitle: "OCCTA vs NOW BROADBAND",
    heroSubtitle: "Rolling monthly, done properly.",
    intro: "NOW Broadband (part of Sky) markets itself on flexibility. OCCTA matches the rolling monthly promise with faster full-fibre speeds and a wider network reach.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A324\u2013\u00A330/mo" },
      { feature: "Contract length", occta: "Rolling monthly or Price Lock 24", competitor: "1 or 12 months" },
      { feature: "Mid-contract price rises", occta: "None on Price Lock", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Setup from \u00A30 where available", competitor: "\u00A310 activation" },
      { feature: "Exit fees", occta: "None on Flex", competitor: "Remaining months on 12-month plan" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network", occta: "Openreach (FTTC & FTTP)", competitor: "Openreach (FTTC only \u2014 no full fibre)" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 63Mbps" },
    ],
    summary: "NOW keeps things cheap but tops out at 63Mbps because it's FTTC-only. OCCTA offers the same flexibility plus proper full-fibre speeds where available.",
    faqs: [
      { question: "Is NOW Broadband as fast as OCCTA?", answer: "No. NOW Broadband is FTTC only, capped around 63Mbps. OCCTA offers up to 900Mbps on full fibre." },
      { question: "Can I get NOW Broadband on a rolling contract?", answer: "Yes, but only at a higher monthly price. Compare 12-month vs 1-month rates carefully." },
      { question: "Does OCCTA credit check like NOW?", answer: "No \u2014 OCCTA doesn't credit check for standard residential broadband." },
    ],
  },
  {
    slug: "occta-vs-community-fibre",
    competitor: "Community Fibre",
    metaTitle: "OCCTA vs Community Fibre — Honest Comparison",
    metaDescription: "Compare OCCTA vs Community Fibre. Full-fibre broadband options in London vs nationwide Openreach coverage \u2014 which is right for you?",
    keywords: "OCCTA vs Community Fibre, Community Fibre alternative, London broadband comparison",
    heroTitle: "OCCTA vs COMMUNITY FIBRE",
    heroSubtitle: "London-only vs UK-wide.",
    intro: "Community Fibre runs its own network across parts of London. OCCTA uses Openreach for nationwide coverage. Here's the honest comparison.",
    points: [
      { feature: "Coverage", occta: "Nationwide UK (Openreach)", competitor: "London only" },
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A320\u2013\u00A325/mo" },
      { feature: "Contract length", occta: "Flex 30-day or Price Lock 24", competitor: "24 months" },
      { feature: "Mid-contract price rises", occta: "None on Price Lock", competitor: "None during contract" },
      { feature: "Setup fees", occta: "Setup from \u00A30 where available", competitor: "Free installation" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 3Gbps" },
      { feature: "Network", occta: "Openreach", competitor: "Own fibre network" },
    ],
    summary: "Community Fibre offers eye-catching speeds if you're in a covered London street. OCCTA covers 97% of the UK on the Openreach network with rolling-monthly flexibility.",
    faqs: [
      { question: "Can I get Community Fibre outside London?", answer: "No \u2014 coverage is limited to specific London streets." },
      { question: "Is OCCTA available where Community Fibre isn't?", answer: "Yes \u2014 OCCTA uses the Openreach network which covers ~97% of UK addresses." },
      { question: "Which is better for gaming?", answer: "Both offer low-latency full fibre. Above 500Mbps, real-world difference is negligible for gaming." },
    ],
  },
  {
    slug: "occta-vs-hyperoptic",
    competitor: "Hyperoptic",
    metaTitle: "OCCTA vs Hyperoptic — Honest Comparison",
    metaDescription: "Compare OCCTA vs Hyperoptic. Nationwide Openreach coverage vs Hyperoptic's building-only full fibre \u2014 see which fits your address.",
    keywords: "OCCTA vs Hyperoptic, Hyperoptic alternative, Hyperoptic vs Openreach",
    heroTitle: "OCCTA vs HYPEROPTIC",
    heroSubtitle: "In a Hyperoptic building? Elsewhere? We've got you.",
    intro: "Hyperoptic runs its own gigabit fibre into around 800,000 flats and buildings, mostly in cities. OCCTA covers everyone else on Openreach.",
    points: [
      { feature: "Coverage", occta: "Nationwide (Openreach)", competitor: "Enabled buildings only (~800k premises)" },
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A322\u2013\u00A328/mo" },
      { feature: "Contract length", occta: "Flex 30-day or Price Lock 24", competitor: "24 months (rolling available at higher price)" },
      { feature: "Setup fees", occta: "Setup from \u00A30 where available", competitor: "\u00A319 install fee typical" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 1Gbps" },
      { feature: "Network", occta: "Openreach", competitor: "Own full-fibre network" },
    ],
    summary: "If your building is Hyperoptic-enabled, they're an excellent choice. If not, OCCTA covers you with the same rolling-monthly flexibility on Openreach.",
    faqs: [
      { question: "Can I get Hyperoptic at my address?", answer: "Only if your building is enabled \u2014 mainly city apartment blocks. Check their coverage checker." },
      { question: "Which is faster \u2014 Hyperoptic or OCCTA?", answer: "Hyperoptic's 1Gbps tier edges OCCTA's 900Mbps on paper. In real-world use, both are more than enough for any household." },
      { question: "Can I switch from Hyperoptic to OCCTA?", answer: "Yes \u2014 you'll need to cancel Hyperoptic directly, then order OCCTA to activate on the day Hyperoptic ends." },
    ],
  },
  {
    slug: "occta-vs-ee",
    competitor: "EE",
    metaTitle: "OCCTA vs EE Broadband — Honest Comparison",
    metaDescription: "Compare OCCTA vs EE Broadband. Same Openreach network, very different pricing and contract flexibility.",
    keywords: "OCCTA vs EE, EE broadband alternative, cheaper than EE",
    heroTitle: "OCCTA vs EE",
    heroSubtitle: "Same fibre. Simpler bill.",
    intro: "EE (part of BT Group) resells the Openreach fibre network with mobile-bundle deals. OCCTA keeps it simple: same network, no lock-in, no bundle upsell.",
    points: [
      { feature: "Monthly price (superfast)", occta: "From \u00A334.99/mo", competitor: "From \u00A328/mo" },
      { feature: "Contract length", occta: "Flex 30-day or Price Lock 24", competitor: "24 months" },
      { feature: "Mid-contract price rises", occta: "None on Price Lock", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Setup from \u00A30 where available", competitor: "\u00A310\u2013\u00A335 activation" },
      { feature: "Bundled mobile", occta: "Optional add-on", competitor: "Discount if you also have EE mobile" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 1.6Gbps in Full Fibre areas" },
    ],
    summary: "EE is a solid pick if you're deep in the EE mobile ecosystem. Otherwise OCCTA delivers the same fibre with more contract flexibility and no annual CPI hike.",
    faqs: [
      { question: "Is EE Broadband the same as BT?", answer: "Same parent company (BT Group), same Openreach network, different branding and pricing." },
      { question: "Can I switch from EE to OCCTA?", answer: "Yes \u2014 One Touch Switch handles the whole switchover automatically." },
      { question: "Do I get a discount for having EE mobile?", answer: "With EE Broadband, yes. With OCCTA, our SIM plans stand on their own price and no bundling is required." },
    ],
  },
];

export const getComparisonBySlug = (slug: string): Comparison | undefined =>
  comparisons.find((c) => c.slug === slug);
