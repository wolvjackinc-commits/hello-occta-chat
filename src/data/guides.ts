export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface GuideFAQ {
  question: string;
  answer: string;
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
    keywords: 'no contract broadband UK, flexible broadband, cancel anytime broadband, rolling monthly broadband, no lock-in broadband, no exit fee broadband',
    category: 'broadband',
    categoryLabel: 'Broadband',
    intro: 'Fed up with 18 or 24-month broadband contracts? You are not alone. More UK households are switching to no-contract broadband — rolling monthly plans that let you cancel anytime without exit fees. Here is everything you need to know.',
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
          'At OCCTA, no-contract broadband starts from just £22.99 per month. You get the same speeds, the same unlimited data, and the same UK-based support as any contract plan — but without the tie-in.',
          'Many providers charge a premium for flexibility. We believe broadband should be simple: one price, no hidden fees, no mid-contract price rises.',
        ],
      },
      {
        heading: 'How to Get Started',
        paragraphs: [
          'Getting set up is straightforward. Check your postcode on our broadband page, choose a speed tier, and complete your order. Installation typically takes around 7 working days, and your router is included at no extra cost.',
        ],
      },
    ],
    faqs: [
      { question: 'Is no contract broadband slower than contract broadband?', answer: 'No. At OCCTA, you get the same speeds regardless of contract type — up to 900Mbps on our fastest plan.' },
      { question: 'Can I cancel at any time?', answer: 'Yes. Give us 30 days notice and you can leave whenever you like, no exit fees.' },
      { question: 'Is there a setup fee?', answer: 'Installation is free during promotional periods. Check our broadband page for the latest offers.' },
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
          'At OCCTA, the price you see is the price you pay. Our broadband starts from £22.99 per month with no setup fees, no mid-contract rises, and no exit penalties. We include the router and unlimited data as standard.',
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
      { question: 'What is the cheapest broadband in the UK?', answer: 'OCCTA offers broadband from £22.99 per month with no hidden fees, no contracts, and speeds up to 900Mbps.' },
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
          'OCCTA SIM plans start from £7.99 per month with no contract, no credit check, and 5G included. All plans come with unlimited UK calls and texts plus EU roaming. Switch up, down, or cancel any time.',
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
          'Price: Both are affordable. OCCTA offers FTTC from £22.99/mo and FTTP from £27.99/mo',
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
          'Easy setup with a free router',
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
          'OCCTA broadband starts from £22.99/mo with no contract, no credit check, and free installation. Perfect for student accommodation of any length. When you move out, give us 30 days notice and that is it — no exit fees.',
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
];

export const getGuideBySlug = (slug: string): Guide | undefined =>
  guides.find((g) => g.slug === slug);

export const getGuidesByCategory = (category: Guide['category']): Guide[] =>
  guides.filter((g) => g.category === category);

export const getRelatedGuides = (guide: Guide): Guide[] =>
  guide.relatedSlugs.map((s) => guides.find((g) => g.slug === s)).filter(Boolean) as Guide[];
