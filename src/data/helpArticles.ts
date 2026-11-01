// Self-service help centre articles. Rendered by /help, /help/:slug, the
// /support hub search and the chat help panel. Pure data, no DB.
//
// Accuracy rules (every article must follow them):
// - Payment is Direct Debit or bank transfer ONLY (see _shared/paymentOptions.ts).
//   Never mention card, phone or "pay now" payment.
// - Facts must match src/lib/legal/contractInformation.ts (the live consumer
//   agreement). Do not invent fees, SLAs, compensation schemes or support hours.
// - Do not name an ADR provider, promise 24/7 support or quote a fixed
//   suspension timing — the contract does not.
// - Every `related` slug must exist in this file (checked by unit test).

import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

export interface HelpFAQ { question: string; answer: string }
export interface HelpSection { heading: string; paragraphs: string[]; bullets?: string[] }

export const helpCategories = [
  "Getting Started",
  "Broadband & Wi-Fi",
  "Faults & Outages",
  "Mobile & SIM",
  "Digital Voice",
  "Billing & Payments",
  "Moving & Switching",
  "Account & Security",
  "Extra Help & Accessibility",
  "Complaints & Your Rights",
] as const;

export type HelpCategory = typeof helpCategories[number];

export interface HelpArticle {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  category: HelpCategory;
  readMinutes: number;
  intro: string;
  sections: HelpSection[];
  faqs: HelpFAQ[];
  related?: string[];
}

const EMAIL = "hello@occta.co.uk";
const PHONE = CONTACT_PHONE_DISPLAY;
const HOURS = "Monday to Friday, 8am to 6pm (excluding bank holidays)";
const BANK = "OCCTA LIMITED, Lloyds Bank, sort code 30-98-97, account number 61499362";

export const helpArticles: HelpArticle[] = [
  /* ------------------------------------------------------------------ */
  /* Getting Started                                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: "getting-started",
    title: "Getting Started With Your OCCTA Service",
    metaTitle: "Getting Started — OCCTA Help Centre",
    description: "Everything you need on day one with OCCTA broadband and Digital Voice: plugging in, lights, Wi-Fi, first speed checks and where to find your account.",
    keywords: "occta getting started, new broadband setup, router setup, wifi setup uk, first day broadband",
    category: "Getting Started",
    readMinutes: 6,
    intro: "Welcome to OCCTA. This page takes you from 'the box has arrived' to 'everyone's online' in about ten minutes. If something doesn't match what you see, the troubleshooting links at the bottom will get you sorted.",
    sections: [
      { heading: "Before go-live day", paragraphs: ["We email you the confirmed go-live date once the network has accepted your order. Keep that email — it also contains your account number and, if you're using your own router, the connection (PPPoE) details you need.", "Your billing only starts once your service is confirmed live. If an engineer visit is needed, we'll confirm the date and time slot with you in advance."] },
      { heading: "Check what equipment you ordered", paragraphs: ["A router isn't included as standard. Your order and Contract Summary say whether you bought, rented or are using your own equipment. If OCCTA sent you a router, the box contains the router, power supply and an Ethernet cable."], bullets: ["Bought or rented an OCCTA router — follow the steps below.", "Using your own router — follow our own-router (PPPoE) guide instead.", "Full fibre (FTTP) — the router connects to the Openreach ONT box, not the phone socket."] },
      { heading: "Plug it in", paragraphs: ["Part-fibre (SOGEA/FTTC): connect the router's DSL port to the master phone socket using the cable supplied. Full fibre (FTTP): connect the router's WAN port to the LAN 1 port on the ONT with an Ethernet cable. Then power the router on and wait up to 10 minutes for it to connect."], bullets: ["Use the master socket, not an extension socket.", "A solid internet light usually means you're online; flashing means it's still connecting.", "Don't power it off while it's updating on first boot."] },
      { heading: "Connect your devices", paragraphs: ["The Wi-Fi name (SSID) and password are printed on the router label. Connect once and your devices remember it. We recommend changing the Wi-Fi password to something only your household knows."] },
      { heading: "Run a fair speed test", paragraphs: ["For an accurate reading, test with a laptop plugged in by Ethernet, with other devices paused. Lines can take a few days to settle after activation, so early variation is normal. Compare your result with the speeds shown in your Contract Summary."] },
      { heading: "Sign in to your account", paragraphs: ["Your online account lets you view invoices, check Direct Debit status, raise and track tickets, update your details and download your Contract Summary. Sign in at occta.co.uk with the email address you ordered with."] },
    ],
    faqs: [
      { question: "When does my billing start?", answer: "Only once your service is confirmed live. Your first invoice may include a pro-rata amount and any one-off charges shown in your Contract Summary." },
      { question: "My speed is lower than expected — should I worry?", answer: "Give the line a few days to settle and test over Ethernet. If you're still well below the speeds in your Contract Summary, raise a ticket and we'll investigate with the network." },
      { question: "Can I use my own router?", answer: "Yes, on most services. Use the PPPoE username and password in your go-live email and follow our own-router setup guide." },
    ],
    related: ["order-to-activation-timeline", "router-setup", "own-router-setup", "broadband-speed-check"],
  },
  {
    slug: "order-to-activation-timeline",
    title: "From Order to Go-Live: What Happens and When",
    metaTitle: "Order & Activation Timeline — OCCTA Help",
    description: "What happens after you order OCCTA broadband: order checks, network acceptance, switch dates, engineer visits and go-live — and how to track it.",
    keywords: "broadband activation time uk, when will my broadband be live, occta order status",
    category: "Getting Started",
    readMinutes: 4,
    intro: "Ordering broadband involves OCCTA, the access network (usually Openreach) and, if you're switching, your old provider. Here's the order of events so you always know where you are.",
    sections: [
      { heading: "1. Order and documents", paragraphs: ["Before you commit, you receive your Contract Summary and Contract Information. Your agreement only starts once you accept the order. Your 14-day cooling-off period runs from that point."] },
      { heading: "2. Address and network checks", paragraphs: ["We validate your address and the exact product available on your line. If the ordered product can't be supplied, we won't silently swap it — we'll explain the alternatives and ask you first."] },
      { heading: "3. Network acceptance and go-live date", paragraphs: ["Once the network accepts the order, we confirm your go-live date by email. If you're switching from another provider using One Touch Switch, we coordinate the switch date with them — you don't need to call your old provider."] },
      { heading: "4. Engineer visit (only if needed)", paragraphs: ["Some orders — mostly new full-fibre installs or new lines — need an engineer. An adult aged 18 or over must be present. See our engineer appointments guide for how to prepare."] },
      { heading: "5. Go-live", paragraphs: ["On go-live day the line is switched over, usually during the day. Plug in your router (or keep it plugged in) and it will connect once the network completes the work. You'll get a confirmation from us."] },
    ],
    faqs: [
      { question: "How do I check my order status?", answer: "Use Track Order on our website or sign in to your account. You can also raise a ticket and we'll give you a full update." },
      { question: "Can I change my go-live date?", answer: "Often, yes, if the network hasn't started the work. Contact us as early as possible with your preferred date." },
      { question: "Will I be without internet when switching?", answer: "With One Touch Switch the changeover is coordinated, so any downtime on the day is usually short." },
    ],
    related: ["getting-started", "engineer-appointments", "switching-to-occta", "cooling-off-cancellation"],
  },
  {
    slug: "engineer-appointments",
    title: "Engineer Appointments: How to Prepare",
    metaTitle: "Engineer Appointments — OCCTA Help",
    description: "When an engineer visit is needed, what the engineer does, how to prepare, how to rearrange and when missed-appointment charges can apply.",
    keywords: "openreach engineer visit, fibre installation appointment, missed engineer appointment charge",
    category: "Getting Started",
    readMinutes: 4,
    intro: "Most switches happen without anyone visiting. Where an engineer is needed, a little preparation makes it quick and avoids a wasted trip.",
    sections: [
      { heading: "When an engineer is needed", paragraphs: ["Typically for a new full-fibre (FTTP) install, a brand-new line, or a fault that can't be fixed remotely. We'll always tell you before booking and confirm the date and time slot."] },
      { heading: "On the day", paragraphs: ["An adult aged 18 or over must be at home for the whole slot and give safe access to where the line enters the property and where you'd like the router."], bullets: ["Clear access to the master socket or the outside wall where fibre enters.", "Know where you'd like the ONT/router — near a power socket.", "Keep pets secured and parking available if you can.", "Engineers carry ID — always ask to see it."] },
      { heading: "Need to rearrange?", paragraphs: [`Tell us as early as possible — ideally at least two working days before. Email ${EMAIL} or raise a ticket. Late changes may not be possible on the network's side.`] },
      { heading: "Missed appointments and extra work", paragraphs: ["If the network charges for a missed appointment, no access, or extra work caused on the customer's side, we pass on only the actual network charge, and only where it was disclosed and is fair. We'll tell you about any known charge before you agree to the appointment."] },
    ],
    faqs: [
      { question: "How long does a visit take?", answer: "Usually one to three hours, depending on the work. Full-fibre installs that need cable routing take longer." },
      { question: "Will the engineer drill holes?", answer: "Full-fibre installs may need a small hole through an outside wall. The engineer will agree the route with you first." },
    ],
    related: ["order-to-activation-timeline", "getting-started", "report-a-fault"],
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
      { question: "Can I use any router?", answer: "Most routers that support PPPoE work fine. Some routers supplied by other providers are locked to that provider." },
    ],
    related: ["getting-started", "router-setup", "no-internet-troubleshooting"],
  },
  {
    slug: "contract-summary-explained",
    title: "Your Contract Summary, Explained",
    metaTitle: "Contract Summary Explained — OCCTA Help",
    description: "What's in your OCCTA Contract Summary: price, minimum term, speeds, notice period, early termination and how to download a copy.",
    keywords: "broadband contract summary, what is a contract summary, occta contract",
    category: "Getting Started",
    readMinutes: 4,
    intro: "Your Contract Summary is the short, legally required document that sets out the key facts of your service. It's the first place to look if you want to know what you agreed to.",
    sections: [
      { heading: "What it shows", paragraphs: ["Every Contract Summary covers the same core points so you can compare providers fairly."], bullets: ["Your service and broadband technology (full fibre or part fibre).", "Monthly price and any one-off charges.", "Minimum term (Flex 30 has none; Price Lock 24 is 24 months).", "Address-specific speed estimates and any minimum guaranteed speed provided by the network.", "Notice period and how any Early Termination Charge is worked out.", "How to contact us and how to complain."] },
      { heading: "Flex 30 vs Price Lock 24", paragraphs: ["Flex 30 is a 30-day rolling service with no minimum term and no remaining-month early termination charge. Price Lock 24 keeps your broadband price fixed for a 24-month minimum term; leaving early may mean an Early Termination Charge, which never exceeds the recurring charges remaining."] },
      { heading: "Our price promise", paragraphs: ["OCCTA doesn't build CPI, RPI or percentage-based annual price rises into residential contracts. If we ever needed to change a price in a way that gives you a right to leave, we'd tell you in writing in advance and explain that right."] },
      { heading: "Getting a copy", paragraphs: ["Sign in to your account to view and download your accepted Contract Summary at any time. Accepted documents are versioned — a later website change never silently replaces what you agreed."] },
    ],
    faqs: [
      { question: "Which takes priority — the website or my Contract Summary?", answer: "Your Contract Summary and order. Customer-specific prices, speeds and terms in those documents take priority over general website information." },
      { question: "I can't find my Contract Summary.", answer: "Sign in and look under your account documents, or raise a ticket and we'll resend it." },
    ],
    related: ["price-changes-promise", "cancel-or-switch", "cooling-off-cancellation", "broadband-speed-check"],
  },

  /* ------------------------------------------------------------------ */
  /* Broadband & Wi-Fi                                                   */
  /* ------------------------------------------------------------------ */
  {
    slug: "router-setup",
    title: "Router Setup: Lights, Ports & Common Issues",
    metaTitle: "Router Setup — OCCTA Help Centre",
    description: "What the lights on your router usually mean, which port does what, and how to fix the most common router issues in a couple of minutes.",
    keywords: "occta router lights, router setup uk, router ports explained",
    category: "Broadband & Wi-Fi",
    readMinutes: 4,
    intro: "Your router quietly does a lot. Here's how to read it at a glance and fix the routine stuff yourself. Exact light colours vary by model — check the quick-start card that came with yours.",
    sections: [
      { heading: "What the lights usually mean", paragraphs: ["Most routers follow a similar pattern:"], bullets: ["Power: solid = on; off = no power (check the plug and socket).", "Internet / WAN: solid = online; flashing = connecting; red or off = no connection to the network.", "Wi-Fi: solid or flickering = broadcasting; off = Wi-Fi switched off.", "Phone (Digital Voice): solid = phone service registered."] },
      { heading: "Which port does what", paragraphs: ["Port labels vary, but these are the common ones:"], bullets: ["DSL / Broadband: to the master phone socket (part fibre).", "WAN (often blue or red): to the ONT on full fibre.", "LAN 1–4 (often yellow): wired devices such as TVs, consoles and PCs.", "Phone / Tel: your home phone handset on Digital Voice."] },
      { heading: "The two-minute restart", paragraphs: ["Turn the router off at the wall, wait 30 seconds and turn it back on. Give it 5 to 10 minutes to reconnect before testing. A restart clears most temporary glitches."] },
      { heading: "Factory reset (last resort)", paragraphs: ["Holding the reset pin for 10–15 seconds wipes all settings, including your Wi-Fi name and password and any own-router PPPoE details. Only do this if we ask you to, or if you have your connection details to hand."] },
    ],
    faqs: [
      { question: "Should I leave the router on all the time?", answer: "Yes. Leave it powered on unless you're troubleshooting. Repeatedly turning it off can make the network think the line is unstable." },
      { question: "My router is in a cupboard — is that a problem?", answer: "Usually, yes. Cupboards and metal cabinets weaken Wi-Fi. Move it into the open if you can." },
    ],
    related: ["slow-wifi-fix", "no-internet-troubleshooting", "change-wifi-name-password", "own-router-setup"],
  },
  {
    slug: "slow-wifi-fix",
    title: "Why Your Wi-Fi Is Slow (and 6 Things That Actually Fix It)",
    metaTitle: "Slow Wi-Fi — Fix It in 5 Minutes | OCCTA Help",
    description: "Wi-Fi feeling slow? Often it's the Wi-Fi in your home rather than the broadband. Here's how to tell the difference and how to fix it.",
    keywords: "slow wifi fix uk, wifi vs broadband speed, boost wifi signal",
    category: "Broadband & Wi-Fi",
    readMinutes: 6,
    intro: "If a speed test is fast over an Ethernet cable but slow on Wi-Fi, your broadband is fine — the Wi-Fi in your home is the bottleneck. Work through these in order.",
    sections: [
      { heading: "1. Move the router", paragraphs: ["Raised, central, in the open. Keep it away from thick walls, mirrors, fish tanks, microwaves and metal."] },
      { heading: "2. Use the 5 GHz band", paragraphs: ["Most routers broadcast 2.4 GHz and 5 GHz. 5 GHz is much faster at short range; 2.4 GHz reaches further but is slower and busier. Put nearby devices on 5 GHz."] },
      { heading: "3. Let it pick a quieter channel", paragraphs: ["Neighbouring networks compete with yours. Restarting the router usually makes it choose a less crowded channel; many routers also have an 'auto' channel setting."] },
      { heading: "4. Update your devices", paragraphs: ["Old phones, laptops and smart TVs often have weak Wi-Fi. Install updates and, if a device is very old, test with a newer one to compare."] },
      { heading: "5. Add mesh for bigger homes", paragraphs: ["Large homes, extensions and thick stone walls often need more than one access point. A mesh Wi-Fi system spreads coverage evenly. Avoid cheap plug-in extenders where possible — they often halve speed."] },
      { heading: "6. Plug in the big stuff", paragraphs: ["Smart TVs, games consoles and desktop PCs are best on an Ethernet cable. It frees up Wi-Fi for phones and laptops."] },
    ],
    faqs: [
      { question: "How do I know if it's Wi-Fi or the broadband?", answer: "Run a speed test on a laptop connected by Ethernet. If that's fast and Wi-Fi is slow, it's Wi-Fi. If both are slow, see our speed check guide." },
      { question: "Can OCCTA supply mesh Wi-Fi?", answer: "Equipment options vary by plan. Ask us and we'll tell you what's available for your service." },
    ],
    related: ["broadband-speed-check", "router-setup", "change-wifi-name-password", "gaming-latency"],
  },
  {
    slug: "broadband-speed-check",
    title: "Checking Your Broadband Speed Properly",
    metaTitle: "Broadband Speed Check & Speed Problems — OCCTA Help",
    description: "How to run a fair broadband speed test, what the speeds in your Contract Summary mean, and what to do if your speed is persistently low.",
    keywords: "broadband speed test uk, slow broadband, minimum guaranteed speed, occta speed",
    category: "Broadband & Wi-Fi",
    readMinutes: 5,
    intro: "A speed test is only useful if it's done fairly. Here's how to test properly and what your rights are if your speed falls short.",
    sections: [
      { heading: "How to test fairly", paragraphs: ["Small changes make a big difference to the result."], bullets: ["Use a laptop or PC connected to the router with an Ethernet cable.", "Pause downloads, streaming, backups and game updates on other devices.", "Test at different times of day — evenings are busiest.", "Run three tests and note the average.", "Restart the router first if it hasn't been restarted in a while."] },
      { heading: "Understanding your speeds", paragraphs: ["Your Contract Summary shows address-specific speed estimates from the network and, where available, a minimum guaranteed speed. These aren't 'up to' marketing figures — they're what's realistically expected on your line. Wi-Fi speeds will usually be lower than wired."] },
      { heading: "If your speed is persistently low", paragraphs: ["Raise a ticket with your wired test results, times and dates. We'll run line tests and investigate with the network. If there's a significant, continuous or regularly recurring shortfall against what your contract states, the remedies required by law and regulation are available — which can include repair, a price reduction or the right to end the affected service without penalty."] },
    ],
    faqs: [
      { question: "Why is my speed lower in the evening?", answer: "More people are online. Some slowdown is normal; a large, consistent drop is worth reporting." },
      { question: "Do you throttle streaming or gaming?", answer: "No. OCCTA doesn't block or throttle lawful apps or content for commercial reasons. Temporary, proportionate measures may be used only for security, legal or exceptional congestion reasons." },
      { question: "Is there a data cap?", answer: "Standard residential broadband has no monthly data cap unless your order says otherwise." },
    ],
    related: ["slow-wifi-fix", "report-a-fault", "contract-summary-explained", "intermittent-dropouts"],
  },
  {
    slug: "change-wifi-name-password",
    title: "Change Your Wi-Fi Name and Password",
    metaTitle: "Change Wi-Fi Name & Password — OCCTA Help",
    description: "How to log in to your router and change your Wi-Fi network name (SSID) and password, and how to keep your home network secure.",
    keywords: "change wifi password, change ssid, router admin login uk",
    category: "Broadband & Wi-Fi",
    readMinutes: 3,
    intro: "Changing the default Wi-Fi password is one of the simplest ways to keep your home network secure.",
    sections: [
      { heading: "Log in to the router", paragraphs: ["Connect to your router (Wi-Fi or Ethernet) and open a browser. The admin address and admin password are usually on the router label — commonly 192.168.1.1 or 192.168.0.1."] },
      { heading: "Change the name and password", paragraphs: ["Find the Wireless or Wi-Fi settings. Change the network name (SSID) and password, then save. Your devices will disconnect — reconnect them using the new details."], bullets: ["Use WPA2 or WPA3 security, never 'open' or WEP.", "Choose a long password — three random words works well.", "Don't use your name, address or house number in the network name."] },
      { heading: "Change the admin password too", paragraphs: ["The router's admin password is different from the Wi-Fi password. Change it so nobody else on the network can alter your settings."] },
    ],
    faqs: [
      { question: "I've forgotten the admin password.", answer: "Try the default on the router label. If it's been changed and you can't remember it, a factory reset restores the defaults — but you'll need to set the router up again." },
    ],
    related: ["router-setup", "parental-controls-and-safety", "scams-and-phishing"],
  },
  {
    slug: "parental-controls-and-safety",
    title: "Parental Controls and Staying Safe Online",
    metaTitle: "Parental Controls — OCCTA Help",
    description: "Options for filtering content, setting device schedules and keeping children safer online with OCCTA broadband.",
    keywords: "broadband parental controls uk, block websites router, internet safety children",
    category: "Broadband & Wi-Fi",
    readMinutes: 4,
    intro: "No single filter catches everything, but a few layers together make the internet much safer for younger family members.",
    sections: [
      { heading: "Router-level controls", paragraphs: ["Many routers can pause internet for specific devices, set bedtime schedules and block categories of sites. Look for 'Parental controls' or 'Access control' in your router's settings."] },
      { heading: "Device and app controls", paragraphs: ["Phones, tablets, consoles and streaming services all have their own built-in controls — Screen Time on Apple devices, Family Link on Android, and family settings on consoles. These work on mobile data and other Wi-Fi too."] },
      { heading: "Family-safe DNS", paragraphs: ["Free family DNS services can filter adult content across your whole network. You set them in your router's DNS settings."] },
      { heading: "Talk about it", paragraphs: ["Filters help, but conversations matter more. Organisations such as the UK Safer Internet Centre and Internet Matters publish free, practical guides for parents."] },
    ],
    faqs: [
      { question: "Can OCCTA switch on filtering for me?", answer: "Ask us what's available for your service. Where a customer-chosen filter is offered, we only apply it at your request." },
    ],
    related: ["change-wifi-name-password", "scams-and-phishing"],
  },
  {
    slug: "gaming-latency",
    title: "Lag, Ping and Gaming Performance",
    metaTitle: "Reduce Lag & Ping for Gaming — OCCTA Help",
    description: "Why online games lag, how to measure ping, jitter and packet loss, and practical fixes for smoother gaming on OCCTA broadband.",
    keywords: "high ping fix, gaming lag broadband uk, packet loss fix",
    category: "Broadband & Wi-Fi",
    readMinutes: 4,
    intro: "For gaming and video calls, responsiveness (ping) matters more than raw download speed. Most lag comes from the home network.",
    sections: [
      { heading: "Quick wins", paragraphs: ["Try these first:"], bullets: ["Use an Ethernet cable for the console or PC.", "Pause downloads, cloud backups and 4K streams while playing.", "Pick a game server close to the UK.", "Restart the router if it's been on for weeks."] },
      { heading: "Measuring the problem", paragraphs: ["Note your ping, jitter and packet loss from the game's network stats or a speed test site, along with the time it happens. Consistent packet loss over Ethernet is worth reporting to us."] },
      { heading: "What we can investigate", paragraphs: ["We don't offer a separate latency guarantee unless your order says so, but we will investigate material quality faults — such as sustained packet loss — with the network."] },
    ],
    faqs: [
      { question: "Will a faster package fix lag?", answer: "Not usually. Lag is mostly about latency and congestion in the home, not package speed." },
    ],
    related: ["slow-wifi-fix", "intermittent-dropouts", "broadband-speed-check"],
  },

  /* ------------------------------------------------------------------ */
  /* Faults & Outages                                                    */
  /* ------------------------------------------------------------------ */
  {
    slug: "no-internet-troubleshooting",
    title: "No Internet? Try This Before You Contact Us",
    metaTitle: "No Internet — Troubleshooting | OCCTA Help",
    description: "Step-by-step diagnosis for when your OCCTA broadband stops working. Many problems are fixed in a few minutes.",
    keywords: "broadband not working uk, no internet fix, occta outage",
    category: "Faults & Outages",
    readMinutes: 4,
    intro: "Work through these steps in order. They're the same checks our team runs, so doing them first gets you a faster fix either way.",
    sections: [
      { heading: "Step 1 — Check the service status page", paragraphs: ["From mobile data, open occta.co.uk/status. If there's a known incident or planned maintenance in your area, updates are posted there and you don't need to report it."] },
      { heading: "Step 2 — Check power and cables", paragraphs: ["Make sure the router (and the ONT on full fibre) has power, and that every cable is firmly pushed in. On full fibre, a red LOS/alarm light on the ONT means a fibre problem — report it straight away and don't unplug the fibre."] },
      { heading: "Step 3 — Restart the router", paragraphs: ["Turn it off at the wall for 30 seconds, then back on. Wait 10 minutes."] },
      { heading: "Step 4 — Test with a cable", paragraphs: ["Plug a laptop into the router with Ethernet. If that works, the broadband is fine and the problem is Wi-Fi or one device."] },
      { heading: "Step 5 — Part fibre: try the test socket", paragraphs: ["If you have an Openreach master socket with a removable faceplate, plug the router into the test socket behind it. If it works there, the fault is inside your home wiring."] },
      { heading: "Step 6 — Report it", paragraphs: ["Still down? Report a fault through your account or our support page. Tell us your account number, what the lights are doing and what you've already tried — it saves time."] },
    ],
    faqs: [
      { question: "Will I be credited for an outage?", answer: "Credits and compensation apply where required by law or included in your order. If you've had a long outage, tell us and we'll explain what's available to you." },
      { question: "Can an engineer visit cost me anything?", answer: "If the fault turns out to be on the network, no. If it's caused by your own wiring or equipment, a network charge may apply — we'll tell you before booking." },
    ],
    related: ["report-a-fault", "service-status-and-outages", "router-setup", "slow-wifi-fix"],
  },
  {
    slug: "report-a-fault",
    title: "How to Report a Fault — and What Happens Next",
    metaTitle: "Report a Fault — OCCTA Help",
    description: "The fastest way to report a broadband, phone or SIM fault to OCCTA, what information to include and how faults are fixed.",
    keywords: "report broadband fault uk, occta fault, broadband repair",
    category: "Faults & Outages",
    readMinutes: 4,
    intro: "If the basic checks haven't fixed it, report the fault and we'll take it from there. Good information up front is the single biggest factor in how fast it gets fixed.",
    sections: [
      { heading: "How to report", paragraphs: [`Raise a ticket from your account (Support → New ticket) so it's tracked from the start. You can also email ${EMAIL} or call ${PHONE}, ${HOURS}.`] },
      { heading: "What to include", paragraphs: ["The more detail, the faster the fix:"], bullets: ["Your account number and service address.", "When it started and whether it's constant or comes and goes.", "What the router (and ONT) lights are doing.", "Wired speed test results if the service is slow.", "What you've already tried.", "Whether anyone relies on the line for telecare, health or safety — we'll prioritise it."] },
      { heading: "What we do", paragraphs: ["We run remote line tests, check for network incidents and, if needed, raise the fault with the access network and book an engineer with you. We keep you updated on the ticket until it's resolved."] },
      { heading: "If a fix takes too long", paragraphs: ["Where a confirmed fault isn't fixed within the time that applies to your service, contact us and we'll explain any credit or remedy available, alongside your legal and regulatory rights."] },
    ],
    faqs: [
      { question: "Is phone or ticket faster?", answer: "A ticket with good detail is usually fastest, because it goes straight into the fault process with everything we need." },
      { question: "Do I need to be in for a repair?", answer: "Only if the network needs to access your property. We'll confirm the slot with you." },
    ],
    related: ["no-internet-troubleshooting", "intermittent-dropouts", "engineer-appointments", "digital-voice-telecare"],
  },
  {
    slug: "intermittent-dropouts",
    title: "Broadband Keeps Dropping Out",
    metaTitle: "Broadband Keeps Dropping — OCCTA Help",
    description: "How to diagnose broadband that keeps disconnecting: Wi-Fi drops vs line drops, common causes and what to record before reporting.",
    keywords: "broadband keeps dropping, internet keeps disconnecting uk, intermittent broadband fault",
    category: "Faults & Outages",
    readMinutes: 4,
    intro: "Intermittent problems are the hardest to pin down, so it's worth working out whether it's the line or the Wi-Fi that's dropping.",
    sections: [
      { heading: "Line drop or Wi-Fi drop?", paragraphs: ["Watch the router's internet light when it happens. If the internet light goes off or flashes, the line is dropping. If it stays solid while devices lose connection, it's Wi-Fi."] },
      { heading: "Common causes", paragraphs: ["The usual suspects:"], bullets: ["Extension leads, phone extension wiring or faulty microfilters on part fibre.", "Router overheating in a cupboard.", "Electrical interference from lamps, chargers or appliances near cables.", "Wi-Fi congestion or devices roaming between mesh points."] },
      { heading: "Keep a short log", paragraphs: ["Note the date, time and how long each drop lasts for a few days. Combined with our line tests, it helps us prove the fault to the network quickly."] },
    ],
    faqs: [
      { question: "Will restarting the router help?", answer: "Once, yes. Restarting it repeatedly can make the line look unstable and slow it down, so avoid frequent restarts." },
    ],
    related: ["report-a-fault", "slow-wifi-fix", "no-internet-troubleshooting"],
  },
  {
    slug: "service-status-and-outages",
    title: "Service Status, Outages and Planned Maintenance",
    metaTitle: "Service Status & Outages — OCCTA Help",
    description: "Where to check for OCCTA network incidents and planned maintenance, how we keep you updated and what to do during an outage.",
    keywords: "occta status, broadband outage uk, network maintenance",
    category: "Faults & Outages",
    readMinutes: 3,
    intro: "Before reporting a fault, it's worth checking whether there's already a known issue.",
    sections: [
      { heading: "Check the status page", paragraphs: ["occta.co.uk/status shows current incidents and planned maintenance. Open it on mobile data if your broadband is down."] },
      { heading: "Planned maintenance", paragraphs: ["Planned and urgent maintenance can briefly interrupt service. Where reasonably practicable, we give advance notice of planned work likely to cause a material interruption."] },
      { heading: "During an outage", paragraphs: ["If you rely on Digital Voice for emergencies, use a mobile to call 999 or 112. If someone in your home depends on the line for telecare or health reasons, tell us so we can prioritise and discuss resilience options."] },
    ],
    faqs: [
      { question: "The status page shows no issues but I'm offline.", answer: "Then it's likely specific to your line or equipment. Follow the No Internet checklist and report a fault." },
    ],
    related: ["no-internet-troubleshooting", "report-a-fault", "digital-voice-telecare"],
  },

  /* ------------------------------------------------------------------ */
  /* Mobile & SIM                                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: "activate-sim",
    title: "Activating Your OCCTA SIM",
    metaTitle: "Activate Your SIM — OCCTA Help",
    description: "How to activate your OCCTA SIM card, check it's working, and what to do if it doesn't connect.",
    keywords: "activate sim card uk, new sim not working, occta sim",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "Your SIM is usually ready to go within a few minutes of inserting it. Here's how to get connected.",
    sections: [
      { heading: "Insert and restart", paragraphs: ["Power your phone off, insert the SIM (gold contacts facing down), then power it on. Follow any activation instructions we sent by email or text."] },
      { heading: "Check it's working", paragraphs: ["You should see the network name and signal bars within a few minutes. Make a short call, send a text and turn off Wi-Fi to test mobile data."] },
      { heading: "If you're keeping your number", paragraphs: ["Your new SIM may work on a temporary number until your old number transfers. Once the port completes, your old SIM stops working and your number moves to the OCCTA SIM."] },
      { heading: "Not connecting?", paragraphs: ["Restart the phone, check the SIM is seated properly and make sure the phone isn't locked to another network. Then check your APN settings."] },
    ],
    faqs: [
      { question: "Which network will I be on?", answer: "OCCTA SIM plans are available on O2, Vodafone and EE. Your plan details show which network your SIM uses." },
      { question: "Is my phone locked?", answer: "Phones bought from some networks are locked. Try another network's SIM, or ask the original seller to unlock it." },
    ],
    related: ["esim-setup", "keep-your-mobile-number-pac", "apn-settings", "mobile-signal-troubleshooting"],
  },
  {
    slug: "esim-setup",
    title: "Setting Up an eSIM",
    metaTitle: "eSIM Setup — OCCTA Help",
    description: "Check if your phone supports eSIM, install your OCCTA eSIM with a QR code, and what to do when you change phones.",
    keywords: "esim setup uk, install esim qr code, esim iphone android",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "An eSIM is a digital SIM built into your phone — no plastic card, no waiting for the post.",
    sections: [
      { heading: "Check compatibility", paragraphs: ["Most recent iPhones, Google Pixels and Samsung Galaxy phones support eSIM. Your phone must also be unlocked."] },
      { heading: "Install it", paragraphs: ["Connect to Wi-Fi. On iPhone go to Settings → Mobile Service → Add eSIM; on Android go to Settings → Network & internet → SIMs → Add eSIM. Scan the QR code we sent you and follow the prompts."], bullets: ["Each QR code can usually only be used once — don't delete the eSIM unless you mean to.", "Label it 'OCCTA' so it's easy to identify if you use dual SIM."] },
      { heading: "Changing phones", paragraphs: ["Some phones can transfer eSIMs directly. If yours can't, contact us for a replacement eSIM before you wipe the old phone."] },
    ],
    faqs: [
      { question: "Can I have an eSIM and a physical SIM?", answer: "Yes, on dual-SIM phones — handy for keeping a work and personal number." },
    ],
    related: ["activate-sim", "apn-settings", "lost-or-stolen-phone"],
  },
  {
    slug: "keep-your-mobile-number-pac",
    title: "Keeping Your Mobile Number (PAC and STAC Codes)",
    metaTitle: "Keep Your Mobile Number — PAC Code | OCCTA Help",
    description: "How to bring your existing mobile number to OCCTA with a PAC code, or move away with a PAC or STAC — free and usually within one working day.",
    keywords: "pac code uk, keep my number, stac code, port mobile number",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "Switching mobile provider in the UK is text-to-switch: you request a code by text, and the new provider does the rest.",
    sections: [
      { heading: "Bringing your number to OCCTA", paragraphs: ["Text PAC to 65075 from your current phone. Your current provider must reply with a PAC code (valid for 30 days) by text. Give us the PAC when you order or by raising a ticket, and we'll arrange the transfer."] },
      { heading: "Leaving OCCTA", paragraphs: ["Text PAC to 65075 to keep your number, or STAC to 75075 to leave and get a new number. Your new provider handles the switch. These texts are free."] },
      { heading: "Timing", paragraphs: ["Number ports normally complete within one working day of the request being processed. You may lose signal for a short time on the day."] },
    ],
    faqs: [
      { question: "Will my old contract end automatically?", answer: "Yes — when the port completes, your old service ends. Check whether your old provider charges for any remaining minimum term." },
      { question: "My PAC has expired.", answer: "Request a new one by texting PAC to 65075 again." },
    ],
    related: ["activate-sim", "cancel-or-switch", "keep-your-landline-number"],
  },
  {
    slug: "apn-settings",
    title: "Mobile Data Not Working? Check Your APN",
    metaTitle: "APN Settings — OCCTA Help",
    description: "How to check and set the APN on iPhone and Android so mobile data and picture messages work on your OCCTA SIM.",
    keywords: "apn settings uk, mobile data not working, mms not working",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "If calls and texts work but mobile data doesn't, the APN (Access Point Name) is the usual cause.",
    sections: [
      { heading: "Check the basics first", paragraphs: ["Mobile data switched on, Aeroplane mode off, and data roaming on if you're abroad. Restart the phone."] },
      { heading: "Setting the APN", paragraphs: ["The correct APN depends on the network your plan uses and is included in your SIM setup information. Most phones set it automatically."], bullets: ["iPhone: Settings → Mobile Service → Mobile Data Network.", "Android: Settings → Network & internet → SIMs → Access Point Names.", "Enter the details exactly as given, save and restart."] },
      { heading: "Still no data?", paragraphs: ["Raise a ticket with your phone model and what you've tried. We'll send the right settings or check the SIM on our side."] },
    ],
    faqs: [
      { question: "Do I need an APN for Wi-Fi calling?", answer: "No. Wi-Fi calling depends on your phone and network support, not the APN." },
    ],
    related: ["activate-sim", "mobile-signal-troubleshooting", "roaming-abroad"],
  },
  {
    slug: "mobile-signal-troubleshooting",
    title: "No Signal or Poor Mobile Coverage",
    metaTitle: "No Mobile Signal — OCCTA Help",
    description: "What to do when your OCCTA SIM shows no signal or poor coverage, how to check network coverage and when to report a fault.",
    keywords: "no mobile signal uk, sim no service, poor coverage",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "Signal problems are usually about location, the phone or a temporary network issue. Here's how to tell which.",
    sections: [
      { heading: "Quick checks", paragraphs: ["Try these first:"], bullets: ["Restart the phone and toggle Aeroplane mode on and off.", "Check network selection is set to automatic.", "Try the SIM in another phone, or another SIM in your phone.", "Clean the SIM and tray and reseat it."] },
      { heading: "Check coverage", paragraphs: ["Use your network's (O2, Vodafone or EE) online coverage checker for your postcode. Coverage indoors can be weaker, especially in thick-walled or new-build homes — Wi-Fi calling can help there."] },
      { heading: "Report it", paragraphs: ["If you've lost signal where it used to work, raise a ticket with the postcode, the times, and your phone model. We'll check for network issues and the SIM's status."] },
    ],
    faqs: [
      { question: "Can I still call 999 with no signal from my network?", answer: "Yes — UK phones can make 999 and 112 calls on any available network, even without credit." },
    ],
    related: ["activate-sim", "apn-settings", "lost-or-stolen-phone"],
  },
  {
    slug: "lost-or-stolen-phone",
    title: "Lost or Stolen Phone or SIM",
    metaTitle: "Lost or Stolen Phone — OCCTA Help",
    description: "What to do straight away if your phone or OCCTA SIM is lost or stolen: blocking the SIM, protecting your accounts and getting a replacement.",
    keywords: "lost phone uk, stolen sim block, replacement sim",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "Act quickly — it limits the risk of someone running up charges or using your number to get into your accounts.",
    sections: [
      { heading: "1. Tell us straight away", paragraphs: [`Contact us on ${PHONE} (${HOURS}) or email ${EMAIL} so we can bar the SIM. Outside hours, email us — we act on it as soon as the team is back.`] },
      { heading: "2. Lock or erase the phone", paragraphs: ["Use Find My (Apple) or Find My Device (Google) to lock, locate or erase it."] },
      { heading: "3. Secure your accounts", paragraphs: ["Change passwords for email, banking and social media, and check any accounts that use text-message codes. Tell your bank if banking apps were on the phone."] },
      { heading: "4. Report theft", paragraphs: ["Report a stolen phone to the police on 101 (or online) and get a crime reference number for insurance."] },
      { heading: "5. Get a replacement SIM", paragraphs: ["We'll send a replacement SIM or eSIM on the same number once we've verified your identity."] },
    ],
    faqs: [
      { question: "Am I liable for calls made after theft?", answer: "Tell us as soon as you can. The sooner the SIM is barred, the lower the risk of misuse." },
    ],
    related: ["scams-and-phishing", "esim-setup", "sign-in-and-password"],
  },
  {
    slug: "roaming-abroad",
    title: "Using Your OCCTA SIM Abroad",
    metaTitle: "Roaming Abroad — OCCTA Help",
    description: "How roaming works on OCCTA SIM plans, how to check what's included before you travel, and tips to avoid unexpected charges.",
    keywords: "roaming abroad uk sim, eu roaming, travel mobile data",
    category: "Mobile & SIM",
    readMinutes: 3,
    intro: "Roaming depends on your specific plan, so a two-minute check before you travel avoids surprises.",
    sections: [
      { heading: "Check your plan", paragraphs: ["Your plan details show whether roaming is included, which destinations apply and any charges or limits. If in doubt, ask us before you go."] },
      { heading: "On your phone", paragraphs: ["Turn on data roaming when you arrive if your plan includes it. Turn it off if you want to avoid using data abroad."] },
      { heading: "Save data abroad", paragraphs: ["Download maps, playlists and films before you go, use hotel Wi-Fi for big downloads and switch off automatic app updates."] },
    ],
    faqs: [
      { question: "Will I be charged for receiving calls abroad?", answer: "That depends on your plan and destination. Check your plan details or ask us before you travel." },
    ],
    related: ["apn-settings", "mobile-signal-troubleshooting"],
  },

  /* ------------------------------------------------------------------ */
  /* Digital Voice                                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: "digital-voice-setup",
    title: "Digital Voice (Home Phone) Setup",
    metaTitle: "Digital Voice Setup — OCCTA Help",
    description: "How to set up your OCCTA Digital Voice home phone, port your old number, and what you need to know about emergency calls.",
    keywords: "digital voice setup uk, landline replacement, voip home phone",
    category: "Digital Voice",
    readMinutes: 4,
    intro: "Digital Voice replaces the old analogue landline with calls carried over your broadband. The UK is moving every home to digital phone lines, so this is the future-proof option.",
    sections: [
      { heading: "Plug in your phone", paragraphs: ["Connect your home phone to the Phone or Tel port on your router (not the wall socket). Pick up the handset — you should hear a dial tone. Most standard corded and cordless phones work."] },
      { heading: "Keeping your number", paragraphs: ["If you asked to keep your existing number, we arrange the port. Don't cancel your old phone line yourself before the port completes — you could lose the number."] },
      { heading: "Emergency calls (999/112)", paragraphs: ["999 and 112 calls are free when Digital Voice is working. Digital Voice needs working broadband, compatible equipment and mains power, so it may not work during a power cut or broadband outage. Keep your service address up to date — emergency location information may depend on it."] },
      { heading: "Older devices", paragraphs: ["Alarm systems, telecare pendants, fax machines and older card terminals may not work with digital lines. Check with the device provider before switching."] },
    ],
    faqs: [
      { question: "Can I keep my existing handset?", answer: "Usually, yes. Plug it into the router's phone port." },
      { question: "What if my broadband goes down?", answer: "Your home phone won't work until it's restored. Use a mobile for urgent calls, and tell us if anyone relies on the line for health or safety." },
    ],
    related: ["digital-voice-telecare", "keep-your-landline-number", "nuisance-calls"],
  },
  {
    slug: "digital-voice-telecare",
    title: "Digital Voice, Telecare and Power Cuts",
    metaTitle: "Digital Voice & Telecare — OCCTA Help",
    description: "If you or someone you care for relies on a telecare alarm, health device or the landline for safety, here's how OCCTA supports the move to Digital Voice.",
    keywords: "telecare digital voice, digital switchover vulnerable, landline battery backup",
    category: "Digital Voice",
    readMinutes: 4,
    intro: "If anyone in your home relies on the phone line for safety — a telecare pendant, a health device, or because mobile coverage is poor — please tell us before or as soon as you switch.",
    sections: [
      { heading: "Tell us first", paragraphs: [`Let us know at order, by ticket, by email to ${EMAIL} or by phone on ${PHONE}. We record it sensitively and use it only to support you.`] },
      { heading: "Check telecare compatibility", paragraphs: ["Ask your telecare provider whether the device is compatible with digital phone lines. Many providers now supply digital-ready alarms."] },
      { heading: "Resilience options", paragraphs: ["We'll assess your circumstances and discuss resilience or alternative communication arrangements. Where appropriate and available, that can include backup equipment that keeps the phone working for a period during a power cut. No option guarantees service in every outage, so we'll explain the limits honestly."] },
      { heading: "Priority support", paragraphs: ["Accounts where someone relies on the line get priority handling when there's a service-affecting issue."] },
    ],
    faqs: [
      { question: "Is there a charge for this support?", answer: "Telling us and getting support is free. If equipment is involved, we'll explain any cost before anything is arranged." },
    ],
    related: ["digital-voice-setup", "vulnerable-customer-support", "service-status-and-outages"],
  },
  {
    slug: "keep-your-landline-number",
    title: "Keeping Your Home Phone Number",
    metaTitle: "Keep Your Landline Number — OCCTA Help",
    description: "How landline number porting works when you move to OCCTA Digital Voice or leave OCCTA, including timings and what not to do.",
    keywords: "port landline number uk, keep home phone number, number porting",
    category: "Digital Voice",
    readMinutes: 3,
    intro: "Most UK landline numbers can move with you to Digital Voice. The key rule: let the new provider handle it.",
    sections: [
      { heading: "Moving your number to OCCTA", paragraphs: ["Tell us the number and the account holder's name when you order. We handle the port with your current provider and confirm the date."] },
      { heading: "Don't cancel first", paragraphs: ["Cancelling your old line before the port completes can mean the number is lost for good."] },
      { heading: "Taking your number elsewhere", paragraphs: ["Ask your new provider to port the number. Where One Touch Switch applies, they coordinate it with us."] },
    ],
    faqs: [
      { question: "Can I keep my number if I move house?", answer: "Often, yes, if you stay in the same area. Ask us before you move and we'll check." },
    ],
    related: ["digital-voice-setup", "move-home", "switching-to-occta"],
  },
  {
    slug: "nuisance-calls",
    title: "Stopping Nuisance Calls and Spam Texts",
    metaTitle: "Block Nuisance Calls — OCCTA Help",
    description: "Practical ways to reduce nuisance calls and spam texts on your OCCTA home phone and mobile, and where to report them.",
    keywords: "block nuisance calls uk, tps register, report spam text 7726",
    category: "Digital Voice",
    readMinutes: 3,
    intro: "You can't stop every unwanted call, but you can cut them down a lot.",
    sections: [
      { heading: "Register with TPS", paragraphs: ["The Telephone Preference Service (tpsonline.org.uk) is free. UK companies must not make unsolicited sales calls to registered numbers. It covers landlines and mobiles."] },
      { heading: "Block and screen", paragraphs: ["Use your handset's call-block list, or a call-blocking phone. On mobiles, use the built-in 'silence unknown callers' or block settings."] },
      { heading: "Report spam texts", paragraphs: ["Forward spam texts to 7726 (free). Report persistent nuisance calls to the ICO."] },
      { heading: "Malicious or threatening calls", paragraphs: ["If calls are threatening, contact the police. Tell us too and we'll help with options."] },
    ],
    faqs: [
      { question: "Will OCCTA ever cold-call me to sell?", answer: "We don't use cold-call doorstep selling. If someone claiming to be OCCTA pressures you, hang up and contact us directly." },
    ],
    related: ["scams-and-phishing", "digital-voice-setup"],
  },

  /* ------------------------------------------------------------------ */
  /* Billing & Payments                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: "billing",
    title: "Billing Explained: When and How You're Charged",
    metaTitle: "Billing & Payments — OCCTA Help Centre",
    description: "How OCCTA billing works: when invoices are raised, VAT, Direct Debit, bank transfer, late payment and how to query a bill.",
    keywords: "occta billing, broadband invoice uk, direct debit broadband, pay broadband bill",
    category: "Billing & Payments",
    readMinutes: 5,
    intro: "Honest billing in plain English: when your money moves, how to pay and what to do if anything looks wrong.",
    sections: [
      { heading: "When you're billed", paragraphs: ["Billing starts once your service is confirmed live. Monthly charges are then billed in advance on your billing date. Your first invoice can include a pro-rata amount and any one-off charges from your Contract Summary."] },
      { heading: "VAT", paragraphs: ["Residential prices include VAT. Business prices are shown excluding VAT, with VAT itemised on the invoice."] },
      { heading: "Two ways to pay", paragraphs: [`OCCTA takes payment by Direct Debit or bank transfer only. For bank transfer, pay ${BANK}, quoting your OCCTA account number as the reference. We don't take card payments or payments over the phone.`] },
      { heading: "Direct Debit", paragraphs: ["Direct Debit is collected automatically once your mandate is confirmed active, and is protected by the Direct Debit Guarantee. Until the mandate is active, invoices are paid by bank transfer."] },
      { heading: "If a payment is late", paragraphs: ["If a collection fails or a transfer doesn't arrive, we tell you and give you a reasonable opportunity to pay before taking any further action. A £10 late-payment administration charge may apply only after an overdue notice — never repeatedly on the same invoice. If you're struggling, talk to us early."] },
      { heading: "Querying a bill", paragraphs: ["Raise a billing ticket with the invoice number and what looks wrong. We won't restrict your service over an amount that's genuinely disputed while we look into it."] },
    ],
    faqs: [
      { question: "Can I change my billing date?", answer: "Contact us with your preferred day of the month and we'll tell you if it can be moved and how the change is pro-rated." },
      { question: "What if a Direct Debit fails?", answer: "We'll email you. Pay that invoice by bank transfer using the details on it, quoting your account number." },
      { question: "Where are my invoices?", answer: "Sign in to your account and open Billing to view and download every invoice." },
    ],
    related: ["direct-debit-setup-help", "pay-by-bank-transfer", "first-invoice-explained-help", "missed-payment-help"],
  },
  {
    slug: "direct-debit-setup-help",
    title: "Setting Up and Managing Direct Debit",
    metaTitle: "Direct Debit Setup — OCCTA Help",
    description: "How to set up Direct Debit with OCCTA, change bank details, cancel safely, and how the Direct Debit Guarantee protects you.",
    keywords: "direct debit broadband uk, change bank details broadband",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "Direct Debit is the simplest way to pay — automatic, and protected by the Direct Debit Guarantee.",
    sections: [
      { heading: "Setting one up", paragraphs: ["Sign in, open Billing and choose to set up a Direct Debit, or use the secure link we email you. You'll need the account holder's name, sort code and account number. The mandate becomes active once our payment provider confirms it."] },
      { heading: "Changing bank details", paragraphs: ["Set up a new mandate with the new account. Let us know so the old mandate is cancelled and nothing is collected twice."] },
      { heading: "Cancelling", paragraphs: ["You can cancel a Direct Debit at your bank at any time. Please tell us first — afterwards, each invoice needs to be paid by bank transfer by its due date."] },
      { heading: "The Direct Debit Guarantee", paragraphs: ["If an error is made in the amount or date of a payment, you're entitled to a full and immediate refund from your bank. We'll always notify you in advance of the amount and date of collections."] },
    ],
    faqs: [
      { question: "When is the money taken?", answer: "On the collection date shown on your invoice or advance notice. You always have time to query a bill first." },
      { question: "My mandate isn't active yet — what do I pay with?", answer: "Pay that invoice by bank transfer, quoting your account number." },
    ],
    related: ["billing", "pay-by-bank-transfer", "missed-payment-help"],
  },
  {
    slug: "pay-by-bank-transfer",
    title: "Paying Your Bill by Bank Transfer",
    metaTitle: "Pay by Bank Transfer — OCCTA Help",
    description: "OCCTA's bank details for paying an invoice by bank transfer, which reference to use, how long it takes to show and how to stay safe from bank-detail scams.",
    keywords: "pay occta bill, occta bank details, pay broadband by bank transfer",
    category: "Billing & Payments",
    readMinutes: 2,
    intro: "If you don't pay by Direct Debit, or a collection hasn't gone through, pay by bank transfer from your banking app.",
    sections: [
      { heading: "Our bank details", paragraphs: ["Use these details — they're also printed on every invoice:"], bullets: ["Account name: OCCTA LIMITED", "Bank: Lloyds Bank", "Sort code: 30-98-97", "Account number: 61499362", "Reference: your OCCTA account number"] },
      { heading: "How long it takes", paragraphs: ["Bank transfers are usually received the same day. Payments are reflected in your online account within one working day of being received."] },
      { heading: "Stay safe", paragraphs: ["Our bank details don't change. If you ever receive an email, text or call saying OCCTA has new bank details, don't pay — contact us using the details on this website. Your bank's Confirmation of Payee check should show the name OCCTA LIMITED."] },
    ],
    faqs: [
      { question: "I forgot to add a reference.", answer: "Email us with the amount, date and the name on the paying account and we'll match it." },
      { question: "Do you accept card payments?", answer: "No. OCCTA takes Direct Debit or bank transfer only." },
    ],
    related: ["billing", "direct-debit-setup-help", "scams-and-phishing"],
  },
  {
    slug: "refer-a-friend-help",
    title: "Refer a Friend: How It Works",
    metaTitle: "Refer a Friend — OCCTA Help",
    description: "How OCCTA's refer-a-friend scheme works: getting your code, when bill credit is added, why a referral might not qualify, and how to ask us to review it.",
    keywords: "occta refer a friend, occta referral code, broadband referral credit",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "Refer someone new to OCCTA. When their service has been live 60 days and they've paid their first 2 bills on time, you get £25 off your bill and they get £10 (£50 and £25 before VAT if they join on a business plan).",
    sections: [
      { heading: "Getting your code", paragraphs: ["Sign in to My OCCTA and open Refer a friend. You need a live service and an account that's been up to date with payments for the last 90 days. We email your code with a summary of the terms."] },
      { heading: "How your friend uses it", paragraphs: ["They open your link, or type your code in the offer or reference code box, before they place their order. We can't add a code afterwards, except that our team can look at adding one within 7 days of the order if you contact us."] },
      { heading: "When the credit is added", paragraphs: ["After 60 days live and 2 bills paid in full and on time, our team checks the referral. Once approved, the credit comes off your next bill as its own line, and we email you. We don't confirm a reward before that."] },
      { heading: "Why a referral might not qualify", paragraphs: ["These all mean no reward:"], bullets: ["A bill on either account was paid late, a Direct Debit was returned, or there was a payment plan or suspension at any point since the friend ordered. Paying it later doesn't put this right.", "Your friend wasn't new to OCCTA in the last 12 months, or lives at your address.", "Your friend used another offer, such as SWITCH50, on the same order.", "Your friend cancelled or moved away.", "You've already had 5 rewards in the last 12 months (10 on a business account)."] },
      { heading: "Credit rules", paragraphs: ["Bill credit only, never cash. It can't be transferred or refunded, lasts 12 months, and is lost if your account closes. If your friend leaves within 6 months, we may remove credit you haven't used yet. We never charge you for credit you've already used."] },
    ],
    faqs: [
      { question: "Can you add my code to my friend's order?", answer: "Only within 7 days of their order, and only if you contact us. After that, we can't." },
      { question: "I think my reward was withdrawn unfairly.", answer: "Contact us and we'll review the evidence we hold and reply in writing. If you're still unhappy, you can use our Complaints Code. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached." },
      { question: "Where's the full small print?", answer: "On the refer-a-friend terms page: /legal/refer-a-friend-terms." },
    ],
    related: ["billing", "first-invoice-explained-help", "how-to-complain"],
  },
  {
    slug: "first-invoice-explained-help",
    title: "Your First Invoice, Explained",
    metaTitle: "First Invoice Explained — OCCTA Help",
    description: "What's on your first OCCTA invoice and why the total may differ from your normal monthly price.",
    keywords: "first broadband invoice, prorated bill broadband",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "First bills often look different from the monthly price. Here's what each line means.",
    sections: [
      { heading: "Monthly service charge", paragraphs: ["Your plan price for the period ahead — billed in advance and, for residential customers, including VAT."] },
      { heading: "Pro-rata amount", paragraphs: ["If your go-live date isn't your billing date, you'll see a part-period charge for the days in between."] },
      { heading: "One-off charges", paragraphs: ["Any setup, equipment or installation charges agreed in your Contract Summary appear as separate lines."] },
      { heading: "Credits and discounts", paragraphs: ["Promotional credits or referral rewards show as negative lines."] },
    ],
    faqs: [
      { question: "Why does my second invoice look different?", answer: "Pro-rata and one-off lines only appear once. From then on you'll normally see your standard monthly amount." },
    ],
    related: ["billing", "contract-summary-explained", "direct-debit-setup-help"],
  },
  {
    slug: "missed-payment-help",
    title: "Missed a Payment or Struggling to Pay?",
    metaTitle: "Missed Payment & Financial Difficulty — OCCTA Help",
    description: "What happens if a payment is missed, how to put it right, and the support available if you're finding it hard to pay your OCCTA bill.",
    keywords: "missed broadband payment, cant pay broadband bill, financial difficulty broadband",
    category: "Billing & Payments",
    readMinutes: 4,
    intro: "If money is tight, the most important thing is to talk to us early. We'd much rather agree a plan than chase a debt.",
    sections: [
      { heading: "If a payment is missed", paragraphs: ["We'll contact you and give you a reasonable opportunity to pay. Pay the invoice by bank transfer, quoting your account number. A £10 late-payment administration charge may apply only after an overdue notice."] },
      { heading: "If you're struggling", paragraphs: ["Tell us. We can discuss reasonable payment arrangements based on what you can afford, and look at whether a different plan would suit you better. Some providers offer social tariffs for people on certain benefits — ask us what's available."] },
      { heading: "Before any restriction", paragraphs: ["Restriction or suspension for non-payment only happens after reasonable notice, in line with Ofcom and consumer law, and with consideration of any vulnerability. We won't restrict service over an amount that's genuinely disputed."] },
      { heading: "Free, independent advice", paragraphs: ["StepChange, National Debtline and Citizens Advice offer free, confidential debt advice."] },
    ],
    faqs: [
      { question: "Will a late payment affect my credit file?", answer: "Talk to us early — agreeing a plan is always the best way to avoid things escalating." },
    ],
    related: ["billing", "pay-by-bank-transfer", "vulnerable-customer-support"],
  },
  {
    slug: "refunds-and-credits",
    title: "Refunds, Credits and Overpayments",
    metaTitle: "Refunds & Credits — OCCTA Help",
    description: "When OCCTA issues refunds or account credits, how overpayments are handled and how long it takes.",
    keywords: "broadband refund uk, overpayment refund, account credit",
    category: "Billing & Payments",
    readMinutes: 2,
    intro: "If you're owed money, we'll tell you how it's being returned.",
    sections: [
      { heading: "When refunds apply", paragraphs: ["Common reasons include an overpayment, a cancellation in the cooling-off period, service paid in advance beyond a completed switch date, or a billing error."] },
      { heading: "How you're refunded", paragraphs: ["Refunds go back by bank transfer to the account that paid, or are applied as a credit to your next invoice if you prefer. If you've switched away and paid in advance beyond the switch date, we refund the unused portion."] },
      { heading: "Direct Debit errors", paragraphs: ["If a Direct Debit was taken in error, you can also claim an immediate refund from your bank under the Direct Debit Guarantee."] },
    ],
    faqs: [
      { question: "How do I request a refund?", answer: "Raise a billing ticket with the invoice number and the bank details for the refund. Never send bank details to anyone claiming to be OCCTA from an unexpected message." },
    ],
    related: ["billing", "cancel-or-switch", "cooling-off-cancellation"],
  },
  {
    slug: "price-changes-promise",
    title: "Our Price Promise: No Inflation-Linked Rises",
    metaTitle: "Price Changes & No-CPI Promise — OCCTA Help",
    description: "OCCTA doesn't build CPI, RPI or percentage-based annual price rises into residential contracts. Here's what that means and your rights if a price changes.",
    keywords: "no cpi price rise broadband, mid contract price rise, fixed price broadband",
    category: "Billing & Payments",
    readMinutes: 3,
    intro: "Mid-contract price rises are one of the most common complaints in UK telecoms. We don't do them that way.",
    sections: [
      { heading: "The promise", paragraphs: ["OCCTA residential contracts don't include scheduled CPI-, RPI-, inflation-linked or percentage-based in-contract increases."] },
      { heading: "Price Lock 24", paragraphs: ["Your recurring broadband price stays fixed for the 24-month minimum term, except where a change is required or permitted by law."] },
      { heading: "If something must change", paragraphs: ["Where a change gives you a right to leave without penalty, we'll give you the required notice in writing — normally at least one month — and explain the right and the deadline to use it."] },
      { heading: "Outside our control", paragraphs: ["Statutory changes such as a change in the VAT rate are passed through and itemised on your invoice."] },
    ],
    faqs: [
      { question: "What happens after Price Lock 24 ends?", answer: "Your service continues on a 30-day rolling basis unless you agree a new fixed term." },
    ],
    related: ["contract-summary-explained", "billing", "cancel-or-switch"],
  },

  /* ------------------------------------------------------------------ */
  /* Moving & Switching                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: "move-home",
    title: "Moving Home With OCCTA",
    metaTitle: "Moving Home — OCCTA Help",
    description: "How to take your OCCTA broadband and Digital Voice with you when you move home: notice, charges and what happens if we can't serve the new address.",
    keywords: "moving home broadband uk, transfer broadband new address",
    category: "Moving & Switching",
    readMinutes: 4,
    intro: "Moving is stressful enough. Tell us early and we'll make the broadband the easy part.",
    sections: [
      { heading: "Tell us early", paragraphs: ["Give us your new address and move date as early as you can — ideally a month ahead and at least two weeks. We'll check what's available at the new address and aim to have you live on the day you arrive."] },
      { heading: "Will it cost anything?", paragraphs: ["If your service can move without a new line, ONT, installation or extra equipment, there's no home-move fee. If the new address needs network work, we'll tell you the charge before anything is ordered."] },
      { heading: "If the service is different at the new address", paragraphs: ["A materially slower service, different technology or different price isn't treated as 'equivalent' without your agreement. We'll explain your options."] },
      { heading: "If we can't serve the new address", paragraphs: ["We'll review your case fairly and won't apply an unfair termination penalty just because you've moved somewhere we can't provide service."] },
    ],
    faqs: [
      { question: "Will I keep my home phone number?", answer: "Often, if you're staying in the same area. Ask us before you move." },
      { question: "Can I move my service if I'm renting?", answer: "Yes. If the new property needs new cabling or a wall drilled, you may need the landlord's permission." },
    ],
    related: ["keep-your-landline-number", "cancel-or-switch", "order-to-activation-timeline"],
  },
  {
    slug: "switching-to-occta",
    title: "Switching to OCCTA From Another Provider",
    metaTitle: "Switching to OCCTA — OCCTA Help",
    description: "How switching to OCCTA works with One Touch Switch: no need to call your old provider, coordinated switch date and what to check before you move.",
    keywords: "switch to occta, one touch switch, change broadband provider uk",
    category: "Moving & Switching",
    readMinutes: 3,
    intro: "Under Ofcom's One Touch Switch process, you only need to talk to us. We coordinate with your old provider.",
    sections: [
      { heading: "How it works", paragraphs: ["Order with OCCTA and give us your current provider's details. We arrange the switch and confirm the switch date. Your old service ends when the new one goes live."] },
      { heading: "Before you switch", paragraphs: ["Check these first:"], bullets: ["Whether your current contract has a minimum term or early exit fee — your old provider must tell you during the switch.", "Whether you want to keep your phone number.", "Whether anyone relies on the line for telecare or health devices — tell us."] },
      { heading: "If something goes wrong", paragraphs: ["If a switch or port is delayed or fails in circumstances where regulatory compensation is due, we'll provide it or explain how it's obtained."] },
    ],
    faqs: [
      { question: "Do I need to cancel my old provider?", answer: "No — if One Touch Switch applies, don't cancel yourself. It's coordinated for you." },
    ],
    related: ["order-to-activation-timeline", "keep-your-landline-number", "cooling-off-cancellation"],
  },
  {
    slug: "cancel-or-switch",
    title: "Cancelling or Switching Away From OCCTA",
    metaTitle: "Cancel or Switch — OCCTA Help",
    description: "How to cancel OCCTA or switch to another provider: notice periods, Flex 30, Price Lock 24 early termination, network cease charges and equipment returns.",
    keywords: "cancel broadband uk, switch broadband, one touch switch, cancel occta",
    category: "Moving & Switching",
    readMinutes: 4,
    intro: "We'd be sorry to see you go, but leaving should be straightforward. Here's exactly how it works.",
    sections: [
      { heading: "Switching to another provider", paragraphs: ["Where One Touch Switch applies, just sign up with your new provider — they coordinate with us. Your OCCTA service ends on the completed switch date and we don't charge notice-period fees beyond that date."] },
      { heading: "Flex 30", paragraphs: ["Flex 30 is rolling with a 30-day notice period and no remaining-month early termination charge. Give notice through your account, by email or by post."] },
      { heading: "Price Lock 24", paragraphs: ["Leaving during the 24-month minimum term may mean an Early Termination Charge, unless a penalty-free exit right applies. It's based on the recurring charges left, minus VAT no longer due and costs we avoid, and never exceeds the remaining recurring charges. We'll tell you the exact figure before you confirm."] },
      { heading: "Network cease charge", paragraphs: ["Separately, if we're charged by the network for ceasing your line, we may pass on the actual cost — capped at £114 inc VAT within 12 months of going live and £60 inc VAT after that. It's only applied where lawful and never used to recreate a notice-period charge."] },
      { heading: "Returning equipment", paragraphs: ["If your router or equipment was rented or loaned, follow the return instructions we send and return it within 14 days. If you bought it, it's yours to keep."] },
    ],
    faqs: [
      { question: "What happens to my phone number?", answer: "Your new provider can port it as part of the switch. Don't cancel the line yourself first." },
      { question: "Can I leave penalty-free?", answer: "You may have a penalty-free exit in some situations — for example within the cooling-off period, after certain contract changes, or where a significant speed shortfall isn't put right." },
    ],
    related: ["cooling-off-cancellation", "keep-your-landline-number", "move-home", "refunds-and-credits"],
  },
  {
    slug: "cooling-off-cancellation",
    title: "Changed Your Mind? The 14-Day Cooling-Off Period",
    metaTitle: "14-Day Cooling-Off — OCCTA Help",
    description: "Your right to cancel a new OCCTA contract within 14 days, what you may pay if the service has already started, and how to cancel.",
    keywords: "broadband cooling off period uk, cancel new broadband contract, 14 day cancellation",
    category: "Moving & Switching",
    readMinutes: 3,
    intro: "If you ordered online or by phone, you normally have 14 calendar days to cancel without giving a reason.",
    sections: [
      { heading: "When it runs", paragraphs: ["The 14 days start from the day your contract is entered into — when you accept your order."] },
      { heading: "If the service has already started", paragraphs: ["If you asked us to start during the cooling-off period and then cancel, you may pay a proportionate amount for the service supplied and any installation already carried out."] },
      { heading: "How to cancel", paragraphs: [`Email ${EMAIL}, raise a ticket from your account, or write to OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU. Just tell us clearly that you want to cancel — you don't need a special form.`] },
      { heading: "After the 14 days, before go-live", paragraphs: ["Cancelling after cooling-off but before your service goes live doesn't trigger a recurring-service Early Termination Charge. We may only recover fair, disclosed network or installation costs we've actually incurred and can't avoid."] },
    ],
    faqs: [
      { question: "Do I get a refund?", answer: "Anything paid for service not supplied is refunded, less any proportionate amount described above." },
    ],
    related: ["cancel-or-switch", "refunds-and-credits", "contract-summary-explained"],
  },

  /* ------------------------------------------------------------------ */
  /* Account & Security                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: "sign-in-and-password",
    title: "Signing In and Resetting Your Password",
    metaTitle: "Sign In & Password Reset — OCCTA Help",
    description: "How to sign in to your OCCTA account, reset a forgotten password and fix common sign-in problems.",
    keywords: "occta login, occta account, reset password",
    category: "Account & Security",
    readMinutes: 2,
    intro: "Your online account is where you view bills, raise tickets and manage your service.",
    sections: [
      { heading: "Signing in", paragraphs: ["Use the email address you ordered with. If you've never set a password, use 'Forgot password' to create one."] },
      { heading: "Resetting your password", paragraphs: ["Choose 'Forgot password' on the sign-in page and follow the link we email you. Check your spam folder if it doesn't arrive within a few minutes. Links expire for security."] },
      { heading: "Still can't get in?", paragraphs: [`Email ${EMAIL} from the address on your account. We'll verify your identity before making any change.`] },
    ],
    faqs: [
      { question: "Will OCCTA ever ask for my password?", answer: "Never. We'll never ask for your account password, PPPoE password or one-time codes by phone, email or text." },
    ],
    related: ["update-your-details", "scams-and-phishing", "authorised-account-holder"],
  },
  {
    slug: "update-your-details",
    title: "Updating Your Personal Details",
    metaTitle: "Update Your Details — OCCTA Help",
    description: "How to change your email, phone number, address or name on your OCCTA account, and why keeping your service address up to date matters.",
    keywords: "update account details, change email address account",
    category: "Account & Security",
    readMinutes: 2,
    intro: "Keeping your details current means you get bills, service updates and fault notifications.",
    sections: [
      { heading: "What you can change", paragraphs: ["Sign in and open Account Settings to update your contact details and preferences. For a change of name or account holder, raise a ticket — we'll need to verify it."] },
      { heading: "Your service address matters", paragraphs: ["If you have Digital Voice, emergency services may rely on the address we hold to locate you. Keep it accurate."] },
      { heading: "Marketing preferences", paragraphs: ["Service, billing and fault messages are always sent. Marketing is separate — you can opt in or out at any time."] },
    ],
    faqs: [
      { question: "Can I change the account holder?", answer: "Yes, with consent from the current account holder and identity checks for the new one. Raise a ticket to start." },
    ],
    related: ["sign-in-and-password", "authorised-account-holder", "data-and-privacy-requests"],
  },
  {
    slug: "scams-and-phishing",
    title: "Spotting Scams Pretending to Be OCCTA",
    metaTitle: "Scams & Phishing — OCCTA Help",
    description: "How to recognise scam calls, emails and texts claiming to be from OCCTA, what we'll never ask for and how to report fraud.",
    keywords: "broadband scam call uk, phishing email broadband, occta scam",
    category: "Account & Security",
    readMinutes: 4,
    intro: "Criminals often pose as broadband and phone companies. Knowing what we'll never do is your best protection.",
    sections: [
      { heading: "OCCTA will never…", paragraphs: ["If someone does any of these, it isn't us:"], bullets: ["Ask for card details — we don't take card payments at all.", "Ask you to pay to a different bank account or say our bank details have changed.", "Ask for your passwords or one-time codes.", "Ask you to install remote-access software to 'fix your internet'.", "Threaten to cut you off within the hour unless you pay now."] },
      { heading: "If you're unsure", paragraphs: [`Hang up or don't reply. Contact us using the details on this website — ${PHONE} or ${EMAIL} — never the number or link in the message.`] },
      { heading: "Report it", paragraphs: ["Forward phishing emails to report@phishing.gov.uk and spam texts to 7726. Report fraud to Action Fraud (or Police Scotland on 101 in Scotland). If you've lost money, call your bank straight away on the number on your card — or call 159."] },
    ],
    faqs: [
      { question: "I think I've been scammed.", answer: "Call your bank immediately, change any passwords you shared, then tell us so we can protect your account." },
    ],
    related: ["pay-by-bank-transfer", "sign-in-and-password", "nuisance-calls", "lost-or-stolen-phone"],
  },
  {
    slug: "data-and-privacy-requests",
    title: "Your Data and Privacy Rights",
    metaTitle: "Data & Privacy Requests — OCCTA Help",
    description: "How OCCTA uses your personal data, how to request a copy of it, correct it or object, and how to complain to the ICO.",
    keywords: "subject access request telecom, gdpr request broadband, occta privacy",
    category: "Account & Security",
    readMinutes: 3,
    intro: "OCCTA is the data controller for the personal data you give us. You have clear rights under UK GDPR.",
    sections: [
      { heading: "What we use it for", paragraphs: ["To provide and bill your service, handle support and complaints, keep the network secure and meet legal obligations. Our Privacy Policy sets out purposes, lawful bases, sharing and retention."] },
      { heading: "Your rights", paragraphs: ["You can ask for:"], bullets: ["A copy of your personal data (a subject access request).", "Corrections to inaccurate data.", "Deletion where we no longer need it and no legal duty requires us to keep it.", "Restriction or objection to certain processing, including marketing."] },
      { heading: "How to ask", paragraphs: [`Email ${EMAIL} with 'Data request' in the subject. We'll verify your identity and normally respond within one month.`] },
      { heading: "Complaining to the ICO", paragraphs: ["If you're unhappy with how we've handled your data, you can complain to the Information Commissioner's Office (ico.org.uk)."] },
    ],
    faqs: [
      { question: "Do you monitor what I do online?", answer: "No. We don't actively monitor the content of your traffic. We process limited network data needed to run, secure and bill the service." },
    ],
    related: ["update-your-details", "authorised-account-holder"],
  },
  {
    slug: "authorised-account-holder",
    title: "Letting Someone Manage Your Account",
    metaTitle: "Authorised Contacts & Power of Attorney — OCCTA Help",
    description: "How to add a trusted person to your OCCTA account, power of attorney arrangements and managing an account after a bereavement.",
    keywords: "add authorised person account, power of attorney broadband, bereavement broadband",
    category: "Account & Security",
    readMinutes: 3,
    intro: "Sometimes it's easier for a family member or carer to deal with us for you. We make that simple and safe.",
    sections: [
      { heading: "Nominating a trusted person", paragraphs: ["With your consent, you can nominate someone to speak to us on your behalf. Raise a ticket or email us from your account address with their name and how they'll contact us."] },
      { heading: "Power of attorney", paragraphs: ["Send us a copy of the registered power of attorney (or equivalent) and we'll add the attorney to the account."] },
      { heading: "After a bereavement", paragraphs: [`We're sorry for your loss. Email ${EMAIL} or call ${PHONE} and we'll guide you gently through closing or transferring the account. We'll explain any final amounts clearly and agree sensible timings with you — there's no rush.`] },
    ],
    faqs: [
      { question: "What will the nominated person be able to do?", answer: "Discuss the account and make changes you've agreed they can make. You can remove them at any time." },
    ],
    related: ["vulnerable-customer-support", "update-your-details", "data-and-privacy-requests"],
  },

  /* ------------------------------------------------------------------ */
  /* Extra Help & Accessibility                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: "vulnerable-customer-support",
    title: "Extra Help When You Need It",
    metaTitle: "Vulnerable Customer Support — OCCTA",
    description: "Priority handling, Digital Voice resilience, payment arrangements, accessible formats and nominated contacts for customers who need extra support.",
    keywords: "vulnerable customer broadband, telecare priority, accessible broadband uk",
    category: "Extra Help & Accessibility",
    readMinutes: 4,
    intro: "Anyone can need extra help — because of health, age, disability, bereavement, financial difficulty, domestic abuse or simply a tough time. Telling us means we can adapt how we support you. It's free and confidential.",
    sections: [
      { heading: "How to tell us", paragraphs: [`At order, by ticket, by email to ${EMAIL} or by phone on ${PHONE}. You don't need to share more than you're comfortable with.`] },
      { heading: "Priority handling", paragraphs: ["We prioritise service-affecting issues on accounts where someone relies on the service for health or safety."] },
      { heading: "Digital Voice resilience", paragraphs: ["If you rely on the phone for telecare, healthcare or safety, we'll assess your circumstances and discuss appropriate resilience or alternative communication arrangements."] },
      { heading: "Payment support", paragraphs: ["Reasonable payment arrangements for customers in financial difficulty, agreed around what you can afford."] },
      { heading: "Communication support", paragraphs: ["Plain-English communications, accessible formats and a nominated trusted contact to deal with us for you, with your consent."] },
    ],
    faqs: [
      { question: "Do I need to provide medical evidence?", answer: "No evidence is needed to tell us about your circumstances or to get basic support adjustments." },
      { question: "Who sees this information?", answer: "It's recorded sensitively, used only to support you and handled under our Privacy Policy." },
    ],
    related: ["digital-voice-telecare", "accessible-formats", "missed-payment-help", "authorised-account-holder"],
  },
  {
    slug: "accessible-formats",
    title: "Accessible Bills and Ways to Contact Us",
    metaTitle: "Accessibility & Accessible Formats — OCCTA Help",
    description: "Large print, braille and audio bills, Relay UK and other accessible ways to contact OCCTA, free of charge.",
    keywords: "large print bill, braille bill broadband, relay uk, accessible broadband",
    category: "Extra Help & Accessibility",
    readMinutes: 2,
    intro: "We want everyone to be able to use our services and reach us easily.",
    sections: [
      { heading: "Accessible formats", paragraphs: ["Bills and important letters can be provided in large print, braille or audio on request, free of charge."] },
      { heading: "Ways to contact us", paragraphs: [`Online chat, support tickets, email (${EMAIL}), phone (${PHONE}) and post. If you use Relay UK, dial 18001 followed by our number.`] },
      { heading: "Our website", paragraphs: ["We aim to make our website usable for everyone. Our accessibility statement explains what we support and how to report a problem."] },
    ],
    faqs: [
      { question: "Is there a charge?", answer: "No. Accessible formats and adjustments are free." },
    ],
    related: ["vulnerable-customer-support", "authorised-account-holder"],
  },

  /* ------------------------------------------------------------------ */
  /* Complaints & Your Rights                                            */
  /* ------------------------------------------------------------------ */
  {
    slug: "how-to-complain",
    title: "How to Make a Complaint",
    metaTitle: "How to Complain — OCCTA Help",
    description: "How to raise a complaint with OCCTA, our response targets, how it's escalated and when you can go to an independent ADR scheme.",
    keywords: "complain broadband provider uk, occta complaint, broadband complaints process",
    category: "Complaints & Your Rights",
    readMinutes: 4,
    intro: "If we've got something wrong, we want to know — and we want to fix it. Here's exactly how our complaints process works.",
    sections: [
      { heading: "How to complain", paragraphs: [`Use our Complaints page, raise a ticket from your account, email ${EMAIL} or call ${PHONE}. You can also write to OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU.`] },
      { heading: "What we'll do", paragraphs: ["Under our Complaints Code we will:"], bullets: ["Acknowledge your complaint within 2 working days.", "Investigate and aim to resolve it within 10 working days.", "Keep you updated and explain our outcome in writing.", "Escalate to senior review if you're not satisfied."] },
      { heading: "Going to ADR", paragraphs: ["If your complaint isn't resolved within 6 weeks, or we issue a deadlock letter sooner, you can refer it free of charge to our independent Alternative Dispute Resolution (ADR) scheme. We'll give you the scheme's details in writing."] },
      { heading: "Help with complaining", paragraphs: ["If you'd like someone to complain for you — a relative, carer or advice service — that's fine with your consent."] },
    ],
    faqs: [
      { question: "Will complaining affect my service?", answer: "Never. Complaining is your right and doesn't affect how we treat you." },
      { question: "Is ADR free?", answer: "Yes, ADR is free for customers. Its decision isn't binding on you unless you accept it." },
    ],
    related: ["your-rights-ofcom", "vulnerable-customer-support", "report-a-fault"],
  },
  {
    slug: "your-rights-ofcom",
    title: "Your Rights as a Telecoms Customer",
    metaTitle: "Your Telecoms Rights — OCCTA Help",
    description: "A plain-English summary of your key rights with OCCTA: contract information, cooling-off, switching, speeds, price changes, complaints and Ofcom.",
    keywords: "telecoms consumer rights uk, ofcom broadband rights, broadband customer rights",
    category: "Complaints & Your Rights",
    readMinutes: 4,
    intro: "UK telecoms customers have strong protections. Here's a quick guide to the ones that matter most, and how OCCTA meets them.",
    sections: [
      { heading: "Clear information before you buy", paragraphs: ["You get a Contract Summary and full contract information before you're asked to agree. Your agreement only starts when you accept."] },
      { heading: "Cooling-off", paragraphs: ["Normally 14 days to cancel a contract made online, by phone or off-premises."] },
      { heading: "Easy switching", paragraphs: ["One Touch Switch for broadband and home phone, and text-to-switch for mobile numbers."] },
      { heading: "Speed remedies", paragraphs: ["If performance is significantly and persistently below what your contract states, remedies required by law are available, which can include the right to leave without penalty."] },
      { heading: "Price changes", paragraphs: ["No inflation-linked price rises built into our residential contracts. Where a change gives you a right to leave without penalty, you'll be told in writing in advance."] },
      { heading: "Complaints and ADR", paragraphs: ["A clear complaints process and free access to independent ADR after 6 weeks or deadlock."] },
      { heading: "About Ofcom", paragraphs: ["Ofcom regulates UK communications and publishes guidance on your rights at ofcom.org.uk. It doesn't normally decide individual disputes — that's what ADR is for."] },
    ],
    faqs: [
      { question: "Do my statutory rights still apply?", answer: "Yes. Nothing in our terms limits your rights under the Consumer Rights Act 2015 or other UK law." },
    ],
    related: ["how-to-complain", "cooling-off-cancellation", "price-changes-promise", "broadband-speed-check"],
  },
];

export function getHelpArticle(slug: string) {
  return helpArticles.find((a) => a.slug === slug);
}

export function helpArticlesByCategory(category: HelpCategory) {
  return helpArticles.filter((a) => a.category === category);
}

/** Lightweight client-side search over static articles (title, description, keywords, body). */
export function searchHelpArticles(query: string, limit = 8): HelpArticle[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  const scored = helpArticles.map((a) => {
    const title = a.title.toLowerCase();
    const meta = `${a.description} ${a.keywords} ${a.category}`.toLowerCase();
    const body = [a.intro, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]), ...a.faqs.flatMap((f) => [f.question, f.answer])]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 6;
      if (meta.includes(t)) score += 3;
      if (body.includes(t)) score += 1;
    }
    return { a, score };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map((s) => s.a);
}
