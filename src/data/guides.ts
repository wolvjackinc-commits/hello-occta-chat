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
          'OCCTA offers Digital Home Phone from just £4.99 per month as an add-on to any broadband plan. You get HD voice quality, caller display, and free voicemail. Optional call plans let you add unlimited UK calls or international minutes.',
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
          'OCCTA Digital Home Phone is already fully digital — no copper line needed. From £4.99 per month as a broadband add-on, it includes HD voice, caller display, and voicemail. You can add unlimited UK or international calling plans too.',
        ],
      },
    ],
    faqs: [
      { question: 'Will my landline stop working?', answer: 'Your traditional analogue landline will stop working when your area is switched off. You will need to move to a Digital Voice service that works over broadband.' },
      { question: 'Do I have to pay more for Digital Voice?', answer: 'OCCTA Digital Home Phone starts at £4.99 per month, which is typically less than a traditional line rental.' },
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
];

export const getGuideBySlug = (slug: string): Guide | undefined =>
  guides.find((g) => g.slug === slug);

export const getGuidesByCategory = (category: Guide['category']): Guide[] =>
  guides.filter((g) => g.category === category);

export const getRelatedGuides = (guide: Guide): Guide[] =>
  guide.relatedSlugs.map((s) => guides.find((g) => g.slug === s)).filter(Boolean) as Guide[];
