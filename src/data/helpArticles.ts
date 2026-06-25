// Self-service help centre articles. Rendered by /help and /help/:slug.
// Brutalist layout; each article = sections + FAQs. Pure data, no DB.

export interface HelpFAQ { question: string; answer: string }
export interface HelpSection { heading: string; paragraphs: string[]; bullets?: string[] }

export interface HelpArticle {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  category: "Getting Started" | "Billing & Payments" | "Troubleshooting" | "Account" | "Digital Voice" | "Moving & Switching";
  readMinutes: number;
  intro: string;
  sections: HelpSection[];
  faqs: HelpFAQ[];
  related?: string[];
}

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting Started With Your OCCTA Service",
    metaTitle: "Getting Started — OCCTA Help Centre",
    description: "Step-by-step setup for your new OCCTA broadband, Digital Voice and Wi-Fi. Router placement, first-day speed checks, what the lights mean and what 'good' looks like.",
    keywords: "occta getting started, new broadband setup, router setup, wifi setup uk, first day broadband",
    category: "Getting Started",
    readMinutes: 6,
    intro: "Welcome to OCCTA. This is the only page you need on day one. Follow the steps below and you'll be online in roughly ten minutes — no jargon, no surprises.",
    sections: [
      { heading: "What's in the box", paragraphs: ["Your kit ships with the router, a power supply, an Ethernet cable and a phone cable (for Digital Voice plans). Keep the box — you'll need it if you ever return the router."] },
      { heading: "Plug it in", paragraphs: ["Connect the router's WAN port to your master socket using the cable provided, then plug in the power. Wait 5–10 minutes for the line to sync. Most lines come up in under 10 minutes."], bullets: ["Use the master socket (the main one) — not an extension.", "Solid green light = online. Flashing = syncing. Red = no signal yet."] },
      { heading: "Connect your devices", paragraphs: ["The Wi-Fi network name (SSID) and password are printed on the back of the router. Connect once and your devices will remember it."] },
      { heading: "Run a speed test", paragraphs: ["Wait 24 hours, then run a test from speedtest.net using an Ethernet cable for the most accurate reading. The line stabilises in the first 10 days — early dips are normal."] },
      { heading: "Best Wi-Fi placement", paragraphs: ["Wi-Fi loves height and space."], bullets: ["Off the floor, away from walls and metal.", "Not in a cupboard, not behind a TV, not next to a microwave.", "Central in the home if possible."] },
      { heading: "Set up Digital Voice (if included)", paragraphs: ["Plug your home phone into the router's green phone port. Pick up the handset — you should hear a dial tone. If you ported a number, it usually goes live within a working day."] },
    ],
    faqs: [
      { question: "How long until I'm online?", answer: "Most customers are live within 10 minutes of plugging the router in on activation day." },
      { question: "My speed is lower than expected — should I worry?", answer: "Give the line 10 days to stabilise. After that, if you're still well below the estimate on your Contract Summary, contact us and we'll investigate." },
      { question: "Can I use my own router?", answer: "Yes, on most plans. We'll need your WAN credentials — message support and we'll share them." },
    ],
    related: ["slow-wifi-fix", "no-internet-troubleshooting", "digital-voice-setup", "billing-explained"],
  },
  {
    slug: "billing",
    title: "Billing Explained: When and How You'll Be Charged",
    metaTitle: "Billing & Payments — OCCTA Help Centre",
    description: "How OCCTA billing works: invoice dates, VAT, Direct Debit Guarantee, late fees, refunds and how to pay your bill.",
    keywords: "occta billing, broadband invoice uk, direct debit broadband, pay broadband bill",
    category: "Billing & Payments",
    readMinutes: 5,
    intro: "Honest billing in plain English. Here's exactly when your money moves and what to do if anything looks off.",
    sections: [
      { heading: "When you'll be billed", paragraphs: ["Residential plans are billed monthly in advance from your activation date. Your first invoice is raised on the activation date itself; from then on it lands on the same day each month."] },
      { heading: "VAT", paragraphs: ["Residential prices already include VAT. Business prices are shown excluding VAT with the VAT line itemised separately on the invoice."] },
      { heading: "Direct Debit", paragraphs: ["Direct Debit is collected automatically 7 days after the invoice is raised. You're fully protected by the Direct Debit Guarantee — refunds are immediate if money is taken in error."] },
      { heading: "Invoice with secure link", paragraphs: ["If you chose card payments instead, every invoice comes with a one-tap Worldpay link. Cards aren't stored on our servers — only secure tokens."] },
      { heading: "Late fees & suspension", paragraphs: ["A £5 late fee applies after 7 days past due. After 30 days the service can be suspended. We always email you well before either happens."] },
      { heading: "Refunds", paragraphs: ["Refunds (overpayments, mid-month cancellations) are processed back to the original payment method within 5 working days."] },
    ],
    faqs: [
      { question: "Can I change my billing date?", answer: "Yes — message support with your preferred day of the month and we'll move it." },
      { question: "What if a Direct Debit fails?", answer: "We retry once after 3 working days and email you. You can also pay instantly from your dashboard." },
      { question: "Why is my first invoice different?", answer: "It might be pro-rated to align with your billing day, or include a one-off setup charge listed on your Contract Summary." },
    ],
    related: ["getting-started", "direct-debit-setup-help", "first-invoice-explained-help"],
  },
  {
    slug: "router-setup",
    title: "Router Setup: Lights, Ports & Common Issues",
    metaTitle: "Router Setup — OCCTA Help Centre",
    description: "What every light on your OCCTA router means, which port does what and how to fix the most common router issues in 60 seconds.",
    keywords: "occta router lights, router setup uk, router ports explained",
    category: "Troubleshooting",
    readMinutes: 4,
    intro: "Your router quietly does a lot. Here's how to read it at a glance and fix the boring stuff yourself.",
    sections: [
      { heading: "Light meanings", paragraphs: [""], bullets: ["Power: solid = on, off = no power.", "Internet/WAN: solid green = online, flashing = syncing, red = no signal.", "Wi-Fi: solid = broadcasting, off = Wi-Fi disabled, flashing = data moving.", "Phone (Digital Voice): solid = registered, flashing = call in progress."] },
      { heading: "Ports", paragraphs: [""], bullets: ["WAN (often blue): connects to the master socket.", "LAN 1–4 (yellow): wired devices — TV, console, PC.", "Phone (green): your home phone handset.", "USB: storage/printer sharing (not used by most homes)."] },
      { heading: "The 60-second fix", paragraphs: ["When in doubt: unplug the router, wait 30 seconds, plug it back in. Genuinely fixes ~70% of issues. Wait 5 minutes before testing."] },
    ],
    faqs: [
      { question: "Should I leave the router on 24/7?", answer: "Yes. Frequent reboots make your line look unstable and your supplier may throttle the speed as a 'fix'." },
    ],
    related: ["slow-wifi-fix", "no-internet-troubleshooting", "getting-started"],
  },
  {
    slug: "slow-wifi-fix",
    title: "Why Your Wi-Fi is Slow (and 6 Things That Actually Fix It)",
    metaTitle: "Slow Wi-Fi — Fix It in 5 Minutes | OCCTA Help",
    description: "Wi-Fi feeling slow? Most of the time it's not the broadband — it's the Wi-Fi itself. Here's how to tell, and how to fix it.",
    keywords: "slow wifi fix uk, wifi vs broadband speed, boost wifi signal",
    category: "Troubleshooting",
    readMinutes: 6,
    intro: "If a speed test is fast over Ethernet but slow on Wi-Fi, your broadband is fine — your Wi-Fi isn't. Try these, in order.",
    sections: [
      { heading: "1. Move the router", paragraphs: ["Up high, central, no walls, no cupboards, no metal."] },
      { heading: "2. Use the 5 GHz band", paragraphs: ["Most modern routers broadcast two networks. The 5 GHz one is much faster at short range; the 2.4 GHz one reaches further but is slower. Connect close-up devices to 5 GHz."] },
      { heading: "3. Switch channels", paragraphs: ["Your neighbours' Wi-Fi can drown yours out. Restart the router and it'll pick a quieter channel automatically."] },
      { heading: "4. Update the device", paragraphs: ["A phone or laptop on outdated firmware will Wi-Fi badly. Updates fix it more often than you'd expect."] },
      { heading: "5. Add a mesh node", paragraphs: ["For homes over 100 m² or with thick walls, a single router isn't enough. A 2- or 3-node mesh kit transforms coverage."] },
      { heading: "6. Ethernet the big stuff", paragraphs: ["TVs, consoles and desktop PCs deserve a cable. Wi-Fi is a luxury for things that move."] },
    ],
    faqs: [
      { question: "Will OCCTA send a mesh kit?", answer: "On Ultrafast and Gigabit plans, mesh add-ons are available at cost — see your dashboard." },
    ],
    related: ["router-setup", "no-internet-troubleshooting", "getting-started"],
  },
  {
    slug: "no-internet-troubleshooting",
    title: "No Internet? Try This Before You Call",
    metaTitle: "No Internet — Troubleshooting | OCCTA Help",
    description: "Step-by-step diagnostic for when your OCCTA broadband stops working. Most outages are fixed in under five minutes.",
    keywords: "broadband not working uk, no internet fix, occta outage",
    category: "Troubleshooting",
    readMinutes: 4,
    intro: "Run through these in order. We do the same thing when you call — saving you a phone queue.",
    sections: [
      { heading: "Step 1 — Check the lights", paragraphs: ["If the Internet/WAN light is red or off, it's a line issue (skip to Step 4). If it's green, the line is up — it's a Wi-Fi or device issue."] },
      { heading: "Step 2 — Test over Ethernet", paragraphs: ["Plug a laptop into a LAN port. If that works, your broadband is fine — see the slow Wi-Fi guide."] },
      { heading: "Step 3 — Reboot the router", paragraphs: ["Power off, wait 30 seconds, power on. Wait 5 minutes."] },
      { heading: "Step 4 — Check for known outages", paragraphs: ["Open occta.co.uk/service-status from mobile data. If there's an incident, ETA is posted there."] },
      { heading: "Step 5 — Contact us", paragraphs: ["Email hello@occta.co.uk or chat with Ira (bottom-right). Include your account number and what the lights are doing."] },
    ],
    faqs: [
      { question: "Will I get compensated for an outage?", answer: "For qualifying outages over 2 working days, automatic compensation is credited under Ofcom's scheme. No claim needed." },
    ],
    related: ["router-setup", "slow-wifi-fix", "billing"],
  },
  {
    slug: "digital-voice-setup",
    title: "Digital Voice (Home Phone) Setup",
    metaTitle: "Digital Voice Setup — OCCTA Help",
    description: "How to set up your OCCTA Digital Voice handset, port your old landline number, and what to know about emergency calls.",
    keywords: "digital voice setup uk, landline replacement, voip home phone",
    category: "Digital Voice",
    readMinutes: 4,
    intro: "Digital Voice replaces the old copper landline with a clearer, more reliable connection through your router. Setup takes two minutes.",
    sections: [
      { heading: "Plug it in", paragraphs: ["Connect your existing home phone to the green Phone port on the router. Pick up the handset — you should hear a dial tone."] },
      { heading: "Number porting", paragraphs: ["If you asked us to port your old number, it usually activates within one working day. You'll get an SMS or email when it's live."] },
      { heading: "Emergency calls (999/112)", paragraphs: ["These work as normal. Important: in a power cut your phone won't work unless you have a battery backup unit. If anyone in the household relies on a phone line for safety, ask us for a free battery backup."] },
    ],
    faqs: [
      { question: "Can I keep my existing handset?", answer: "Yes — any standard home phone works." },
      { question: "What if my broadband goes down?", answer: "Calls will go via your mobile or the battery backup if you have one. Tell us if a household member is vulnerable and we'll prioritise restoration." },
    ],
    related: ["getting-started", "vulnerable-customer-support"],
  },
  {
    slug: "direct-debit-setup-help",
    title: "Setting Up & Managing Direct Debit",
    metaTitle: "Direct Debit Setup — OCCTA Help",
    description: "How to set up Direct Debit, change bank details, cancel and how the Direct Debit Guarantee protects you.",
    keywords: "direct debit broadband uk, change bank details broadband",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "Direct Debit is the easiest way to pay and is fully protected by the Direct Debit Guarantee.",
    sections: [
      { heading: "Setting one up", paragraphs: ["From your dashboard, go to Billing → Payment method → Set up Direct Debit. You'll need the account holder's name, sort code and account number. It takes 60 seconds."] },
      { heading: "Changing bank details", paragraphs: ["Same place — set up a new mandate and the old one is cancelled automatically."] },
      { heading: "Cancelling", paragraphs: ["You can cancel at your bank at any time. Please give us a heads-up so we can offer a card payment link for your next invoice — otherwise the bill becomes overdue."] },
      { heading: "The Direct Debit Guarantee", paragraphs: ["If we ever take an incorrect amount, your bank refunds it immediately — no questions. Full protection is on the BACS Direct Debit Guarantee."] },
    ],
    faqs: [
      { question: "When is the money taken?", answer: "7 days after the invoice is raised. You always have time to query a bill first." },
    ],
    related: ["billing", "first-invoice-explained-help"],
  },
  {
    slug: "first-invoice-explained-help",
    title: "Your First Invoice, Explained",
    metaTitle: "First Invoice Explained — OCCTA Help",
    description: "What's on your first OCCTA invoice and why the total may look different from your monthly price.",
    keywords: "first broadband invoice, prorated bill broadband",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "First bills often look unfamiliar. Here's exactly what each line is.",
    sections: [
      { heading: "Monthly service charge", paragraphs: ["Your plan price for the upcoming month. Already includes VAT for residential."] },
      { heading: "Pro-ration", paragraphs: ["If your activation day differs from your billing day, your first invoice may include a few days at a daily rate to align them."] },
      { heading: "One-off charges", paragraphs: ["Setup, hardware or installation fees from your Contract Summary appear here as separate lines."] },
      { heading: "Credits / discounts", paragraphs: ["Promotional credits or referral bonuses are applied as negative lines."] },
    ],
    faqs: [
      { question: "Why does my second invoice look different?", answer: "Pro-rated lines only appear once. From invoice 2 onwards you'll see your standard monthly amount." },
    ],
    related: ["billing", "direct-debit-setup-help"],
  },
  {
    slug: "move-home",
    title: "Moving Home With OCCTA",
    metaTitle: "Moving Home — OCCTA Help",
    description: "How to take your OCCTA broadband and Digital Voice with you when you move. Notice, fees and what to expect.",
    keywords: "moving home broadband uk, transfer broadband new address",
    category: "Moving & Switching",
    readMinutes: 3,
    intro: "Moving? We move with you — no early termination fees, no panic.",
    sections: [
      { heading: "Tell us early", paragraphs: ["Give us at least 14 days' notice with the new address and move-in date. We'll check availability at the new property and book activation for the day you arrive."] },
      { heading: "What if speed at the new address is slower?", paragraphs: ["You can downgrade to a cheaper plan, free of charge. No lock-in, no penalty."] },
      { heading: "What if it's not available?", paragraphs: ["We'll cancel without a fee. Genuinely — no contracts means no contracts."] },
    ],
    faqs: [
      { question: "Will I keep my landline number?", answer: "Yes, Digital Voice numbers travel with you — they don't depend on the address." },
    ],
    related: ["cancel-or-switch", "billing"],
  },
  {
    slug: "cancel-or-switch",
    title: "Cancelling or Switching to Another Provider",
    metaTitle: "Cancel or Switch — OCCTA Help",
    description: "How to cancel OCCTA or switch to another provider. No exit fees on rolling plans — straight talk.",
    keywords: "cancel broadband uk, switch broadband, one touch switch",
    category: "Moving & Switching",
    readMinutes: 3,
    intro: "We hate the lock-ins as much as you do. Here's exactly how leaving works.",
    sections: [
      { heading: "If you're on a rolling plan", paragraphs: ["Give 30 days' notice from your dashboard or by email. No exit fee. Service ends at midnight on day 30."] },
      { heading: "If you're on a fixed term", paragraphs: ["Leaving early triggers an Early Termination Charge — the remaining monthly fees minus VAT discount, as set out in your Contract Summary. The exact figure is shown before you confirm."] },
      { heading: "Switching to another UK provider", paragraphs: ["Under Ofcom's One Touch Switch, your new provider handles everything. Just sign up with them — they'll tell us. No double bills, no overlap."] },
      { heading: "Returning the router", paragraphs: ["We email a free returns label. It must arrive within 14 days of cancellation, otherwise a £35 hardware fee applies."] },
    ],
    faqs: [
      { question: "What happens to my Digital Voice number?", answer: "You can port it to your new provider as part of One Touch Switch — no extra steps." },
    ],
    related: ["billing", "move-home"],
  },
  {
    slug: "vulnerable-customer-support",
    title: "Vulnerable Customer Support",
    metaTitle: "Vulnerable Customer Support — OCCTA",
    description: "Priority support, free battery backup, payment flexibility and accessibility help for OCCTA customers in vulnerable circumstances.",
    keywords: "vulnerable customer broadband, telecare priority, accessible broadband uk",
    category: "Account",
    readMinutes: 3,
    intro: "If you or someone in the household depends on the line for safety, age, illness, mental health, financial hardship or any other reason — please tell us. We treat it seriously.",
    sections: [
      { heading: "Priority restoration", paragraphs: ["Outages affecting flagged accounts are prioritised by our supplier. We aim to have you back online within 24 hours."] },
      { heading: "Free battery backup", paragraphs: ["For Digital Voice users who rely on the phone for emergencies, we provide a free battery backup unit so 999 calls keep working in a power cut."] },
      { heading: "Payment flexibility", paragraphs: ["Repayment plans, payment holidays and bill smoothing are all on the table — judgement-free. Just ask."] },
      { heading: "Accessibility", paragraphs: ["Large print bills, third-party contacts (e.g. a relative who manages the account) and BSL relay are supported. Email hello@occta.co.uk."] },
    ],
    faqs: [
      { question: "How do I get flagged as a priority customer?", answer: "Reply to any email or message support. We'll add the flag the same day — no medical evidence required for the basic protections." },
    ],
    related: ["digital-voice-setup", "billing"],
  },
  {
    slug: "own-router-setup",
    title: "Set Up Your Own Router with OCCTA Broadband",
    metaTitle: "How to Set Up Your Own Router with OCCTA Broadband",
    description: "Step-by-step PPPoE setup for OCCTA customers using their own router — covers FTTP, SoGEA, popular router brands and troubleshooting.",
    keywords: "occta own router, pppoe setup, broadband router setup uk, occta pppoe username password",
    category: "Getting Started",
    readMinutes: 8,
    intro: "Using your own router with OCCTA broadband? Follow this PPPoE setup guide — no support call needed.",
    sections: [
      { heading: "Open the full guide", paragraphs: ["This guide has a searchable router-brand table, troubleshooting accordion and a printable cheat-sheet. Open the full guide at /help/own-router-setup."] },
    ],
    faqs: [
      { question: "Where do I find my PPPoE username and password?", answer: "They're in your OCCTA welcome / go-live email. We never display real PPPoE credentials on public pages." },
      { question: "Can I use any router?", answer: "Most routers that support PPPoE work fine. Some ISP-supplied routers may be locked to that provider." },
    ],
    related: ["getting-started", "router-setup", "no-internet-troubleshooting"],
  },
];

export const helpCategories = [
  "Getting Started",
  "Billing & Payments",
  "Troubleshooting",
  "Digital Voice",
  "Moving & Switching",
  "Account",
] as const;

export function getHelpArticle(slug: string) {
  return helpArticles.find((a) => a.slug === slug);
}