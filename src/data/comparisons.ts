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
      { feature: "Monthly price (superfast)", occta: "From \u00A322.99/mo", competitor: "From \u00A331.99/mo" },
      { feature: "Contract length", occta: "No contract \u2014 rolling monthly", competitor: "24-month contract" },
      { feature: "Mid-contract price rises", occta: "None \u2014 price fixed", competitor: "CPI + 3.9% annual increase" },
      { feature: "Setup fees", occta: "Free installation & router", competitor: "\u00A39.99\u2013\u00A359.99 setup fee" },
      { feature: "Exit fees", occta: "None \u2014 cancel anytime", competitor: "Up to \u00A3230+ early termination" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 900Mbps" },
    ],
    summary: "BT and OCCTA use the same Openreach network, so speeds and reliability are comparable. The difference is price and flexibility. With OCCTA, you pay less, keep the same price every month, and can leave whenever you want \u2014 no penalties, no hassle.",
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
      { feature: "Monthly price (superfast)", occta: "From \u00A322.99/mo", competitor: "From \u00A329/mo" },
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
      { feature: "Monthly price (superfast)", occta: "From \u00A322.99/mo", competitor: "From \u00A333/mo" },
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
      { feature: "Monthly price (superfast)", occta: "From \u00A322.99/mo", competitor: "From \u00A324/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18 or 24 months" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.7% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "Free (promotional)" },
      { feature: "Exit fees", occta: "None", competitor: "Up to \u00A3240+" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 500Mbps" },
    ],
    summary: "TalkTalk competes on price but still locks you into contracts with annual increases. OCCTA gives you the same budget pricing with more speed options and complete flexibility.",
    faqs: [
      { question: "Is OCCTA cheaper than TalkTalk?", answer: "OCCTA starts from \u00A322.99/mo. When you factor in TalkTalk\u2019s annual price rises, OCCTA is often cheaper over 12 months." },
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
      { feature: "Monthly price (superfast)", occta: "From \u00A322.99/mo", competitor: "From \u00A325.99/mo" },
      { feature: "Contract length", occta: "No contract", competitor: "18 or 24 months" },
      { feature: "Mid-contract price rises", occta: "None", competitor: "CPI + 3.9% annual" },
      { feature: "Setup fees", occta: "Free", competitor: "\u00A35\u2013\u00A310 activation" },
      { feature: "Exit fees", occta: "None", competitor: "Remaining contract charges" },
      { feature: "Credit check required", occta: "No", competitor: "Yes" },
      { feature: "Network used", occta: "Openreach", competitor: "Openreach" },
      { feature: "Speeds available", occta: "Up to 900Mbps", competitor: "Up to 500Mbps" },
    ],
    summary: "Plusnet offers decent value but still ties you into contracts with annual increases. OCCTA delivers the same Openreach broadband with faster speed options, no lock-in, and a price that never changes.",
    faqs: [
      { question: "Is OCCTA better value than Plusnet?", answer: "Yes. OCCTA is cheaper, has faster top speeds, and doesn\u2019t increase your price mid-contract." },
      { question: "Does OCCTA use the same network as Plusnet?", answer: "Yes. Both use the Openreach fibre network." },
      { question: "Can I switch from Plusnet to OCCTA easily?", answer: "Yes. The One Touch Switch process handles the transfer automatically." },
    ],
  },
];

export const getComparisonBySlug = (slug: string): Comparison | undefined =>
  comparisons.find((c) => c.slug === slug);
