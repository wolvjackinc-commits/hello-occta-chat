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
    metaDescription: "Looking for cheap broadband near you? OCCTA offers affordable fibre broadband from \u00A322.99/mo with no contracts across the UK. Check your postcode now.",
    keywords: "cheap broadband near me, affordable broadband near me, broadband deals near me, internet near me cheap, best broadband near me, local broadband deals",
    heroTitle: "CHEAP BROADBAND",
    heroHighlight: "NEAR YOU",
    heroSubtitle: "Fast fibre internet from \u00A322.99/mo. No contracts. No credit check.",
    sections: [
      {
        heading: "Find Cheap Broadband at Your Address",
        paragraphs: [
          "When you search for \u201Ccheap broadband near me\u201D, you want to know exactly what\u2019s available at your address \u2014 not a generic price list. OCCTA uses the Openreach fibre network, which covers around 97% of UK homes, so there\u2019s a strong chance we can connect you.",
          "Simply enter your postcode above to check what speeds and plans are available. You\u2019ll see real pricing with no hidden fees.",
        ],
      },
      {
        heading: "Why OCCTA Is the Cheapest Option",
        paragraphs: ["Here\u2019s why OCCTA consistently beats the big providers on price:"],
        bullets: [
          "No contracts \u2014 rolling monthly, cancel anytime",
          "No mid-contract price rises \u2014 your price is fixed",
          "No credit check required",
          "Free installation and Wi-Fi router included",
          "No hidden setup fees or delivery charges",
          "Speeds up to 900Mbps on full fibre",
        ],
      },
      {
        heading: "How to Get Connected",
        paragraphs: [
          "Getting OCCTA broadband is simple. Check your postcode, choose a plan, and complete your order. Most installations are completed within 7 working days. Your router is included free, and there\u2019s no engineer visit needed for most FTTC connections.",
        ],
      },
    ],
    faqs: [
      { question: "How do I find the cheapest broadband near me?", answer: "Enter your postcode on our broadband page to see exact pricing and speeds available at your address. OCCTA plans start from \u00A322.99/mo with no contracts." },
      { question: "Is cheap broadband reliable?", answer: "Yes. OCCTA uses the same Openreach fibre network as BT, Sky, and Plusnet. You get the same infrastructure at a lower price." },
      { question: "Do I need a credit check for broadband?", answer: "Not with OCCTA. We don\u2019t run credit checks on any of our broadband plans." },
      { question: "Can I get broadband without a contract near me?", answer: "Yes. All OCCTA plans are rolling monthly with no lock-in and no exit fees." },
    ],
    ctaTitle: "Check Your Postcode",
    ctaText: "See exactly what broadband plans and speeds are available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "22.99",
  },
  {
    slug: "broadband-no-credit-check",
    metaTitle: "Broadband No Credit Check — Get Connected Today",
    metaDescription: "Need broadband with no credit check? OCCTA offers fast fibre broadband from \u00A322.99/mo with no credit check, no contract, and no hidden fees.",
    keywords: "broadband no credit check, internet no credit check, wifi no credit check, broadband without credit check UK, no credit check broadband deals",
    heroTitle: "BROADBAND",
    heroHighlight: "NO CREDIT CHECK",
    heroSubtitle: "Fast fibre internet. No credit check. No contracts. From \u00A322.99/mo.",
    sections: [
      {
        heading: "Why We Don\u2019t Run Credit Checks",
        paragraphs: [
          "Most big broadband providers run a hard credit check when you sign up, which can affect your credit score and may result in rejection. OCCTA takes a different approach \u2014 we believe everyone deserves access to fast, reliable internet.",
          "We don\u2019t check your credit history. There\u2019s no soft check, no hard check, and no risk to your credit score. If you want broadband, you can have it.",
        ],
      },
      {
        heading: "Who Benefits from No Credit Check Broadband?",
        paragraphs: ["No credit check broadband is ideal for:"],
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
          "No credit check doesn\u2019t mean slower speeds or worse service. OCCTA uses the same Openreach fibre network as BT and Sky. You get speeds up to 900Mbps, unlimited data, and UK-based support \u2014 all without a credit check.",
        ],
      },
    ],
    faqs: [
      { question: "Can I really get broadband without a credit check?", answer: "Yes. OCCTA does not run any credit checks \u2014 hard or soft \u2014 on any broadband plan." },
      { question: "Will no credit check broadband affect my credit score?", answer: "No. Since we don\u2019t check your credit, signing up with OCCTA has zero impact on your credit score." },
      { question: "Is no credit check broadband slower?", answer: "No. You get the same Openreach fibre speeds as any other provider \u2014 up to 900Mbps." },
      { question: "Do I need to pay a deposit?", answer: "No. There\u2019s no deposit, no upfront cost, and no hidden fees." },
    ],
    ctaTitle: "Get Connected Today",
    ctaText: "No credit check, no contract, no hassle. Enter your postcode to get started.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "22.99",
  },
  {
    slug: "broadband-for-students",
    metaTitle: "Student Broadband — No Contract Internet for Students",
    metaDescription: "Best broadband for students in the UK. No contract, no credit check, cancel anytime. OCCTA student-friendly internet from \u00A322.99/mo.",
    keywords: "student broadband, broadband for students UK, student internet deals, no contract broadband students, cheap broadband students, university broadband",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "STUDENTS",
    heroSubtitle: "No contract. No credit check. Cancel when you move out.",
    sections: [
      {
        heading: "Why Students Love OCCTA",
        paragraphs: [
          "Student accommodation changes every year, so a 24-month broadband contract makes no sense. OCCTA gives you fast fibre broadband on a rolling monthly basis \u2014 use it for the academic year, cancel when you leave. Simple.",
          "There\u2019s no credit check either, so you won\u2019t get rejected even if you have no credit history.",
        ],
      },
      {
        heading: "Perfect for Student Life",
        paragraphs: ["OCCTA broadband is built for how students actually use the internet:"],
        bullets: [
          "Unlimited data for streaming, gaming, and video calls",
          "Speeds up to 900Mbps for shared houses",
          "No contract \u2014 cancel when your lease ends",
          "No credit check \u2014 perfect for first-time subscribers",
          "Free router and installation included",
          "Split the bill easily \u2014 one simple monthly payment",
        ],
      },
      {
        heading: "How to Set Up Student Broadband",
        paragraphs: [
          "Check your student house postcode, choose a speed that suits your household, and complete the order online. Installation usually takes 7 working days. When you move out, just give us 30 days notice \u2014 no fees, no hassle.",
        ],
      },
    ],
    faqs: [
      { question: "Can students get broadband without a credit check?", answer: "Yes. OCCTA doesn\u2019t run credit checks, making it ideal for students with no credit history." },
      { question: "Can I cancel my student broadband when I move out?", answer: "Yes. All OCCTA plans are rolling monthly. Give us 30 days notice and you can cancel with no fees." },
      { question: "What speed do students need?", answer: "For a shared student house, we recommend at least 100Mbps. Our 300Mbps or 500Mbps plans are ideal for 4+ people." },
      { question: "Is there a student discount?", answer: "OCCTA\u2019s prices are already the lowest available, starting from \u00A322.99/mo with no price rises." },
    ],
    ctaTitle: "Get Student Broadband",
    ctaText: "Enter your student house postcode to check what\u2019s available.",
    ctaLink: "/broadband",
    ctaButton: "Check Your Postcode",
    price: "22.99",
  },
  {
    slug: "best-broadband-deals-uk",
    metaTitle: "Best Broadband Deals UK 2026 — Compare & Save",
    metaDescription: "Find the best broadband deals in the UK for 2026. Compare no-contract plans from \u00A322.99/mo. No hidden fees, no price rises, speeds up to 900Mbps.",
    keywords: "best broadband deals UK, best broadband deals 2026, cheapest broadband UK, broadband deals comparison, best internet deals, affordable broadband UK",
    heroTitle: "BEST BROADBAND",
    heroHighlight: "DEALS UK",
    heroSubtitle: "Compare plans. Find the best value. From \u00A322.99/mo.",
    sections: [
      {
        heading: "What Makes a Good Broadband Deal?",
        paragraphs: [
          "The best broadband deal isn\u2019t just the lowest headline price. You need to look at the total cost including setup fees, mid-contract price rises, and exit penalties. Many \u201Ccheap\u201D deals become expensive once you factor in CPI + 3.9% annual increases.",
          "A genuinely good deal means: fair price, good speed, transparent terms, and the freedom to leave if it\u2019s not working.",
        ],
      },
      {
        heading: "Why OCCTA Offers the Best Value",
        paragraphs: ["Here\u2019s what sets OCCTA apart from other broadband deals:"],
        bullets: [
          "From \u00A322.99/mo \u2014 one of the lowest prices in the UK",
          "No contracts \u2014 rolling monthly, cancel anytime",
          "No mid-contract price rises \u2014 your price is guaranteed",
          "No credit check required",
          "Free installation and Wi-Fi router",
          "Speeds up to 900Mbps on the Openreach network",
          "UK-based customer support",
        ],
      },
      {
        heading: "How OCCTA Compares",
        paragraphs: [
          "OCCTA uses the same Openreach fibre network as BT, Sky, Plusnet, and TalkTalk. You get identical infrastructure and comparable speeds \u2014 but without the contract, without the price rises, and at a lower monthly cost.",
        ],
      },
    ],
    faqs: [
      { question: "What is the cheapest broadband deal in the UK?", answer: "OCCTA offers broadband from \u00A322.99/mo with no hidden fees, no contracts, and no price rises \u2014 making it one of the best-value deals available." },
      { question: "Which broadband provider has the best deals?", answer: "For no-contract, fixed-price broadband, OCCTA consistently offers the best value compared to BT, Sky, Virgin Media, and TalkTalk." },
      { question: "Are cheap broadband deals any good?", answer: "Yes. OCCTA uses the same Openreach network as the major providers. Cheap doesn\u2019t mean slow or unreliable." },
      { question: "Should I get a contract or no-contract broadband?", answer: "No-contract gives you flexibility to switch or cancel anytime. With OCCTA, you don\u2019t pay more for this freedom." },
    ],
    ctaTitle: "Find Your Best Deal",
    ctaText: "Check what speeds and prices are available at your postcode.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "22.99",
  },
  {
    slug: "broadband-for-gaming",
    metaTitle: "Best Broadband for Gaming UK — Low Latency Internet",
    metaDescription: "Find the best broadband for gaming in the UK. Low latency, fast speeds up to 900Mbps, no contracts. OCCTA gaming broadband from \u00A322.99/mo.",
    keywords: "broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband, fast broadband gaming, gaming internet UK",
    heroTitle: "BROADBAND FOR",
    heroHighlight: "GAMING",
    heroSubtitle: "Fast speeds. Low latency. No lag. From \u00A322.99/mo.",
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
          "No contracts \u2014 upgrade or switch speeds anytime",
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
      { question: "Can I game on OCCTA without a contract?", answer: "Yes. All plans are rolling monthly \u2014 upgrade or downgrade your speed anytime without penalties." },
    ],
    ctaTitle: "Level Up Your Connection",
    ctaText: "Check what gaming-ready broadband speeds are available at your address.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "22.99",
  },
  {
    slug: "broadband-for-working-from-home",
    metaTitle: "Best Broadband for Working from Home — Reliable WFH Internet",
    metaDescription: "Best broadband for working from home. Reliable fibre, fast speeds, no contracts. OCCTA WFH broadband from \u00A322.99/mo. Video calls without buffering.",
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
          "No contracts \u2014 flexible if your work situation changes",
          "Free router with strong whole-home Wi-Fi",
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
      { question: "Do I need a contract for WFH broadband?", answer: "No. OCCTA is rolling monthly, so you can cancel or change speed anytime." },
    ],
    ctaTitle: "Work Without Interruption",
    ctaText: "Get reliable home office broadband. Check your postcode for availability.",
    ctaLink: "/broadband",
    ctaButton: "Check Availability",
    price: "22.99",
  },
];

export const getKeywordPageBySlug = (slug: string): KeywordPage | undefined =>
  keywordPages.find((p) => p.slug === slug);
