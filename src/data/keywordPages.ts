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

export const keywordPages: KeywordPage[] = [
  {
    slug: "cheap-broadband-near-me",
    metaTitle: "Cheap Broadband Near Me — Find Affordable Internet",
    metaDescription: "Looking for cheap broadband near you? OCCTA offers affordable fibre broadband from \u00A334.99/mo with 30-day rolling options where eligible across the UK. Check your postcode now.",
    keywords: "cheap broadband near me, affordable broadband near me, broadband deals near me, internet near me cheap, best broadband near me, local broadband deals",
    heroTitle: "CHEAP BROADBAND",
    heroHighlight: "NEAR YOU",
    heroSubtitle: "Fast fibre internet from \u00A334.99/mo. 30-day rolling options where eligible. No credit check.",
    sections: [
      {
        heading: "Find Cheap Broadband at Your Address",
        paragraphs: [
          "When you search for \u201Ccheap broadband near me\u201D, you want to know exactly what\u2019s available at your address \u2014 not a generic price list. OCCTA uses the Openreach fibre network, which covers around 97% of UK homes, so there\u2019s a strong chance we can connect you.",
          "Simply enter your postcode above to check what speeds and plans are available. You\u2019ll see real pricing with no surprise price rises.",
        ],
      },
      {
        heading: "Why OCCTA Is the Cheapest Option",
        paragraphs: ["Here\u2019s why OCCTA consistently beats the big providers on price:"],
        bullets: [
          "30-day rolling options available where eligible",
          "No mid-contract price rises \u2014 your price is fixed",
          "Eligibility requirements are shown before order",
          "Setup from £0 where available. Bring your own router for £0, or choose a router at checkout",
          "No hidden setup fees or delivery charges",
          "Speeds up to 900Mbps on full fibre",
        ],
      },
      {
        heading: "How to Get Connected",
        paragraphs: [
          "Getting OCCTA broadband is simple. Check your postcode, choose a plan, and complete your order. Installation timing and method depend on the address, network and existing service. Router choices, setup or engineer requirements, charges and the provisional service date are shown before acceptance.",
        ],
      },
    ],
    faqs: [
      { question: "How do I find the cheapest broadband near me?", answer: "Enter your postcode on our broadband page to see exact pricing and speeds available at your address. OCCTA plans start from \u00A334.99/mo with 30-day rolling options where eligible." },
      { question: "Is cheap broadband reliable?", answer: "Yes. OCCTA uses the same Openreach fibre network as BT, Sky, and Plusnet. You get the same infrastructure at a lower price." },
      { question: "Do I need a credit check for broadband?", answer: "Not with OCCTA. We don\u2019t run credit checks on any of our broadband plans." },
      { question: "Can I get broadband without a contract near me?", answer: "Yes. OCCTA offers Price Lock 24 and Flex 30 where eligible. The accepted agreement is the binding source of truth on term, notice and charges." },
    ],
    ctaTitle: "Check Your Postcode",
    ctaText: "See exactly what broadband plans and speeds are available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-no-credit-check",
    metaTitle: "Broadband No Credit Check — Get Connected Today",
    metaDescription: "Need broadband with no credit check? OCCTA offers fast fibre broadband from \u00A334.99/mo with no credit check, 30-day rolling options where eligible, and no surprise price rises.",
    keywords: "broadband no credit check, internet no credit check, wifi no credit check, broadband without credit check UK, no credit check broadband deals",
    heroTitle: "BROADBAND",
    heroHighlight: "NO CREDIT CHECK",
    heroSubtitle: "Fast fibre internet. No credit check. 30-day rolling options where eligible. From \u00A334.99/mo.",
    sections: [
      {
        heading: "Why We Don\u2019t Run Credit Checks",
        paragraphs: [
          "Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit.",
          "Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit.",
        ],
      },
      {
        heading: "Who Benefits from No Credit Check Broadband?",
        paragraphs: ["Eligibility requirements are shown before order"],
        bullets: [
          "People with a low or no credit score",
          "Those who have recently moved to the UK",
          "Young adults setting up their first home",
          "Anyone who has experienced financial difficulties",
          "People who simply value privacy",
        ],
      },
      {
        heading: "Same Speeds, Same Network",
        paragraphs: [
          "Eligibility requirements are shown before order",
        ],
      },
    ],
    faqs: [
      { question: "Can I really get broadband without a credit check?", answer: "Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit." },
      { question: "Will no credit check broadband affect my credit score?", answer: "Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit." },
      { question: "Is no credit check broadband slower?", answer: "No. You get the same Openreach fibre speeds as any other provider \u2014 up to 900Mbps." },
      { question: "Do I need to pay a deposit?", answer: "Any deposit, upfront or setup charge depends on the selected service and order. Exact one-off charges are shown before acceptance." },
    ],
    ctaTitle: "Get Connected Today",
    ctaText: "Eligibility requirements are shown before order",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-students",
    metaTitle: "Student Broadband — Flexible-Term Internet for Students",
    metaDescription: "Best broadband for students in the UK. Flex 30, no credit check, 30-day rolling options available where eligible. OCCTA student-friendly internet from \u00A334.99/mo.",
    keywords: "student broadband, broadband for students UK, student internet deals, 30-day rolling options where eligible broadband students, cheap broadband students, university broadband",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "STUDENTS",
    heroSubtitle: "Flex 30 or Price Lock 24. Clear setup, moving-home and cancellation terms.",
    sections: [
      {
        heading: "Why Students Love OCCTA",
        paragraphs: [
          "Student accommodation can change frequently. Compare Flex 30 with Price Lock 24 and choose the term that fits your expected stay. Moving home, setup, notice and any applicable charges follow the accepted agreement.",
          "Any identity, credit or eligibility checks depend on the selected service and current ordering process. The order journey explains what applies before you commit.",
        ],
      },
      {
        heading: "Perfect for Student Life",
        paragraphs: ["OCCTA broadband is built for how students actually use the internet:"],
        bullets: [
          "Unlimited data for streaming, gaming, and video calls",
          "Speeds up to 900Mbps for shared houses",
          "Flex 30 \u2014 cancel when your lease ends",
          "Eligibility requirements are shown before order",
          "Bring your own router for £0, or choose a router at checkout. Setup from £0 where available",
          "Split the bill easily \u2014 one simple monthly payment",
        ],
      },
      {
        heading: "How to Set Up Student Broadband",
        paragraphs: [
          "Check your student house postcode, choose a speed that suits your household, and complete the order online. Installation timing depends on the address, network and whether engineering work is required. The provisional service date and any applicable setup or engineer charge are shown before acceptance.",
        ],
      },
    ],
    faqs: [
      { question: "Can students get broadband without a credit check?", answer: "Yes. OCCTA doesn\u2019t run credit checks, making it ideal for students with no credit history." },
      { question: "Can I cancel my student broadband when I move out?", answer: "Yes. OCCTA offers Price Lock 24 and Flex 30 where eligible. The accepted agreement is the binding source of truth on term, notice and charges." },
      { question: "What speed do students need?", answer: "For a shared student house, we recommend at least 100Mbps. Our 300Mbps or 500Mbps plans are ideal for 4+ people." },
      { question: "Is there a student discount?", answer: "OCCTA\u2019s prices are already the lowest available, starting from \u00A334.99/mo with no mid-contract price hikes." },
    ],
    ctaTitle: "Get Student Broadband",
    ctaText: "Enter your student house postcode to check what\u2019s available.",
    ctaLink: "/broadband",
    ctaButton: "Check Your Postcode",
    price: "34.99",
  },
  {
    slug: "best-broadband-deals-uk",
    metaTitle: "Best Broadband Deals UK 2026 — Compare & Save",
    metaDescription: "Find the best broadband deals in the UK for 2026. Compare no-contract plans from \u00A334.99/mo. No hidden fees, no mid-contract price hikes, speeds up to 900Mbps.",
    keywords: "best broadband deals UK, best broadband deals 2026, cheapest broadband UK, broadband deals comparison, best internet deals, affordable broadband UK",
    heroTitle: "BEST BROADBAND",
    heroHighlight: "DEALS UK",
    heroSubtitle: "Compare plans. Find the best value. From \u00A334.99/mo.",
    sections: [
      {
        heading: "What Makes a Good Broadband Deal?",
        paragraphs: [
          "The best broadband deal isn\u2019t just the lowest headline price. You need to look at the total cost including setup fees, mid-contract price rises, and exit penalties. Scheduled price changes vary by provider and tariff. Compare the pounds-and-pence price-change information shown before sign-up together with setup, equipment and termination costs.",
          "A genuinely good deal means: fair price, good speed, transparent terms, and the freedom to leave if it\u2019s not working.",
        ],
      },
      {
        heading: "Why OCCTA Offers the Best Value",
        paragraphs: ["Here\u2019s what sets OCCTA apart from other broadband deals:"],
        bullets: [
          "Price Lock 24 headline pricing from \u00A334.99/mo; Flex 30 priced separately where offered",
          "30-day rolling options available where eligible",
          "No scheduled CPI-, RPI-, inflation-linked or percentage-based rise on Price Lock 24 under contract version 2026.10.1",
          "Eligibility requirements are shown before order",
          "Setup from £0 where available; router options and any charge are shown before acceptance",
          "Speeds up to 900Mbps on the Openreach network",
          "UK-based customer support",
        ],
      },
      {
        heading: "How OCCTA Compares",
        paragraphs: [
          "The underlying access network depends on the address and selected supplier product. OCCTA remains your retail provider unless we tell you otherwise.",
        ],
      },
    ],
    faqs: [
      { question: "What is the cheapest broadband deal in the UK?", answer: "OCCTA Price Lock 24 headline pricing starts from \u00A334.99/mo, with Flex 30 priced separately where offered. Final price, speed information, setup and router choices depend on the address and selected service." },
      { question: "Which broadband provider has the best deals?", answer: "Value depends on your address, required speed, term, setup and competing offers. Compare the total cost and contract terms before ordering." },
      { question: "Are cheap broadband deals any good?", answer: "Network technology and supplier vary by address. The exact access technology and address-specific speed information are confirmed before acceptance." },
      { question: "Should I get a contract or no-contract broadband?", answer: "Flex 30 gives you a 30-day rolling option with no fixed minimum term where eligible. Price Lock 24 has a 24-month minimum term and may offer a lower headline monthly price. Compare the accepted term, notice and termination charges." },
    ],
    ctaTitle: "Find Your Best Deal",
    ctaText: "Check what speeds and prices are available at your postcode.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-gaming",
    metaTitle: "Best Broadband for Gaming UK — Low Latency Internet",
    metaDescription: "Find the best broadband for gaming in the UK. Low latency, fast speeds up to 900Mbps, 30-day rolling options where eligible. OCCTA gaming broadband from \u00A334.99/mo.",
    keywords: "broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband, fast broadband gaming, gaming internet UK",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "GAMING",
    heroSubtitle: "Fast speeds. Low latency. No lag. From \u00A334.99/mo.",
    sections: [
      {
        heading: "What Gamers Need from Broadband",
        paragraphs: [
          "For online gaming, speed matters \u2014 but latency (ping) matters more. A fast, stable fibre connection gives you the low ping and consistent performance you need for competitive gaming. OCCTA\u2019s fibre broadband delivers exactly that.",
          "Whether you\u2019re playing FPS shooters, MMOs, or streaming on Twitch, you need a connection that doesn\u2019t let you down.",
        ],
      },
      {
        heading: "Why OCCTA Is Great for Gaming",
        paragraphs: ["OCCTA broadband gives gamers everything they need:"],
        bullets: [
          "Speeds up to 900Mbps \u2014 fast enough for any game",
          "Low latency on the Openreach fibre network",
          "Unlimited data \u2014 no throttling or fair usage caps",
          "Upgrade or switch speeds where eligible",
          "Perfect for streaming and downloading large game files",
          "Supports multiple devices without slowdown",
        ],
      },
      {
        heading: "Which Speed Is Best for Gaming?",
        paragraphs: [
          "For solo gaming, 36Mbps is sufficient. If you stream on Twitch or YouTube while gaming, we recommend 150Mbps+. For households with multiple gamers, our 500Mbps or 900Mbps plans ensure everyone has a smooth experience.",
        ],
      },
    ],
    faqs: [
      { question: "What speed do I need for gaming?", answer: "36Mbps is enough for most online games. For streaming + gaming, aim for 150Mbps. For households with multiple gamers, 500Mbps+ is ideal." },
      { question: "Is fibre broadband better for gaming?", answer: "Yes. Fibre connections offer lower latency (ping) and more consistent speeds than copper or 4G/5G connections." },
      { question: "Does OCCTA throttle gaming traffic?", answer: "No. OCCTA does not throttle, shape, or cap any traffic. All data is unlimited and unrestricted." },
      { question: "Can I game on a flexible OCCTA plan?", answer: "Flex 30 is a 30-day rolling option where available. Price Lock 24 has a 24-month minimum term. Plan changes depend on address availability and the terms shown before you agree the change." },
    ],
    ctaTitle: "Level Up Your Connection",
    ctaText: "Check what gaming-ready broadband speeds are available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-for-working-from-home",
    metaTitle: "Best Broadband for Working from Home — Reliable WFH Internet",
    metaDescription: "Best broadband for working from home. Reliable fibre, fast speeds, 30-day rolling options where eligible. OCCTA WFH broadband from \u00A334.99/mo. Video calls without buffering.",
    keywords: "broadband for working from home, WFH broadband, remote working internet, home office broadband, reliable broadband working from home",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "WORKING FROM HOME",
    heroSubtitle: "Reliable internet for video calls, file sharing, and remote work.",
    sections: [
      {
        heading: "Why Reliable Broadband Matters for WFH",
        paragraphs: [
          "When your office is your home, your broadband IS your business tool. Dropped video calls, slow uploads, and unreliable connections cost you time and credibility. OCCTA fibre broadband gives you the stable, fast connection you need to work productively from home.",
        ],
      },
      {
        heading: "Perfect for Remote Workers",
        paragraphs: ["OCCTA broadband is ideal for working from home:"],
        bullets: [
          "Stable fibre connection for uninterrupted video calls",
          "Fast upload speeds for file sharing and cloud apps",
          "Unlimited data \u2014 no caps even during peak hours",
          "Speeds up to 900Mbps for heavy workloads",
          "Flexible if your work situation changes",
          "Bring your own router for £0, or choose a router at checkout with strong whole-home Wi-Fi",
        ],
      },
      {
        heading: "Recommended Speeds for WFH",
        paragraphs: [
          "For basic email and web browsing, 36Mbps is fine. For regular video conferencing (Zoom, Teams), we recommend at least 80Mbps. If multiple people work from home in the same household, 300Mbps or higher ensures everyone can work without slowdown.",
        ],
      },
    ],
    faqs: [
      { question: "What speed do I need for working from home?", answer: "80Mbps is ideal for solo remote workers. For households with multiple remote workers, 300Mbps+ is recommended." },
      { question: "Is OCCTA broadband reliable enough for video calls?", answer: "Yes. Our fibre connection provides consistent speeds and low latency, ideal for Zoom, Teams, and Google Meet." },
      { question: "Can I claim broadband as a business expense?", answer: "You may be able to claim a proportion of your broadband cost as a business expense. Check with your accountant or HMRC." },
      { question: "Do I need a contract for WFH broadband?", answer: "No. Flex 30 is a 30-day rolling option where available; Price Lock 24 has a 24-month minimum term. Any plan change is subject to availability and the agreed terms." },
    ],
    ctaTitle: "Work Without Interruption",
    ctaText: "Get reliable home office broadband. Check your postcode for availability.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "34.99",
  },
  {
    slug: "broadband-no-upfront-cost",
    metaTitle: "Broadband With No Upfront Cost — £0 Setup Where Available",
    metaDescription: "Broadband with no upfront cost. OCCTA full-fibre from \u00A334.99/mo, £0 setup where available, bring your own router for £0. No hidden activation fees.",
    keywords: "broadband no upfront cost, broadband no setup fee, no upfront cost broadband, free setup broadband, broadband no activation fee, no upfront broadband uk",
    heroTitle: "BROADBAND WITH",
    heroHighlight: "NO UPFRONT COST",
    heroSubtitle: "Full-fibre broadband from \u00A334.99/mo. \u00A30 setup where available. Bring your own router for \u00A30. No hidden activation fees.",
    sections: [
      {
        heading: "What \u201CNo Upfront Cost\u201D Actually Means",
        paragraphs: [
          "Most big UK ISPs advertise a low monthly headline price, then add £30\u2013£60 in setup, activation, delivery, or router fees before your service even starts. OCCTA does it differently \u2014 setup is £0 on most full-fibre addresses, you can bring your own router for £0, and your first bill is shown to you in plain English on the Contract Summary before you commit.",
          "If your address needs an engineer-led install (some SoGEA copper-to-fibre transitions, for example), we show the setup fee on the Contract Summary before you pay anything. You will never be surprised by a charge after you order.",
        ],
      },
      {
        heading: "Why OCCTA Has No Upfront Cost on Most Plans",
        paragraphs: ["Here is exactly what you pay before service starts on a standard OCCTA full-fibre order:"],
        bullets: [
          "\u00A30 setup fee on most full-fibre (FTTP) addresses",
          "\u00A30 router \u2014 bring your own, or choose one at checkout",
          "\u00A30 delivery on bring-your-own-router orders",
          "\u00A30 activation fee \u2014 we don\u2019t charge to switch you on",
          "No deposit, no credit-check fee, no upfront contract payment",
          "First monthly payment by Direct Debit, in arrears, after your service is live",
        ],
      },
      {
        heading: "How OCCTA Compares on Upfront Cost",
        paragraphs: [
          "Major UK ISPs commonly charge between £30 and £60 upfront in setup, activation, router or delivery fees, on top of the first monthly bill. With OCCTA on a standard full-fibre order, that upfront cost is typically £0 \u2014 and any fee that does apply at your address is shown on the Contract Summary before you order, not buried in the small print.",
          "You also pay in arrears: your first invoice arrives after the first month of service, not before it starts. That keeps the cost-to-get-connected as close to zero as we can honestly make it.",
        ],
      },
      {
        heading: "Check Your Address \u2014 See Your Exact Upfront Cost",
        paragraphs: [
          "Enter your postcode at the top of the page. We\u2019ll show the plans available at your address, the exact setup fee (£0 on most full-fibre), and a clear estimated first bill before you commit. Nothing hidden, nothing surprise-added at checkout.",
        ],
      },
    ],
    faqs: [
      { question: "Is OCCTA broadband really no upfront cost?", answer: "On most full-fibre (FTTP) addresses, yes \u2014 setup is £0, delivery is £0 if you bring your own router, and there is no activation fee. If your address needs an engineer-led install with a setup charge, we show it on the Contract Summary before you pay anything." },
      { question: "Do I have to pay for a router upfront?", answer: "No. You can bring your own router for £0, or choose one at checkout. We never force a router rental onto your bill." },
      { question: "When do I make my first payment?", answer: "OCCTA bills in arrears. Your first invoice is issued after your first month of service and collected by Direct Debit 14 days later \u2014 so you never pay for service before you get it." },
      { question: "Are there hidden activation or connection fees?", answer: "No. We do not charge an activation fee, a connection fee, or a credit-check fee. The only upfront cost (if any) at your address is the setup fee shown on your Contract Summary." },
      { question: "Do I need to pay a deposit?", answer: "No. OCCTA does not take deposits or upfront contract payments." },
      { question: "What if my address needs a paid engineer install?", answer: "Some SoGEA copper-to-fibre conversions can attract a setup fee. If that applies at your address, the exact amount is shown on the Contract Summary before you order \u2014 you decide whether to proceed with full visibility." },
    ],
    ctaTitle: "See Your Upfront Cost Before You Order",
    ctaText: "Check your postcode \u2014 we\u2019ll show plans, setup fee, and your estimated first bill before you commit.",
    ctaLink: "/broadband",
    ctaButton: "Check My Address",
    price: "34.99",
  },
];

export const getKeywordPageBySlug = (slug: string): KeywordPage | undefined =>
  keywordPages.find((p) => p.slug === slug);
