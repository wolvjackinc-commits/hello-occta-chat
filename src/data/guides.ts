export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface GuideFAQ {
  question: string;
  answer: string;
}

export interface GuideHowToStep {
  name: string;
  text: string;
}

export interface GuideHowTo {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration, e.g. "PT15M"
  steps: GuideHowToStep[];
}

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  category: 'broadband' | 'home-phone' | 'sim';
  categoryLabel: string;
  intro: string;
  sections: GuideSection[];
  faqs: GuideFAQ[];
  howTo?: GuideHowTo;
  /** ISO date (YYYY-MM-DD). Used for Article datePublished/dateModified in JSON-LD. */
  datePublished?: string;
  dateModified?: string;
  ctaText: string;
  ctaLink: string;
  relatedSlugs: string[];
}

export const guides: Guide[] = [
  {
    slug: 'no-contract-broadband-uk',
    title: 'No Contract Broadband UK: The Complete Guide',
    metaTitle: 'No Contract Broadband UK — Flexible Internet',
    description: 'Looking for no contract broadband in the UK? Learn how rolling monthly broadband works, who it suits, and how to get connected without lock-ins or exit fees.',
    keywords: 'no contract broadband UK, flexible broadband, flexible broadband, rolling monthly broadband, no lock-in broadband, no exit fee broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Fed up with 18 or 24-month broadband contracts? You are not alone. More UK households are switching to no-contract broadband — rolling monthly plans that let you 30-day rolling options available where eligible without exit fees. Here is everything you need to know.',
    sections: [
      {
        heading: 'What Is No Contract Broadband?',
        paragraphs: [
          'No contract broadband — sometimes called rolling monthly or flexible broadband — means you pay month to month with no fixed term. You can cancel, upgrade, or downgrade at any time without penalty.',
          'Traditional providers lock you in for 18–24 months. If you leave early, you pay an exit fee that can run into hundreds of pounds. With no-contract broadband, that simply does not apply.',
        ],
      },
      {
        heading: 'Who Is It Best For?',
        paragraphs: ['No-contract broadband suits a wide range of situations:'],
        bullets: [
          'Renters who move frequently and cannot commit to long contracts',
          'Students in short-term accommodation',
          'Anyone trialling a new provider before fully committing',
          'Households that want flexibility without surprise price rises',
          'Remote workers who may relocate at short notice',
        ],
      },
      {
        heading: 'How Much Does It Cost?',
        paragraphs: [
          'At OCCTA, no-contract broadband starts from just £34.99 per month. You get the same speeds, the same unlimited data, and the same UK-based support as any contract plan — but without the tie-in.',
          'Many providers charge a premium for flexibility. We believe broadband should be simple: one price, no hidden fees, no mid-contract price rises.',
        ],
      },
      {
        heading: 'How to Get Started',
        paragraphs: [
          'Getting set up is straightforward. Check your postcode on our broadband page, choose a speed tier, and complete your order. Installation typically takes around 7 working days, and your router options available at checkout.',
        ],
      },
    ],
    faqs: [
      { question: 'Is no contract broadband slower than contract broadband?', answer: 'No. At OCCTA, you get the same speeds regardless of contract type — up to 900Mbps on our fastest plan.' },
      { question: 'Can I cancel at any time?', answer: 'Yes. Give us 30 days notice and you can leave whenever you like, no exit fees.' },
      { question: 'Is there a setup fee?', answer: 'Setup from £0 where available during promotional periods. Check our broadband page for the latest offers.' },
      { question: 'Do I need to return the router?', answer: 'Yes, the router should be returned if you cancel within the first 12 months.' },
    ],
    ctaText: 'View Broadband Plans',
    ctaLink: '/broadband',
    relatedSlugs: ['cheap-broadband-uk', 'how-to-switch-broadband'],
  },
  {
    slug: 'cheap-broadband-uk',
    title: 'Cheap Broadband UK: How to Find Affordable Internet',
    metaTitle: 'Cheap Broadband UK — Affordable Internet Plans',
    description: 'Find genuinely cheap broadband in the UK without sacrificing speed or reliability. Compare what matters and avoid hidden costs.',
    keywords: 'cheap broadband UK, affordable broadband, budget broadband, cheapest internet UK, low cost broadband, best value broadband UK',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Searching for cheap broadband in the UK? With dozens of providers advertising low headline prices, it can be hard to spot genuine value. This guide cuts through the noise and explains what to look for.',
    sections: [
      {
        heading: 'What Makes Broadband "Cheap"?',
        paragraphs: [
          'The cheapest broadband is not always the one with the lowest headline price. Watch out for setup fees, mid-contract price rises, and equipment charges that inflate the real cost.',
          'A plan advertised at £20 per month can easily cost £25+ once you factor in annual CPI increases and router delivery fees. Always calculate the total cost over the plan length.',
        ],
      },
      {
        heading: 'Hidden Costs to Watch For',
        paragraphs: ['Before signing up, check for these common traps:'],
        bullets: [
          'Mid-contract price rises (CPI + 3.9% is common with large providers)',
          'Router delivery or postage charges',
          'Early termination fees if you need to cancel',
          'Out-of-contract price hikes when your deal ends',
          'Premium line rental bundled in by default',
        ],
      },
      {
        heading: 'OCCTA: Transparent Pricing',
        paragraphs: [
          'At OCCTA, the price you see is the price you pay. Our broadband starts from £34.99 per month with no setup fees, no mid-contract rises, and no exit penalties. We include the router and unlimited data as standard.',
          'We are a UK company with UK-based support. No call centres abroad, no endless hold music.',
        ],
      },
      {
        heading: 'Tips for Saving on Broadband',
        paragraphs: ['Here are practical steps to keep your broadband bill low:'],
        bullets: [
          'Choose only the speed you actually need — most households are fine on 80Mbps',
          'Avoid bundled TV packages if you use streaming services',
          'Pick a no-contract provider so you can switch if a better deal appears',
          'Add Digital Home Phone only if you use a landline regularly',
        ],
      },
    ],
    faqs: [
      { question: 'What is the cheapest broadband in the UK?', answer: 'OCCTA offers broadband from £34.99 per month with no hidden fees, no contracts, and speeds up to 900Mbps.' },
      { question: 'Are there any hidden fees?', answer: 'Not with OCCTA. The price advertised is the price you pay, including router and unlimited data.' },
      { question: 'Is cheap broadband reliable?', answer: 'Yes. Our network delivers the same fibre infrastructure used by larger providers. Speed and reliability are not compromised.' },
    ],
    ctaText: 'See Our Plans',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk', 'how-to-switch-broadband'],
  },
  {
    slug: 'how-to-switch-broadband',
    title: 'How to Switch Broadband Provider in the UK',
    metaTitle: 'How to Switch Broadband — Step by Step Guide',
    description: 'A step-by-step guide to switching broadband provider in the UK. Learn about the One Touch Switch process, what to expect, and how to avoid downtime.',
    keywords: 'switch broadband UK, change broadband provider, how to switch internet, One Touch Switch, broadband switching guide',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Switching broadband used to be a hassle, but the UK One Touch Switch process has made it much simpler. Here is a practical guide to changing provider with minimal disruption.',
    sections: [
      {
        heading: 'The One Touch Switch Process',
        paragraphs: [
          'Since April 2023, most UK broadband switches are handled through the One Touch Switch (OTS) system. You simply sign up with your new provider and they handle the switch with your old one — no need to contact your current provider separately.',
          'The process typically takes 10–14 working days from placing your order.',
        ],
      },
      {
        heading: 'Step-by-Step: How to Switch',
        paragraphs: ['Follow these steps for a smooth switch:'],
        bullets: [
          'Check your current contract — are you in a fixed term? If so, calculate any exit fees',
          'Choose your new provider and plan (check your postcode for availability)',
          'Place your order — your new provider contacts your old one automatically',
          'Wait for your activation date (usually 10–14 working days)',
          'Your old service stops and new service starts on the same day, minimising downtime',
        ],
      },
      {
        heading: 'Will I Lose Internet During the Switch?',
        paragraphs: [
          'In most cases, the switch happens on the same day so downtime is minimal — typically a few hours while the line is reconfigured. If you work from home, consider using mobile data as a backup on switch day.',
        ],
      },
      {
        heading: 'Switching to OCCTA',
        paragraphs: [
          'Switching to OCCTA is straightforward. Enter your postcode on our broadband page, choose a plan, and we handle the rest. There is no minimum term, so if it does not work out, you can switch again without penalty.',
        ],
      },
    ],
    faqs: [
      { question: 'Do I need to cancel with my old provider?', answer: 'No. Under the One Touch Switch process, your new provider handles the cancellation automatically.' },
      { question: 'Will I keep my phone number?', answer: 'In most cases, yes. If you have a landline number, it can usually be ported to your new provider.' },
      { question: 'How long does switching take?', answer: 'Typically 10–14 working days from placing your order.' },
      { question: 'What if I am still in contract?', answer: 'You can still switch, but your old provider may charge an early termination fee. Check your contract terms.' },
    ],
    ctaText: 'Switch to OCCTA',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk', 'cheap-broadband-uk'],
  },
  {
    slug: 'digital-voice-uk',
    title: 'Digital Voice UK: What You Need to Know',
    metaTitle: 'Digital Voice UK — Home Phone Over Broadband',
    description: 'Everything you need to know about Digital Voice — the new way home phones work over broadband. How it works, what you need, and why the UK is switching.',
    keywords: 'digital voice UK, digital home phone, VoIP home phone, home phone broadband, landline over broadband, digital phone line',
    category: 'home-phone',
    categoryLabel: 'Home Phone',
    intro: 'Digital Voice is the new standard for home phones in the UK. Instead of using the old copper phone line, your calls travel over your broadband connection. Here is what that means for you.',
    sections: [
      {
        heading: 'How Does Digital Voice Work?',
        paragraphs: [
          'Digital Voice uses your broadband connection to make and receive phone calls. Your phone plugs into your broadband router rather than a wall socket. The technology is called VoIP (Voice over Internet Protocol) and it delivers clearer, more reliable calls than the old analogue system.',
          'You keep your existing phone number and can use your existing handset — just plug it into the phone port on your router.',
        ],
      },
      {
        heading: 'Why Is the UK Switching to Digital Voice?',
        paragraphs: [
          'The traditional copper phone network (PSTN) is being retired across the UK by 2027. Every provider — BT, Sky, TalkTalk, and others — is moving customers to digital phone lines. This is not optional; the old network is being physically switched off.',
          'Digital Voice offers better call quality, more features, and is cheaper to maintain than the ageing copper infrastructure.',
        ],
      },
      {
        heading: 'What Do I Need?',
        paragraphs: ['To use Digital Voice, you need:'],
        bullets: [
          'An active broadband connection (Digital Voice requires broadband to work)',
          'A broadband router with a phone port (included with OCCTA broadband)',
          'A standard home phone handset (most existing phones work)',
        ],
      },
      {
        heading: 'OCCTA Digital Home Phone',
        paragraphs: [
          'OCCTA offers Digital Home Phone from just £4.95 per month as an add-on to any broadband plan. You get HD voice quality, caller display, and free voicemail. Optional call plans let you add unlimited UK calls or international minutes.',
        ],
      },
    ],
    faqs: [
      { question: 'Can I keep my existing phone number?', answer: 'Yes. In most cases your number can be ported to your OCCTA Digital Home Phone service.' },
      { question: 'Does Digital Voice work during a power cut?', answer: 'No. Because Digital Voice uses your broadband router, it requires electricity. Keep a charged mobile phone for emergencies.' },
      { question: 'Can I use my existing phone handset?', answer: 'Yes. Most standard home phone handsets work by plugging into the phone port on your broadband router.' },
      { question: 'Is Digital Voice the same as VoIP?', answer: 'Yes. Digital Voice is the consumer-friendly name for VoIP (Voice over Internet Protocol) home phone services.' },
    ],
    ctaText: 'View Home Phone Plans',
    ctaLink: '/landline',
    relatedSlugs: ['pstn-switch-off-uk', 'no-contract-broadband-uk'],
  },
  {
    slug: 'pstn-switch-off-uk',
    title: 'PSTN Switch-Off UK: What Happens to Your Landline',
    metaTitle: 'UK PSTN Switch-Off — Copper Line Shutdown',
    description: 'The UK PSTN copper phone network is shutting down by 2027. Find out what this means for your home phone, what to do, and how Digital Voice replaces it.',
    keywords: 'PSTN switch off UK, copper line shutdown, BT landline switch off, digital switchover UK, PSTN retirement, analogue phone shutdown',
    category: 'home-phone',
    categoryLabel: 'Home Phone',
    intro: 'The UK is switching off its traditional copper phone network by 2027. If you still have a standard landline plugged into a wall socket, this change will affect you. Here is what you need to know and do.',
    sections: [
      {
        heading: 'What Is the PSTN Switch-Off?',
        paragraphs: [
          'PSTN stands for Public Switched Telephone Network — the copper-wire phone system that has served the UK since the 1800s. Openreach (the company that maintains the network) is retiring this infrastructure and replacing it with digital phone lines that run over broadband.',
          'This affects every UK household and business that uses a traditional landline.',
        ],
      },
      {
        heading: 'When Is It Happening?',
        paragraphs: [
          'The switch-off is being rolled out area by area. Openreach aims to complete the process by January 2027. Some areas have already been switched. Your provider should notify you before your area is affected.',
          'New connections on the old copper network stopped in September 2023. All new phone lines are now digital.',
        ],
      },
      {
        heading: 'What Do I Need to Do?',
        paragraphs: ['To prepare for the switch-off:'],
        bullets: [
          'Ensure you have a broadband connection (Digital Voice requires broadband)',
          'Check that your router has a phone port for plugging in your handset',
          'Contact your provider to arrange the switch, or move to a provider like OCCTA that offers Digital Voice',
          'Consider keeping a charged mobile phone as a backup during power cuts',
          'If you use a telecare alarm or monitored security system, check it is compatible with digital lines',
        ],
      },
      {
        heading: 'OCCTA Digital Home Phone',
        paragraphs: [
          'OCCTA Digital Home Phone is already fully digital — no copper line needed. From £4.95 per month as a broadband add-on, it includes HD voice, caller display, and voicemail. You can add unlimited UK or international calling plans too.',
        ],
      },
    ],
    faqs: [
      { question: 'Will my landline stop working?', answer: 'Your traditional analogue landline will stop working when your area is switched off. You will need to move to a Digital Voice service that works over broadband.' },
      { question: 'Do I have to pay more for Digital Voice?', answer: 'OCCTA Digital Home Phone starts at £4.95 per month, which is typically less than a traditional line rental.' },
      { question: 'What about my alarm system?', answer: 'Some older telecare and alarm systems that use the phone line may not work over digital. Check with your alarm provider for compatibility.' },
      { question: 'Can I keep my phone number?', answer: 'Yes. Number porting is available when you switch to Digital Voice.' },
    ],
    ctaText: 'Get Digital Home Phone',
    ctaLink: '/landline',
    relatedSlugs: ['digital-voice-uk', 'cheap-broadband-uk'],
  },
  {
    slug: 'cheap-sim-only-deals',
    title: 'Cheap SIM Only Deals UK: Best Budget Plans',
    metaTitle: 'Cheap SIM Only Deals UK — Budget Mobile Plans',
    description: 'Find the best cheap SIM only deals in the UK. No credit check, no contracts, 5G included. Compare what matters and avoid overpaying for mobile.',
    keywords: 'cheap SIM only UK, budget SIM deals, cheap mobile plans, SIM only no contract, best SIM deals UK, no credit check SIM',
    category: 'sim',
    categoryLabel: 'SIM Plans',
    intro: 'Looking for a cheap SIM only deal in the UK? With so many options available, it is easy to overpay for data you do not use or get locked into a contract you do not need. Here is how to find genuine value.',
    sections: [
      {
        heading: 'What Is a SIM Only Deal?',
        paragraphs: [
          'A SIM only deal gives you a mobile plan — data, calls, and texts — without a handset. You use your existing phone and just swap in the new SIM card. Because there is no phone to pay off, SIM only deals are significantly cheaper than handset contracts.',
        ],
      },
      {
        heading: 'What to Look For',
        paragraphs: ['When comparing cheap SIM only deals, focus on these factors:'],
        bullets: [
          'Data allowance — choose based on your actual usage, not marketing hype',
          'Network coverage — check 5G and 4G coverage in your area',
          'Contract length — 30-day rolling gives you flexibility',
          'Hidden costs — some providers charge for EU roaming or limit tethering',
          'Credit checks — some providers do not require them, which is ideal if your credit history is limited',
        ],
      },
      {
        heading: 'How Much Data Do You Actually Need?',
        paragraphs: [
          'Most people overestimate their data needs. If you are mainly on Wi-Fi at home and work, 5–10GB is often enough. Heavy streaming or working on mobile might need 30GB+. Unlimited plans make sense if you tether regularly or have no home broadband.',
        ],
      },
      {
        heading: 'OCCTA SIM Plans',
        paragraphs: [
          'OCCTA SIM plans start from £7.99 per month with no contract, no credit check, and 5G included. All plans come with unlimited UK calls and texts plus EU roaming. Switch up, down, or leave any time.',
        ],
      },
    ],
    faqs: [
      { question: 'Do I need a credit check for a SIM only deal?', answer: 'Not with OCCTA. Our SIM plans have no credit check requirement.' },
      { question: 'Can I keep my phone number?', answer: 'Yes. Request a PAC code from your current provider and we will port your number over, usually within one working day.' },
      { question: 'Is 5G included?', answer: 'Yes. All OCCTA SIM plans include 5G at no extra cost where coverage is available.' },
      { question: 'What happens if I use all my data?', answer: 'You can upgrade to a higher data plan at any time, effective from your next billing cycle.' },
    ],
    ctaText: 'View SIM Plans',
    ctaLink: '/sim-plans',
    relatedSlugs: ['cheap-broadband-uk', 'no-contract-broadband-uk'],
  },
  {
    slug: 'broadband-for-gaming',
    title: 'Best Broadband for Gaming UK: What You Need',
    metaTitle: 'Best Broadband for Gaming UK — Low Latency Guide',
    description: 'Find the best broadband for gaming in the UK. Learn what speeds, latency, and connection types you need for lag-free online gaming.',
    keywords: 'broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband, gaming internet, fast broadband gaming',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Online gaming demands more from your broadband than casual browsing. Low latency, consistent speeds, and unlimited data are essential. Here is what you need to know to choose the right broadband for gaming.',
    sections: [
      {
        heading: 'Speed vs Latency: What Matters More?',
        paragraphs: [
          'Many gamers focus on download speed, but latency (ping) is more important for online gaming. Latency is the time it takes for data to travel between your device and the game server. Lower ping means more responsive gameplay.',
          'Fibre broadband typically offers the lowest latency. FTTP (full fibre) connections can deliver ping times under 10ms, while older ADSL connections often exceed 30ms.',
        ],
      },
      {
        heading: 'What Speed Do You Need?',
        paragraphs: ['Here is a rough guide based on your gaming habits:'],
        bullets: [
          'Casual online gaming (Fortnite, Minecraft): 10-30Mbps is sufficient',
          'Competitive gaming (CS2, Valorant, Rocket League): 50Mbps+ recommended',
          'Streaming while gaming (Twitch, YouTube): 150Mbps+ recommended',
          'Household with multiple gamers: 300-500Mbps+',
          'Downloading large games (50-100GB): Faster speeds save hours',
        ],
      },
      {
        heading: 'Wired vs Wireless',
        paragraphs: [
          'For the best gaming experience, use an Ethernet cable directly from your router. Wi-Fi adds latency and can be unstable. If you must use Wi-Fi, connect to the 5GHz band and stay close to your router.',
        ],
      },
      {
        heading: 'OCCTA for Gaming',
        paragraphs: [
          'OCCTA offers speeds up to 900Mbps on the Openreach fibre network with unlimited data and no throttling. There are no contracts, so you can upgrade your speed tier anytime as your gaming needs change.',
        ],
      },
    ],
    faqs: [
      { question: 'Is fibre broadband better for gaming?', answer: 'Yes. Fibre delivers lower latency and more consistent speeds than ADSL or mobile broadband.' },
      { question: 'Does OCCTA throttle gaming traffic?', answer: 'No. We do not throttle, shape, or prioritise any traffic. All usage is treated equally.' },
      { question: 'What is a good ping for gaming?', answer: 'Under 20ms is excellent. Under 50ms is good. Over 100ms will cause noticeable lag in fast-paced games.' },
      { question: 'Can I game and stream at the same time?', answer: 'Yes, but you will need at least 150Mbps to do both comfortably without quality drops.' },
    ],
    ctaText: 'View Broadband Plans',
    ctaLink: '/broadband',
    relatedSlugs: ['cheap-broadband-uk', 'no-contract-broadband-uk'],
  },
  {
    slug: 'broadband-for-working-from-home',
    title: 'Best Broadband for Working from Home UK',
    metaTitle: 'Best Broadband for Working from Home — WFH Guide',
    description: 'Find the best broadband for working from home in the UK. Reliable fibre for video calls, cloud apps, and remote work without interruptions.',
    keywords: 'broadband working from home, WFH broadband, remote work internet, home office broadband, reliable broadband, video call broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Working from home requires reliable, fast broadband. Dropped video calls, slow file uploads, and buffering are not just annoying — they hurt your productivity. Here is how to choose the right broadband for remote work.',
    sections: [
      {
        heading: 'Why WFH Broadband Is Different',
        paragraphs: [
          'When working from home, your broadband becomes a business-critical tool. You need consistent upload AND download speeds, low latency for video calls, and enough bandwidth for cloud applications like Office 365, Google Workspace, and Slack.',
          'Standard broadband that works fine for Netflix might struggle with a full day of Zoom meetings, file syncing, and cloud app usage — especially if others in the household are online too.',
        ],
      },
      {
        heading: 'Recommended Speeds for Remote Work',
        paragraphs: ['Match your speed to your work pattern:'],
        bullets: [
          'Email and web browsing: 10-30Mbps',
          'Regular video calls (Zoom, Teams): 50-80Mbps',
          'HD video calls + screen sharing: 80-150Mbps',
          'Multiple remote workers in one household: 200-500Mbps',
          'Large file uploads (design, video, engineering): 300Mbps+',
        ],
      },
      {
        heading: 'Upload Speed Matters',
        paragraphs: [
          'Most providers advertise download speeds but say little about uploads. For video calls, screen sharing, and cloud file syncing, upload speed is crucial. FTTP (full fibre) connections offer symmetrical or near-symmetrical speeds, making them ideal for remote work.',
        ],
      },
      {
        heading: 'OCCTA for Home Workers',
        paragraphs: [
          'OCCTA fibre broadband offers speeds up to 900Mbps with unlimited data and no throttling. With no contracts, you can upgrade your speed tier as your work demands change. UK-based support is available if you need help.',
        ],
      },
    ],
    faqs: [
      { question: 'What speed do I need for working from home?', answer: 'For regular video calls and cloud apps, 80Mbps is a good minimum. For households with multiple workers, 200Mbps+ is recommended.' },
      { question: 'Is upload speed important for WFH?', answer: 'Yes. Video calls, screen sharing, and cloud file uploads all depend on upload speed. FTTP connections offer the best upload speeds.' },
      { question: 'Can I claim broadband as a business expense?', answer: 'You may be able to claim a portion. Check HMRC guidance or speak to your accountant.' },
      { question: 'Do I need a business broadband plan?', answer: 'For most home workers, residential broadband is fine. Business plans are only needed if you require static IPs or SLA guarantees.' },
    ],
    ctaText: 'View Broadband Plans',
    ctaLink: '/broadband',
    relatedSlugs: ['cheap-broadband-uk', 'how-to-switch-broadband'],
  },
  {
    slug: 'fibre-broadband-explained',
    title: 'Fibre Broadband Explained: FTTC vs FTTP',
    metaTitle: 'Fibre Broadband Explained — FTTC vs FTTP UK',
    description: 'Understand the difference between FTTC and FTTP fibre broadband in the UK. Learn which type you have and what speeds you can expect.',
    keywords: 'fibre broadband explained, FTTC vs FTTP, full fibre broadband, fibre to the cabinet, fibre to the premises, fibre broadband UK',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Not all fibre broadband is the same. Understanding the difference between FTTC and FTTP can help you choose the right plan and know what speeds to expect at your address.',
    sections: [
      {
        heading: 'What Is FTTC (Fibre to the Cabinet)?',
        paragraphs: [
          'FTTC uses fibre optic cables from the exchange to the green street cabinet, then copper wires from the cabinet to your home. This is the most common type of fibre broadband in the UK.',
          'Because the last stretch uses copper, speeds are limited. Typical FTTC speeds range from 36Mbps to 80Mbps depending on your distance from the cabinet.',
        ],
      },
      {
        heading: 'What Is FTTP (Fibre to the Premises)?',
        paragraphs: [
          'FTTP — also called full fibre — uses fibre optic cables all the way from the exchange to your home. No copper at all. This delivers the fastest possible speeds: up to 900Mbps or even 1Gbps.',
          'FTTP is being rolled out across the UK by Openreach and alternative networks. Coverage is expanding rapidly, with over 14 million UK homes now able to access full fibre.',
        ],
      },
      {
        heading: 'Which Is Better?',
        paragraphs: ['Here is how FTTC and FTTP compare:'],
        bullets: [
          'Speed: FTTP is significantly faster (up to 900Mbps vs 80Mbps for FTTC)',
          'Reliability: FTTP is more consistent as there is no copper degradation',
          'Upload speed: FTTP offers much faster uploads, important for WFH and cloud services',
          'Availability: FTTC is available to ~95% of UK premises; FTTP covers ~60% and growing',
          'Price: Both are affordable. OCCTA offers FTTC from £34.99/mo and FTTP from £49.99/mo',
        ],
      },
      {
        heading: 'How to Check What You Can Get',
        paragraphs: [
          'Enter your postcode on our broadband page to see whether FTTC, FTTP, or both are available at your address. We will show you the exact speeds and plans you can order.',
        ],
      },
    ],
    faqs: [
      { question: 'How do I know if I have FTTC or FTTP?', answer: 'Check your postcode on our broadband page. If speeds above 80Mbps are available, you likely have FTTP access.' },
      { question: 'Is FTTP worth the extra cost?', answer: 'If you need speeds above 80Mbps, work from home, or have a busy household, FTTP is worth it for the speed and reliability.' },
      { question: 'Can I upgrade from FTTC to FTTP?', answer: 'Yes, if FTTP is available at your address. An engineer visit may be needed to install the fibre line to your property.' },
      { question: 'Is full fibre available in my area?', answer: 'Enter your postcode on our broadband page to check. FTTP coverage is expanding across the UK.' },
    ],
    ctaText: 'Check Your Postcode',
    ctaLink: '/broadband',
    relatedSlugs: ['cheap-broadband-uk', 'no-contract-broadband-uk'],
  },
  {
    slug: 'broadband-for-students',
    title: 'Best Broadband for Students UK: No Contract Guide',
    metaTitle: 'Student Broadband UK — No Contract Internet',
    description: 'Best broadband for students in the UK. No contract, no credit check, cancel when you move. Perfect internet for student houses and flats.',
    keywords: 'student broadband, broadband for students, student internet UK, no contract student broadband, university broadband, cheap student broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Student houses need fast, cheap broadband that can be cancelled when the tenancy ends. Here is how to find the right broadband for your student accommodation without getting locked into a long contract.',
    sections: [
      {
        heading: 'Why Students Need No-Contract Broadband',
        paragraphs: [
          'Most student tenancies last 9-12 months, but big providers want 18-24 month contracts. That means paying for broadband in a house you have already left, or paying expensive exit fees.',
          'No-contract broadband solves this. Sign up when you move in, cancel when you move out. No penalties.',
        ],
      },
      {
        heading: 'What to Look for in Student Broadband',
        paragraphs: ['Here are the key features for student broadband:'],
        bullets: [
          'No contract — rolling monthly is essential for student tenancies',
          'No credit check — many students have no credit history',
          'Enough speed for a shared house (100Mbps+ for 3-4 people)',
          'Unlimited data for streaming, gaming, and studying',
          'Easy setup with a Bring your own router for £0, or choose a router at checkout',
          'Affordable — keep the monthly bill low',
        ],
      },
      {
        heading: 'How Much Speed Do Students Need?',
        paragraphs: [
          'For a solo student, 36Mbps is fine. For a shared house with 3-4 people streaming, gaming, and on video calls, aim for 100-300Mbps. Our recommendation: get the fastest affordable plan so no one has to argue about bandwidth.',
        ],
      },
      {
        heading: 'OCCTA for Students',
        paragraphs: [
          'OCCTA broadband starts from £34.99/mo with no contract, no credit check, and Setup from £0 where available. Perfect for student accommodation of any length. When you move out, give us 30 days notice and that is it — no exit fees.',
        ],
      },
    ],
    faqs: [
      { question: 'Can students get broadband without a credit check?', answer: 'Yes. OCCTA does not run credit checks on any plan, making it ideal for students.' },
      { question: 'Can I cancel when I move out?', answer: 'Yes. OCCTA is rolling monthly. Give 30 days notice and cancel with no fees.' },
      { question: 'How many people can share one broadband connection?', answer: 'With 100Mbps, 3-4 people can comfortably stream, game, and browse. For larger houses, choose 300Mbps+.' },
      { question: 'How long does installation take?', answer: 'Usually 7 working days from placing your order.' },
    ],
    ctaText: 'View Student-Friendly Plans',
    ctaLink: '/broadband',
    relatedSlugs: ['cheap-broadband-uk', 'no-contract-broadband-uk'],
  },
  {
    slug: 'how-to-get-broadband-with-bad-credit',
    title: 'How to Get Broadband with Bad Credit (UK Guide)',
    metaTitle: 'Broadband with Bad Credit — No Credit Check UK',
    description: 'Bad credit history? Learn how to get UK broadband without a hard credit check, what providers actually look for, and how OCCTA\u2019s flexible plans help.',
    keywords: 'broadband no credit check, broadband with bad credit UK, bad credit broadband, no credit check broadband, broadband no credit history',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Most big UK broadband providers run a hard credit check before they will sign you up \u2014 and a thin file, missed payment or CCJ can mean a refusal. The good news: getting connected with bad credit is still very possible. Here is how it works, and what to look for.',
    sections: [
      {
        heading: 'Why Broadband Providers Credit Check You',
        paragraphs: [
          'A traditional 18 or 24-month contract is essentially a loan: the provider commits to giving you a service today in exchange for monthly payments over a long term. To protect themselves, they run a hard credit search through agencies like Experian or Equifax.',
          'If your file shows missed payments, defaults, CCJs, or simply not much history, the application can be declined \u2014 or you may be pushed onto a more expensive plan with a deposit.',
        ],
      },
      {
        heading: 'Is There Truly \u201CNo Credit Check\u201D Broadband?',
        paragraphs: [
          'A fully no-checks-at-all broadband product is rare in the UK because the provider still needs to verify your identity and address for regulatory reasons.',
          'What is realistic is broadband without a hard credit check \u2014 short, rolling plans that do not require committing to a long fixed term, so the provider takes far less credit risk and either skips the hard search or only runs a soft check.',
        ],
      },
      {
        heading: 'How OCCTA\u2019s Flexible Plans Help',
        paragraphs: [
          'OCCTA does not lock you into 18 or 24-month contracts. Our flexible, no long-contract plans mean we are not extending credit over years \u2014 so we do not need to make sign-up dependent on a perfect credit score.',
          'There are no mid-contract price-rise nonsense clauses either. The price you sign up at is the price you pay, and you can leave with 30 days notice.',
        ],
        bullets: [
          'No long lock-in contracts \u2014 reduces the need for hard credit checks',
          'No mid-contract price hikes \u2014 your bill stays predictable',
          'Pay monthly by Direct Debit or card \u2014 your choice',
          '30 days notice to cancel \u2014 no surprise exit fees',
        ],
      },
      {
        heading: 'Practical Tips Before You Apply',
        paragraphs: ['A few simple steps can improve your chances and protect your credit file:'],
        bullets: [
          'Check your credit report for free (Experian, Equifax, TransUnion) and dispute any errors',
          'Avoid making multiple broadband applications in a short space of time',
          'Make sure you are on the electoral roll at your current address',
          'Set up a Direct Debit so payments are never missed by accident',
          'Prefer a rolling/flexible plan over a 24-month contract while you rebuild credit',
        ],
      },
      {
        heading: 'What to Avoid',
        paragraphs: [
          'Be cautious with anyone advertising \u201Cguaranteed broadband, no checks, any credit history\u201D at a high upfront price \u2014 these can be resold mobile broadband at poor value.',
          'Always check the provider is a real UK ISP, the price is clear, and there are no hidden setup fees.',
        ],
      },
    ],
    faqs: [
      { question: 'Can I get broadband in the UK with bad credit?', answer: 'Yes. Flexible no long-contract providers like OCCTA do not rely on long lock-ins, so a poor credit history is much less likely to block your application than with a traditional 24-month contract.' },
      { question: 'Does OCCTA run a hard credit check?', answer: 'OCCTA\u2019s flexible plans are designed without long lock-ins, so sign-up is not gated on a perfect credit score the way traditional contract broadband often is. We may carry out basic identity and address verification.' },
      { question: 'Will applying for broadband hurt my credit score?', answer: 'A hard credit search can leave a small temporary mark on your file. Choosing a provider that uses soft checks or rolling plans helps avoid that.' },
      { question: 'Do I need to pay a deposit?', answer: 'OCCTA does not require a security deposit on standard residential broadband plans.' },
      { question: 'How quickly can I get connected?', answer: 'Once your postcode is checked and your order is placed, installation typically takes around 7 working days, depending on the line type.' },
    ],
    ctaText: 'Check Your Address',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk', 'cheap-broadband-uk'],
  },
  // -------- New SEO blog posts (internet self-help & customer education) --------
  {
    slug: 'what-broadband-speed-do-i-need',
    title: 'What Broadband Speed Do I Really Need?',
    metaTitle: 'What Broadband Speed Do I Need? UK Guide',
    description: 'Pick the right broadband speed for your household. Honest guidance for streaming, gaming, working from home and big families — no upselling.',
    keywords: 'broadband speed guide uk, what speed do i need, mbps explained, streaming broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: "Bigger isn't always better. Most UK households are paying for speed they'll never use. Here's the honest breakdown.",
    sections: [
      { heading: 'The rough rule', paragraphs: ['Allow about 25 Mbps per heavy user (4K streaming, video calls, online gaming). Add 5 Mbps per light user (browsing, music, social).'] },
      { heading: 'By household', paragraphs: [''], bullets: ['1–2 people, light use: 36 Mbps is plenty.', '2–4 people, mixed use: 100–150 Mbps hits the sweet spot.', '4+ people or serious WFH/gaming: 300–500 Mbps.', 'Smart home, multiple 4K TVs, content creators: gigabit.'] },
      { heading: 'Upload speed matters too', paragraphs: ['If you do video calls, livestream, or back up to the cloud, upload speed is what stutters first. Full-fibre plans solve this — they\u2019re symmetric or near-symmetric.'] },
    ],
    faqs: [
      { question: 'Is gigabit overkill for a normal home?', answer: 'For most homes, yes. Unless you have 5+ heavy users or do heavy uploads, 150–500 Mbps feels identical day-to-day.' },
      { question: 'Why is my actual speed slower than advertised?', answer: 'It usually isn\u2019t — your Wi-Fi is. Test over Ethernet; that\u2019s the true line speed.' },
    ],
    ctaText: 'Check what\u2019s available',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk'],
  },
  {
    slug: 'fibre-vs-full-fibre-explained',
    title: 'Fibre vs Full Fibre Broadband — What\u2019s the Difference?',
    metaTitle: 'Fibre vs Full Fibre Broadband Explained | OCCTA',
    description: '"Fibre" doesn\u2019t always mean fibre all the way. Here\u2019s the difference between FTTC and FTTP — and why it matters for your speed.',
    keywords: 'fibre vs full fibre, fttc vs fttp, full fibre uk explained',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'British broadband marketing is a mess. Two providers can both say "fibre" and mean very different things. Here\u2019s the plain version.',
    sections: [
      { heading: 'FTTC — Fibre to the Cabinet', paragraphs: ['Fibre runs to the green street cabinet, then old copper wire runs to your house. Speeds top out around 80 Mbps and drop the further you live from the cabinet.'] },
      { heading: 'FTTP — Fibre to the Premises (a.k.a. Full Fibre)', paragraphs: ['Fibre runs all the way to your house. Speeds up to 1+ Gbps, much lower latency, and far more reliable. This is the real thing.'] },
      { heading: 'How to tell which one you can get', paragraphs: ['Pop your postcode into our checker — we show both options side by side, with no marketing fluff.'] },
    ],
    faqs: [
      { question: 'Is FTTP worth paying more for?', answer: 'If you can get it for similar money, yes. The upload speed and reliability gap is huge.' },
      { question: 'Will FTTP need new wiring?', answer: 'Yes — an engineer pulls a fibre cable from the nearest pole or pit and fits a small box on the wall. Free with OCCTA.' },
    ],
    ctaText: 'See your line options',
    ctaLink: '/broadband',
    relatedSlugs: ['what-broadband-speed-do-i-need'],
  },
  {
    slug: 'how-to-switch-broadband-uk',
    title: 'How to Switch Broadband in the UK (3 Steps)',
    metaTitle: 'How to Switch Broadband UK — Step by Step | OCCTA',
    description: 'Switching broadband is now genuinely easy thanks to Ofcom\u2019s One Touch Switch. Here\u2019s exactly how it works.',
    keywords: 'how to switch broadband uk, one touch switch, broadband switching',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Since September 2024, switching UK broadband takes one form. No phone calls to your old provider, no double-billing, no overlap.',
    sections: [
      { heading: 'Step 1 — Pick your new provider', paragraphs: ['Check your postcode, pick a plan, and place the order. You\u2019ll be asked if you\u2019re switching from another provider — say yes.'] },
      { heading: 'Step 2 — Your new provider does the rest', paragraphs: ['Under One Touch Switch, they contact your old provider on your behalf, agree a switchover date, and tell you when it\u2019ll happen.'] },
      { heading: 'Step 3 — Plug in on switch day', paragraphs: ['On the agreed day, your new router goes live. Your old service ends at midnight the same day. No overlap, no double bills.'] },
    ],
    faqs: [
      { question: 'Will I have any downtime?', answer: 'Usually under 30 minutes on switch day. Some FTTP switches are seamless.' },
      { question: 'What if I\u2019m still in contract?', answer: 'Your old provider may charge an exit fee — your new provider will tell you the figure before you commit.' },
      { question: 'Can I keep my landline number?', answer: 'Yes, it\u2019s included in the One Touch Switch process.' },
    ],
    ctaText: 'Start your switch',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk'],
  },
  {
    slug: 'why-your-wifi-is-slow',
    title: 'Why Your Wi-Fi Is Slow (and 6 Fixes That Actually Work)',
    metaTitle: 'Why Your Wi-Fi is Slow — 6 Real Fixes | OCCTA',
    description: 'Slow Wi-Fi is almost never the broadband — it\u2019s the Wi-Fi itself. Here are the six fixes in order, from free to spendy.',
    keywords: 'slow wifi uk, fix slow wifi, wifi vs broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'If a wired speed test is fast and Wi-Fi isn\u2019t, your broadband is doing its job. Try these.',
    sections: [
      { heading: 'The fixes (in order)', paragraphs: [''], bullets: [
        '1. Move the router up high, central, away from walls and metal.',
        '2. Use the 5 GHz Wi-Fi band for nearby devices.',
        '3. Reboot to pick a quieter channel automatically.',
        '4. Update your phone/laptop firmware.',
        '5. Add a mesh node for larger homes or thick walls.',
        '6. Ethernet the big stuff — TVs, consoles, desktops.',
      ] },
    ],
    faqs: [
      { question: 'Will a Wi-Fi extender help?', answer: 'Sometimes, but they often halve the speed they extend. A proper mesh system is better value long-term.' },
    ],
    ctaText: 'Read the full help guide',
    ctaLink: '/help/slow-wifi-fix',
    relatedSlugs: ['what-broadband-speed-do-i-need'],
  },
  {
    slug: 'digital-voice-vs-landline',
    title: 'Digital Voice vs the Old Landline — What\u2019s Changing?',
    metaTitle: 'Digital Voice vs Landline UK Explained | OCCTA',
    description: 'The UK is switching off the old copper phone network. Here\u2019s what Digital Voice means for your home phone — and why it\u2019s actually an upgrade.',
    keywords: 'digital voice uk, landline switch off, voip home phone uk',
    category: 'home-phone',
    categoryLabel: 'Home Phone',
    intro: 'The 100-year-old copper phone network is being switched off by 2027. Digital Voice replaces it — and it\u2019s clearer, more reliable and cheaper.',
    sections: [
      { heading: 'How it works', paragraphs: ['Your home phone plugs into the router instead of a wall socket. Calls travel over your broadband. You keep your number.'] },
      { heading: 'What\u2019s better', paragraphs: [''], bullets: ['HD voice quality.', 'No crackle, no line noise.', 'Spam call blocking built in.', 'Voicemail by email.'] },
      { heading: 'What to watch', paragraphs: ['In a power cut, you need either a battery backup unit (free if you\u2019re flagged vulnerable) or a mobile to call 999. Tell us if anyone in the home relies on the phone for safety.'] },
    ],
    faqs: [
      { question: 'Will my number change?', answer: 'No. Numbers port across seamlessly.' },
      { question: 'Do I need a new handset?', answer: 'No — any standard phone works. Plug it into the green port on the router.' },
    ],
    ctaText: 'See Digital Voice plans',
    ctaLink: '/landline',
    relatedSlugs: [],
  },
  {
    slug: 'working-from-home-broadband',
    title: 'The Ideal Home Network for Working From Home',
    metaTitle: 'Working From Home Broadband Setup | OCCTA',
    description: 'Stop having to ask "can you repeat that?" on Zoom. Here\u2019s the WFH broadband setup that just works.',
    keywords: 'working from home broadband uk, wfh internet setup, best broadband for video calls',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'WFH lives or dies on upload speed and stability. Get these right and meetings stop being awkward.',
    sections: [
      { heading: 'Pick full fibre if you can', paragraphs: ['Full fibre (FTTP) gives much higher upload speeds — what video calls actually need.'] },
      { heading: 'Ethernet the work machine', paragraphs: ['Even £15 of Ethernet cable beats £200 of Wi-Fi router for stability on calls.'] },
      { heading: 'Get a static IP if you VPN', paragraphs: ['Static IPs make corporate VPNs and remote desktop happier. We offer them as an add-on.'] },
      { heading: 'Quality-of-Service settings', paragraphs: ['Most modern routers let you prioritise the work laptop. Worth a 5-minute setup.'] },
    ],
    faqs: [
      { question: 'What speed do I need for WFH?', answer: '50 Mbps down and 10 Mbps up handles multiple HD video calls. More if you\u2019re sharing with family who stream.' },
    ],
    ctaText: 'Check WFH-ready plans',
    ctaLink: '/broadband',
    relatedSlugs: ['what-broadband-speed-do-i-need', 'fibre-vs-full-fibre-explained'],
  },
  {
    slug: 'no-credit-check-broadband-uk',
    title: 'No Credit Check Broadband UK: How to Get Online Without a Credit Check',
    metaTitle: 'No Credit Check Broadband UK | OCCTA',
    description: 'Looking for broadband without a credit check? Learn how OCCTA\u2019s flexible, no-contract plans and card payment options make it easy to get online — even with poor or no credit history.',
    keywords: 'broadband no credit check, no credit check broadband uk, broadband without credit check, bad credit broadband, broadband for poor credit',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Most UK broadband providers run a hard credit check before they will switch you on. If your credit file is thin, damaged, or simply private, that is a real barrier. OCCTA is built differently: flexible terms, card payment up front, and no long lock-in. Here is how to get connected without the credit-check hurdle.',
    sections: [
      {
        heading: 'Why do broadband providers run credit checks?',
        paragraphs: [
          'Big-name providers usually sign you to an 18 or 24-month contract and bill you in arrears. To them, that is lending — so they run a hard credit search to decide whether to take you on. A hard search shows on your credit file and can affect your score.',
          'If you have missed payments in the past, are new to the UK, or simply do not have much credit history, that search can come back as a decline — even though you can clearly afford the monthly bill.',
        ],
      },
      {
        heading: 'How OCCTA works without a hard credit check',
        paragraphs: [
          'OCCTA offers no-contract, rolling monthly broadband. Because we are not locking you into a long term, we do not need to underwrite you the way a 24-month provider does.',
          'You can start service by paying your first month and any setup fee by card up front. From there you choose how to pay each month — Direct Debit, card, or bank transfer. No hard credit search, no long-term commitment.',
        ],
        bullets: [
          'No 18 or 24-month contract — leave any time with 30 days notice',
          'Pay your first invoice by card to get connected quickly',
          'Optional Direct Debit later, once you are happy',
          'No early termination fees or hidden penalties',
        ],
      },
      {
        heading: 'Who is this best for?',
        paragraphs: ['No credit check broadband suits a wide range of households:'],
        bullets: [
          'People rebuilding their credit after past missed payments',
          'New UK residents with little or no credit footprint',
          'Students and young adults who have never borrowed',
          'Anyone who prefers not to have a hard search on their file',
          'Renters who move often and want flexible terms',
        ],
      },
      {
        heading: 'What you will need to sign up',
        paragraphs: [
          'We keep onboarding light: your installation address and postcode, a contact email and phone number, your date of birth, and a payment card for the first invoice. That is it.',
          'There is no hard credit search and no impact on your credit score from signing up with OCCTA.',
        ],
      },
      {
        heading: 'How fast can you get connected?',
        paragraphs: [
          'Most addresses are activated within 7\u201314 working days of order. If your line is already active, switching to OCCTA is usually faster. You will get a confirmed activation date by email before any work happens.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does OCCTA run a hard credit check?',
        answer: 'No. Because OCCTA is no-contract and your first invoice is paid by card, we do not run a hard credit search at signup. Your credit score is not affected.',
      },
      {
        question: 'Can I get broadband with bad credit in the UK?',
        answer: 'Yes. OCCTA\u2019s flexible, no-contract plans and card-first payment option mean you can get connected without passing a traditional credit check.',
      },
      {
        question: 'What if I cannot set up a Direct Debit?',
        answer: 'That is fine. You can pay each invoice by card or bank transfer. Direct Debit is optional, not required.',
      },
      {
        question: 'Will OCCTA report me to credit agencies?',
        answer: 'We do not report routine broadband payments to credit reference agencies. We only share data where law requires it, for example for serious unpaid debt recovery.',
      },
    ],
    ctaText: 'Check your address',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk', 'how-to-get-broadband-with-bad-credit', 'cheap-broadband-uk'],
  },
  {
    slug: 'router-lights-and-broadband-troubleshooting',
    title: 'Router Lights & Broadband Troubleshooting: The Complete UK Guide',
    metaTitle: 'Router Red Light Fix & Broadband Troubleshooting Guide | OCCTA',
    description:
      'What do router lights mean and how do you fix a slow or dropped broadband connection? A plain-English guide to router LEDs, Wi-Fi optimisation and speed troubleshooting for UK homes.',
    keywords:
      'router red light fix, router lights meaning, broadband troubleshooting guide, slow broadband fix, wifi troubleshooting UK, 2.4ghz vs 5ghz, ONT light meaning, router blinking light',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro:
      'Router acting up? Before you call support, most broadband problems can be spotted from the lights on the front of your router or ONT — and a surprising number of "slow Wi-Fi" complaints are actually fixable in under five minutes. Here is a plain-English walk-through you can use on any standard UK router.',
    sections: [
      {
        heading: 'What Do Router Lights Mean?',
        paragraphs: [
          'Router LEDs are the fastest way to diagnose a broadband issue. The exact labels vary between makes (Zyxel, TP-Link, Fritz!Box, eero, ISP-branded hubs), but the colours follow a very consistent pattern across UK Full Fibre (FTTP) and FTTC connections.',
        ],
        bullets: [
          'Solid green or white — normal. Router is powered on and connected.',
          'Solid blue — often used for a successful internet/PPPoE connection.',
          'Blinking green or white — activity, data is flowing. This is fine.',
          'Solid red — no internet. The router cannot reach the network. Almost always a line issue, a config problem, or an outage.',
          'Blinking red — line detected but authentication or sync is failing. Often fixed by a full 60-second power-off.',
          'Solid orange or amber — connected at a reduced state (e.g. WAN link but no PPPoE, or firmware updating). Wait 5 minutes before power-cycling.',
          'No lights at all — power fault. Check the PSU, socket, and the barrel plug at the router end.',
        ],
      },
      {
        heading: 'ONT Lights (Full Fibre Only)',
        paragraphs: [
          'On Full Fibre (FTTP), you have a second box on the wall called the ONT — Optical Network Terminal. Its lights are separate from your router and matter just as much.',
        ],
        bullets: [
          'PON light solid green — fibre signal is healthy.',
          'PON light off or red — fibre link is down. This is an Openreach/network fault, not your router. Report it.',
          'LOS light red or blinking red — Loss of Signal on the fibre. Do not unplug the fibre cable; raise a fault.',
          'LAN light — should be on when your router is plugged into the ONT.',
        ],
      },
      {
        heading: 'Router Red Light Fix — Step by Step',
        paragraphs: [
          'If your router is showing a solid or blinking red light, try these steps in order before assuming a fault.',
        ],
        bullets: [
          'Power the router off at the socket for a full 60 seconds. Anything shorter and the DSL/PPPoE session may not reset.',
          'Check every cable is firmly seated: power, WAN/DSL, and the cable to your ONT if you are on FTTP.',
          'On FTTC (copper), plug the router directly into the master socket and remove any extension leads or splitters.',
          'Check for a known outage — your provider should have a status page.',
          'If still red after 15 minutes, contact your provider. Do not factory-reset unless asked; you may lose custom Wi-Fi settings.',
        ],
      },
      {
        heading: 'Slow Broadband Fix: Wi-Fi vs Line Speed',
        paragraphs: [
          'Most "slow broadband" complaints are actually Wi-Fi problems, not line problems. To tell them apart, run a speed test on a device plugged into the router with an Ethernet cable. If that speed is close to your plan, the line is fine and the fix is inside your home.',
        ],
        bullets: [
          'Move the router into the open — not in a cupboard, behind the TV, or on the floor.',
          'Keep it at least 1m away from cordless phone bases, baby monitors, and microwaves.',
          'Split 2.4GHz and 5GHz networks if your router allows: use 5GHz for devices in the same room (faster, shorter range) and 2.4GHz for far rooms (slower, longer range, better through walls).',
          'Reboot the router weekly if you notice it slows over time — cheap routers leak memory.',
          'For larger homes, a mesh system or a wired access point in a second room fixes 90% of dead spots.',
        ],
      },
      {
        heading: '2.4GHz vs 5GHz — Which Should You Use?',
        paragraphs: [
          'Modern routers broadcast on two Wi-Fi bands. Understanding the difference is the single biggest DIY improvement most households can make.',
        ],
        bullets: [
          '5GHz — faster (often 3–5× the throughput of 2.4GHz), less crowded, but shorter range and weaker through walls. Best for streaming, video calls, gaming, and any device in the same room as the router.',
          '2.4GHz — slower, but reaches further and passes through walls more easily. Best for smart plugs, doorbells, thermostats, and anything at the far end of the house.',
          'If your router uses one combined name for both bands ("Smart Connect" or "Band Steering"), you usually do not need to change anything. If you keep dropping to slow speeds, splitting the two networks manually gives you control.',
        ],
      },
      {
        heading: 'When to Contact Support',
        paragraphs: [
          'Contact your provider when: the router shows a persistent red light after a full power-cycle, the ONT LOS light is red, wired speed is well below your plan for more than a day, or the connection drops repeatedly at the same time each day. Have your account reference and the current LED pattern to hand — it will save you 10 minutes.',
        ],
      },
    ],
    faqs: [
      { question: 'Why is my router light red?', answer: 'A red router light almost always means the router cannot reach the broadband network. Power it off at the socket for 60 seconds, check the cables, and check for a provider outage. If it is still red after 15 minutes, contact your provider.' },
      { question: 'What does a blinking green light on my router mean?', answer: 'Blinking green (or white) is normal — it shows data is flowing. You only need to worry when a light is red, off, or a colour the manual says is a fault.' },
      { question: 'Should I use 2.4GHz or 5GHz Wi-Fi?', answer: '5GHz is faster but shorter range — use it for devices in the same room as your router. 2.4GHz is slower but reaches further — use it for far rooms and smart-home devices.' },
      { question: 'Does OCCTA support my own router?', answer: 'Yes. OCCTA broadband works with any standard router — bring your own or use the one we supply. We can help configure PPPoE credentials if needed.' },
      { question: 'How do I test if my slow broadband is Wi-Fi or the line?', answer: 'Plug a laptop into the router with an Ethernet cable and run a speed test. If wired speed is close to your plan, the line is fine and the problem is your Wi-Fi setup.' },
    ],
    howTo: {
      name: 'Fix a Router Red Light',
      description: 'Step-by-step method to clear a solid or blinking red light on a UK broadband router before contacting your provider.',
      totalTime: 'PT15M',
      steps: [
        { name: 'Power off for 60 seconds', text: 'Switch the router off at the wall socket and leave it off for a full 60 seconds so the DSL or PPPoE session fully resets.' },
        { name: 'Reseat every cable', text: 'Firmly reconnect the power, WAN or DSL cable, and — on Full Fibre — the cable running to the ONT.' },
        { name: 'Remove extensions (FTTC only)', text: 'On copper FTTC lines, plug the router directly into the master telephone socket and remove any extension leads or splitters.' },
        { name: 'Check for an outage', text: 'Open your provider\'s service status page from a mobile connection to rule out a known network outage in your area.' },
        { name: 'Contact your provider', text: 'If the light is still red after 15 minutes, contact your provider. Do not factory-reset the router unless asked — you may lose your custom Wi-Fi settings.' },
      ],
    },
    ctaText: 'Check broadband at my address',
    ctaLink: '/broadband',
    relatedSlugs: ['no-contract-broadband-uk', 'how-to-switch-broadband', 'digital-voice-uk'],
  },
];

export const getGuideBySlug = (slug: string): Guide | undefined =>
  guides.find((g) => g.slug === slug);

export const getGuidesByCategory = (category: Guide['category']): Guide[] =>
  guides.filter((g) => g.category === category);

export const getRelatedGuides = (guide: Guide): Guide[] =>
  guide.relatedSlugs.map((s) => guides.find((g) => g.slug === s)).filter(Boolean) as Guide[];
