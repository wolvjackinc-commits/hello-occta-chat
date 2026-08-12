// Static, prerender-friendly SEO content for the /learn hub. Each entry becomes:
//   • one crawlable page at /learn/<slug>
//   • one sitemap.xml entry
//   • one baked-in <head> block via vite-plugin-prerender.ts
//   • JSON-LD (Breadcrumb + FAQPage) via SeoContentLayout
//
// Keep each entry self-contained so the SPA can render it without a network fetch.

export type LearnCategory =
  | "broadband"
  | "switching"
  | "wifi"
  | "sim"
  | "voice"
  | "payments";

export interface LearnSection {
  heading: string;
  body: string; // paragraph or two, plain text — rendered as <p>
}

export interface LearnFAQ {
  question: string;
  answer: string;
}

export interface LearnRelated {
  label: string;
  to: string;
  description?: string;
}

export interface LearnPage {
  slug: string;
  category: LearnCategory;
  title: string;              // <title>
  metaDescription: string;    // <meta name="description">
  h1: string;
  shortAnswer: string;        // AEO-friendly summary
  intro: string;
  sections: LearnSection[];
  faqs: LearnFAQ[];
  related: LearnRelated[];
  keywords: string;
}

export const learnCategoryLabels: Record<LearnCategory, string> = {
  broadband: "Broadband basics",
  switching: "Switching & contracts",
  wifi: "Routers & Wi-Fi",
  sim: "SIM & mobile",
  voice: "Digital Voice",
  payments: "Billing & payments",
};

// Related-link presets so every page cross-links to money pages.
const CHECK = { label: "Check availability at your address", to: "/build-plan", description: "Free postcode check — no signup needed." };
const BROADBAND = { label: "OCCTA Broadband plans", to: "/broadband" };
const SIM = { label: "OCCTA SIM plans", to: "/sim" };
const VOICE = { label: "Digital Home Phone", to: "/landline" };
const SWITCH = { label: "How switching works", to: "/switching" };

export const learnPages: LearnPage[] = [
  /* ─── Broadband basics ─── */
  {
    slug: "what-is-fttp",
    category: "broadband",
    title: "What is FTTP? Full-fibre broadband explained — OCCTA",
    metaDescription: "FTTP vs FTTC vs SOGEA — what full-fibre broadband actually means in the UK, and how to check what's at your address.",
    h1: "What is FTTP broadband?",
    shortAnswer: "FTTP (Fibre-to-the-Premises) is a full-fibre broadband connection that runs a fibre-optic cable all the way into your home. It's faster, more reliable, and future-proof compared to older copper-based FTTC.",
    intro: "If you're shopping for broadband in the UK, you'll see the terms FTTP, FTTC and SOGEA. They all sound similar but the technology behind them is very different — and it directly affects your speed, reliability and price. Here's a plain-English breakdown.",
    sections: [
      { heading: "FTTP — Fibre to the Premises", body: "FTTP runs a fibre-optic cable directly to your home. There's no copper in the loop, which means far higher speeds (up to 900Mbps or more), lower latency, and much better reliability. This is what most people mean when they say 'full fibre'." },
      { heading: "FTTC — Fibre to the Cabinet", body: "FTTC runs fibre only as far as the green street cabinet, then copper telephone wire the rest of the way to your house. Speeds top out around 80Mbps and slow down the further you are from the cabinet." },
      { heading: "SOGEA — Single Order Generic Ethernet Access", body: "SOGEA is FTTC without a landline. Same copper-and-fibre mix, same speeds, but you don't pay for a phone line you don't use. It's Openreach's stepping-stone before FTTP rolls out to every street." },
      { heading: "Which one can I actually get?", body: "It depends entirely on your postcode. Around 70% of UK premises now have FTTP available; the rest are still on FTTC/SOGEA until Openreach reaches them. Use our free postcode checker to see exactly what's available at your address." },
    ],
    faqs: [
      { question: "Is FTTP better than FTTC?", answer: "Yes — FTTP is significantly faster, more reliable, and has lower latency because there's no copper in the connection. FTTC speeds also degrade with distance from the cabinet; FTTP doesn't." },
      { question: "Do I need a phone line for FTTP?", answer: "No. FTTP is a pure data connection — there's no analogue phone line involved. If you want a home phone number you can add a Digital Voice service that runs over the fibre." },
      { question: "Will FTTP work in a power cut?", answer: "The fibre itself is unaffected, but your router needs mains power. Most people use a mobile phone as a backup during outages. If you rely on a landline for medical alarms, ask us about a battery back-up unit." },
      { question: "How fast is FTTP with OCCTA?", answer: "Speeds range from around 100Mbps up to 900Mbps depending on the plan you choose and what your line can deliver. Check availability by postcode to see what's on offer at your address." },
    ],
    related: [BROADBAND, CHECK, { label: "Fibre broadband explained", to: "/fibre-broadband" }, { label: "Coverage areas", to: "/coverage-areas", description: "See what full fibre is live near you." }, { label: "Broadband speed guide", to: "/learn/broadband-speed-guide" }],
    keywords: "FTTP, full fibre broadband UK, FTTP vs FTTC, what is FTTP, fibre to the premises",
  },
  {
    slug: "broadband-speed-guide",
    category: "broadband",
    title: "How much broadband speed do I need? UK guide — OCCTA",
    metaDescription: "Streaming, gaming, working from home — how much broadband speed you actually need in the UK, without paying for more than you'll use.",
    h1: "How much broadband speed do I actually need?",
    shortAnswer: "For a typical UK household of 2–4 people with streaming, video calls and normal browsing, 50–100Mbps is plenty. Bigger households, 4K streaming or heavy gaming benefit from 300Mbps+.",
    intro: "Broadband providers love selling you the biggest number. In reality, most UK households use a fraction of the speed they pay for. Here's a realistic guide to picking the right plan.",
    sections: [
      { heading: "1 person, basic use — 36–50Mbps", body: "Email, browsing, HD Netflix, the odd video call. Cheaper FTTC or entry-level FTTP plans do this comfortably." },
      { heading: "2–4 people — 50–150Mbps", body: "Multiple devices streaming HD/4K at the same time, working from home, some gaming. This is the sweet spot for most UK families." },
      { heading: "Heavy household or working from home — 150–500Mbps", body: "Frequent 4K streaming on multiple TVs, large file uploads, video calls that must not glitch, home office setups. Full-fibre FTTP shines here." },
      { heading: "Gamers and creators — 500–900Mbps", body: "Downloading 100GB game updates in minutes, streaming to Twitch/YouTube, remote workstations. Only useful if you actually generate that traffic — a fast plan doesn't make Netflix load faster." },
      { heading: "Latency matters more than speed for gaming", body: "For online gaming, the ping (round-trip time) matters more than raw Mbps. Any full-fibre connection typically gives you 5–20ms — miles better than legacy FTTC." },
    ],
    faqs: [
      { question: "Is 100Mbps enough for a family of four?", answer: "Yes — for the vast majority of households, 100Mbps handles multiple streams, video calls and gaming with no issues." },
      { question: "Does higher Mbps make streaming better?", answer: "Only up to a point. Netflix 4K needs about 25Mbps; anything above that is headroom, not extra picture quality." },
      { question: "What speed do I need for 4K Netflix?", answer: "Netflix recommends 15–25Mbps per 4K stream. On a 100Mbps line you can comfortably run 3–4 4K streams at once." },
      { question: "Will faster broadband make my Wi-Fi faster?", answer: "Only if your router and devices can keep up. An old router or thick walls can bottleneck a fast connection." },
    ],
    related: [BROADBAND, CHECK, { label: "What is FTTP?", to: "/learn/what-is-fttp" }, { label: "Fix slow broadband", to: "/learn/slow-broadband-fixes" }],
    keywords: "how much broadband speed do I need, UK broadband speed guide, Mbps needed for streaming, gaming broadband speed",
  },
  {
    slug: "slow-broadband-fixes",
    category: "broadband",
    title: "Slow broadband? 10 fixes that actually work — OCCTA",
    metaDescription: "Slow UK broadband? Try these 10 practical fixes before calling your ISP — router placement, Wi-Fi channel, DNS, cables and more.",
    h1: "10 fixes for slow broadband",
    shortAnswer: "Slow broadband is usually a Wi-Fi problem, not a line problem. Move the router, switch channel, use 5GHz or Ethernet, and reboot before assuming your line is at fault.",
    intro: "Before you switch provider or pay for an upgrade, try these steps in order — most 'slow broadband' complaints turn out to be Wi-Fi bottlenecks that cost nothing to fix.",
    sections: [
      { heading: "1. Test on a wired connection first", body: "Plug a laptop directly into the router with an Ethernet cable and run a speed test. If wired is fast but Wi-Fi is slow, you have a Wi-Fi problem, not a broadband problem." },
      { heading: "2. Move the router", body: "Put it out in the open, not in a cupboard or behind the TV. Higher and central beats hidden and low every time." },
      { heading: "3. Use the 5GHz band", body: "Most modern routers broadcast a 2.4GHz and a 5GHz network. 5GHz is much faster over short distances. Connect nearby devices to the 5GHz SSID." },
      { heading: "4. Reboot the router", body: "Unplug for 60 seconds, plug back in. Fixes about a third of speed complaints." },
      { heading: "5. Check who's on your Wi-Fi", body: "A hidden torrent client, an auto-updating games console or a rogue neighbour can chew through your bandwidth. Check the connected-devices list in the router admin." },
      { heading: "6. Update your router firmware", body: "Older firmware has known bugs and security holes. Most ISP-supplied routers auto-update, but check anyway." },
      { heading: "7. Try a different DNS", body: "Slow name lookups make everything feel sluggish. Try 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google) instead of your ISP default." },
      { heading: "8. Replace old cables", body: "A cheap or damaged microfilter or Ethernet cable can bottleneck a fast line. Swap them out." },
      { heading: "9. Consider a mesh Wi-Fi kit", body: "If your house is large or has thick walls, a single router will never cover it. A three-node mesh kit is transformative." },
      { heading: "10. If nothing works, upgrade to full fibre", body: "If your line is on FTTC, you're capped at ~80Mbps. Check if FTTP is available at your postcode — the difference is night and day." },
    ],
    faqs: [
      { question: "Why is my broadband slow at night?", answer: "Peak-time contention on shared networks (especially FTTC) is common. Full-fibre FTTP doesn't suffer from this because it isn't a shared street cabinet." },
      { question: "Does the router make a difference?", answer: "Yes. A cheap old router will bottleneck a fast connection. Any modern Wi-Fi 6 router paired with FTTP is a big upgrade." },
      { question: "Should I call my ISP first?", answer: "Only after checking wired speeds. If wired is at the line speed you pay for, the ISP can't help — it's a Wi-Fi issue at your end." },
    ],
    related: [BROADBAND, { label: "Router buying guide", to: "/learn/router-buying-guide" }, { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide" }, CHECK],
    keywords: "slow broadband fixes, why is my broadband slow, boost Wi-Fi speed, fix slow internet UK",
  },
  {
    slug: "wifi-vs-broadband",
    category: "broadband",
    title: "Wi-Fi vs broadband — what's the difference? OCCTA",
    metaDescription: "Wi-Fi is not broadband. Understand the difference between your internet connection and the wireless signal in your home.",
    h1: "Wi-Fi vs broadband: what's the difference?",
    shortAnswer: "Broadband is the connection from your home to the internet. Wi-Fi is how devices in your home talk to your router. Slow Wi-Fi doesn't mean slow broadband — and vice versa.",
    intro: "The two terms get used interchangeably, but they're completely different technologies. Getting the difference straight will save you money and help you troubleshoot problems faster.",
    sections: [
      { heading: "Broadband is the pipe", body: "Broadband is the physical connection between your home and your ISP — fibre, copper, cable or cellular. It has a fixed speed determined by the technology and your ISP plan." },
      { heading: "Wi-Fi is the last few metres", body: "Wi-Fi is a wireless standard (2.4GHz or 5GHz radio) used inside your home to connect devices to the router. Its speed depends on your router, your devices, walls, distance and interference." },
      { heading: "Why this matters", body: "Paying for 500Mbps broadband won't help if your Wi-Fi tops out at 80Mbps because you're behind two brick walls. Conversely, a great mesh Wi-Fi setup can't make a 40Mbps FTTC line faster." },
    ],
    faqs: [
      { question: "Is Wi-Fi the internet?", answer: "No. Wi-Fi is the wireless connection between your devices and router. The internet reaches your router via broadband." },
      { question: "Can I have broadband without Wi-Fi?", answer: "Yes — just connect a device to the router with an Ethernet cable. Every OCCTA router has multiple Ethernet ports." },
      { question: "Why is my Wi-Fi slower than my broadband?", answer: "Wi-Fi is affected by distance, walls, interference and device age. Full broadband speed is only reachable near the router or via Ethernet." },
    ],
    related: [{ label: "Router buying guide", to: "/learn/router-buying-guide" }, { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide" }, { label: "Slow broadband fixes", to: "/learn/slow-broadband-fixes" }, CHECK],
    keywords: "wifi vs broadband, difference between wifi and broadband, is wifi the internet",
  },
  {
    slug: "router-buying-guide",
    category: "wifi",
    title: "Router buying guide UK — what to look for in 2026 — OCCTA",
    metaDescription: "How to buy a broadband router in the UK: Wi-Fi 6, mesh support, ports and compatibility with OCCTA and other Openreach ISPs.",
    h1: "Router buying guide 2026",
    shortAnswer: "For most UK homes, look for a dual-band Wi-Fi 6 router with at least four gigabit Ethernet ports. Wi-Fi 6E and Wi-Fi 7 are only worth it if you have devices that support them.",
    intro: "The router that ships with a broadband plan is fine for most people — but if you want the best Wi-Fi in every room, or you're bringing your own, here's what to look for.",
    sections: [
      { heading: "Wi-Fi standard: aim for Wi-Fi 6 minimum", body: "Wi-Fi 6 (802.11ax) is fast, efficient with lots of devices, and now the mainstream standard. Wi-Fi 6E adds a 6GHz band; Wi-Fi 7 is bleeding edge and only useful if you have compatible devices." },
      { heading: "Dual-band or tri-band", body: "Dual-band (2.4GHz + 5GHz) is plenty for most UK homes. Tri-band adds a second 5GHz radio and helps in device-heavy setups." },
      { heading: "Gigabit Ethernet ports", body: "Look for at least 4 gigabit LAN ports. If your broadband is 1Gbps FTTP, make sure the WAN port is 2.5Gbps to leave headroom." },
      { heading: "Mesh support", body: "If your house is over 3 bedrooms or has thick walls, buy into a system that supports adding mesh satellites later." },
      { heading: "Bring your own or take ours?", body: "OCCTA supports bring-your-own-router — perfect if you already own a Wi-Fi 6 mesh system. Alternatively pick our free supplied router at checkout for zero setup hassle." },
    ],
    faqs: [
      { question: "Can I use my own router with OCCTA?", answer: "Yes — bring-your-own-router is fully supported. We'll send you the connection details so you can configure it." },
      { question: "Is Wi-Fi 7 worth it?", answer: "Not yet for most people. Very few devices support Wi-Fi 7 and the price premium is high. Wi-Fi 6 is the sweet spot in 2026." },
      { question: "Do I need a modem separately?", answer: "No. Modern FTTP and FTTC routers combine modem and router in one box." },
    ],
    related: [{ label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide" }, { label: "Set up your own router", to: "/help/own-router-setup" }, { label: "Fix slow broadband", to: "/learn/slow-broadband-fixes" }, BROADBAND],
    keywords: "router buying guide UK, best broadband router 2026, Wi-Fi 6 router, bring your own router broadband",
  },
  {
    slug: "mesh-wifi-guide",
    category: "wifi",
    title: "Mesh Wi-Fi UK guide — cover every room properly — OCCTA",
    metaDescription: "Mesh Wi-Fi vs extenders vs powerline: how to blanket your UK home in fast, reliable Wi-Fi.",
    h1: "Mesh Wi-Fi: the guide",
    shortAnswer: "Mesh Wi-Fi uses multiple nodes to blanket a house in a single seamless network. It's the best option for larger homes or houses with thick walls — much better than extenders.",
    intro: "If your Wi-Fi drops off in the bedroom, dies in the garden, or the kids complain about lag on the console upstairs, a mesh system is almost certainly the fix.",
    sections: [
      { heading: "How mesh works", body: "You place two or three (or more) mesh nodes around the house. They all broadcast the same SSID, so devices move seamlessly between them. Most systems also use a dedicated backhaul channel so speed doesn't halve at each hop." },
      { heading: "Mesh vs Wi-Fi extenders", body: "Extenders halve your speed each hop and create separate SSIDs your device has to manually switch between. Mesh is invisible to the device and much faster." },
      { heading: "How many nodes?", body: "1–2 bed flat: 2 nodes. 3–4 bed house: 3 nodes. Big houses or gardens: 3+ with wired backhaul if possible." },
      { heading: "Popular systems", body: "TP-Link Deco, Amazon eero, Netgear Orbi and Google Nest Wi-Fi all work well and are compatible with OCCTA broadband when used in AP or router mode." },
    ],
    faqs: [
      { question: "Do I need mesh with OCCTA?", answer: "Only if your existing router doesn't cover the whole house. Small flats are fine with a single router; larger homes benefit from mesh." },
      { question: "Can I use mesh with the router OCCTA supplies?", answer: "Yes. Either replace it entirely with the mesh router, or put the OCCTA router into modem/bridge mode and let the mesh handle Wi-Fi." },
      { question: "Is Ethernet backhaul worth it?", answer: "Absolutely — if you can run a cable between nodes, do it. You get the full line speed at every node." },
    ],
    related: [{ label: "Router buying guide", to: "/learn/router-buying-guide" }, { label: "Slow broadband fixes", to: "/learn/slow-broadband-fixes" }, BROADBAND, CHECK],
    keywords: "mesh WiFi UK, best mesh WiFi 2026, mesh vs extender, whole home WiFi UK",
  },
  /* ─── Switching & contracts ─── */
  {
    slug: "how-to-switch-broadband",
    category: "switching",
    title: "How to switch broadband in the UK (One Touch Switch) — OCCTA",
    metaDescription: "How to switch broadband providers in the UK using the One Touch Switch process. What happens, how long it takes, and how to avoid downtime.",
    h1: "How to switch broadband in the UK",
    shortAnswer: "Sign up with your new provider. They'll trigger the One Touch Switch process, notify your old provider, and coordinate the changeover. You don't need to call anyone — it's handled automatically.",
    intro: "Since September 2024, switching broadband in the UK has been genuinely simple. The One Touch Switch (OTS) rules mean the new provider handles everything, and you'll never be left disconnected between contracts.",
    sections: [
      { heading: "Step 1: Check availability", body: "Enter your postcode with the new provider. This confirms your address is in coverage and shows which speed tier your line supports." },
      { heading: "Step 2: Choose your plan and sign up", body: "Pick your speed and complete the online order. You'll set an activation date — usually 10–14 days later." },
      { heading: "Step 3: One Touch Switch does the rest", body: "Your new provider tells your old provider to stop the service on the changeover date. Any early-termination fees the old provider charges must be disclosed up-front so you can accept or cancel." },
      { heading: "Step 4: Router arrives, service goes live", body: "Your new router arrives a few days before activation. Plug it in on the go-live date — most switches involve zero downtime." },
    ],
    faqs: [
      { question: "Do I need to cancel my old provider?", answer: "No. Under One Touch Switch, your new provider handles the cancellation for you." },
      { question: "Will there be downtime when I switch?", answer: "Usually none. FTTC-to-FTTC and FTTP-to-FTTP switches are typically instant. FTTC-to-FTTP may need a brief engineer visit for install." },
      { question: "What if I'm still in contract?", answer: "The new provider must tell you about any early-termination fees your old provider will charge before the switch goes ahead. You can cancel the switch at that point if you don't want to pay." },
      { question: "Can I keep my phone number?", answer: "Yes — number porting is handled as part of the OTS process." },
    ],
    related: [SWITCH, BROADBAND, CHECK, { label: "Business broadband", to: "/business/broadband", description: "Switching a business line instead." }, { label: "Leaving BT?", to: "/learn/leaving-bt" }],
    keywords: "how to switch broadband UK, one touch switch, changing broadband providers, switch ISP UK",
  },
  {
    slug: "leaving-bt",
    category: "switching",
    title: "Leaving BT Broadband — how to switch away — OCCTA",
    metaDescription: "Thinking of leaving BT? Here's how to cancel BT broadband, avoid exit fees, and switch to a cheaper provider on the same Openreach network.",
    h1: "Leaving BT Broadband",
    shortAnswer: "You don't need to call BT to leave. Sign up with a new provider, and the One Touch Switch process cancels BT automatically. Any exit fees will be disclosed before the switch goes ahead.",
    intro: "BT's prices have crept up every year while their contracts have got longer. If you're out of your minimum term (or willing to pay the exit fee), leaving is straightforward. Here's the process.",
    sections: [
      { heading: "Check if you're still in contract", body: "Log into your BT account or check your latest bill. If your minimum term has ended, you can leave with no exit fees. If you're still in contract, exit fees can be £10–£20 per remaining month." },
      { heading: "Pick a new provider on the same network", body: "OCCTA uses the same Openreach fibre as BT — same speeds, same reliability, but rolling monthly and with no annual CPI+3.9% price hike. Check availability at your postcode." },
      { heading: "Sign up — that's it", body: "The new provider triggers One Touch Switch, tells BT to stop the service on the switch date, and you never speak to BT retention." },
      { heading: "Return the BT hub", body: "BT will send you a return bag. Post the hub back or you'll be charged around £50." },
    ],
    faqs: [
      { question: "Do I have to call BT to cancel?", answer: "No. Under One Touch Switch, your new provider cancels BT for you." },
      { question: "Will I lose my BT email address?", answer: "BT Premium Mail is retained if you pay a small monthly fee, otherwise it closes 60 days after your service ends. Move to a free provider like Gmail before you switch." },
      { question: "Can I keep my landline number?", answer: "Yes — number porting is included in the OTS process." },
    ],
    related: [{ label: "OCCTA vs BT", to: "/compare/occta-vs-bt" }, { label: "How to switch", to: "/learn/how-to-switch-broadband" }, BROADBAND, CHECK],
    keywords: "leaving BT broadband, how to cancel BT, switch from BT, BT broadband alternative",
  },
  {
    slug: "leaving-sky",
    category: "switching",
    title: "Leaving Sky Broadband — how to switch away — OCCTA",
    metaDescription: "How to leave Sky Broadband: One Touch Switch, exit fees, keeping your Sky TV, and finding a cheaper Openreach provider.",
    h1: "Leaving Sky Broadband",
    shortAnswer: "Sign up with a new Openreach provider — they'll trigger One Touch Switch and cancel Sky for you. Sky TV is separate and continues unaffected.",
    intro: "Sky Broadband ties into the same Openreach network as most UK providers. You can switch broadband without losing Sky TV or your landline number.",
    sections: [
      { heading: "Sky TV and Sky Broadband are separate", body: "Cancelling broadband doesn't cancel your Sky Q or Sky Glass. TV is delivered via satellite (Q) or over any broadband connection (Glass) — including your new one." },
      { heading: "Check your contract", body: "Sky Broadband contracts are typically 18 months with annual CPI+3.9% rises. If you're outside your term you can leave for free." },
      { heading: "Switch via OTS", body: "Sign up with the new provider; they'll notify Sky and handle the switchover." },
      { heading: "Return the Sky Hub", body: "Sky will email a returns label. Post the hub back within 30 days or expect a charge." },
    ],
    faqs: [
      { question: "Will my Sky TV stop working if I switch broadband?", answer: "No. Sky Q (satellite) is independent. Sky Glass (streaming) works over any broadband — including your new provider." },
      { question: "Are Sky Broadband exit fees expensive?", answer: "Usually £10–£20 per remaining month, disclosed by your new provider before the switch completes." },
      { question: "Can I keep my Sky email?", answer: "Yes — Sky email addresses stay active as long as you have any Sky account (TV, Broadband, or Mobile)." },
    ],
    related: [{ label: "OCCTA vs Sky", to: "/compare/occta-vs-sky" }, { label: "How to switch", to: "/learn/how-to-switch-broadband" }, BROADBAND, CHECK],
    keywords: "leaving Sky broadband, cancel Sky broadband, switch from Sky, Sky alternative UK",
  },
  {
    slug: "leaving-virgin",
    category: "switching",
    title: "Leaving Virgin Media — switch to Openreach fibre — OCCTA",
    metaDescription: "How to leave Virgin Media broadband: exit fees, cable-to-fibre switch, keeping your number, and finding a cheaper Openreach alternative.",
    h1: "Leaving Virgin Media",
    shortAnswer: "Virgin uses its own cable network, so One Touch Switch doesn't apply — you have to give Virgin 30 days' notice yourself. Meanwhile, sign up with an Openreach provider like OCCTA for the switch date.",
    intro: "Because Virgin runs its own cable, leaving is slightly less automatic than switching between Openreach providers. Here's how to do it cleanly without paying for two services at once.",
    sections: [
      { heading: "Call Virgin to cancel", body: "Ring Virgin on 150 (from a Virgin line) or 0345 454 1111 and give 30 days' notice. Ask for the exact final service date in writing/email." },
      { heading: "Order OCCTA for the day Virgin ends", body: "Book your OCCTA activation for the day after Virgin stops. That way you have zero overlap and zero downtime." },
      { heading: "Return the Virgin equipment", body: "Virgin will send return packaging — post the hub and any V6/TV box back to avoid non-return fees (often £40+)." },
      { heading: "Keep your phone number", body: "Ask Virgin for a PAC (mobile) or ordinary port authority (landline). Give it to OCCTA to keep your number." },
    ],
    faqs: [
      { question: "Can I use One Touch Switch to leave Virgin?", answer: "Not currently. Virgin uses its own cable network, so cross-network switches (cable-to-fibre) require you to call Virgin directly." },
      { question: "What are Virgin exit fees?", answer: "If you're in contract, Virgin charges the remaining months at the current monthly rate (often £30+/mo). Out of contract, no fee applies." },
      { question: "Is Openreach fibre as fast as Virgin cable?", answer: "Yes — full-fibre FTTP delivers up to 900Mbps and lower latency than Virgin's cable in most cases." },
    ],
    related: [{ label: "OCCTA vs Virgin Media", to: "/compare/occta-vs-virgin-media" }, { label: "What is FTTP?", to: "/learn/what-is-fttp" }, BROADBAND, CHECK],
    keywords: "leaving Virgin Media, cancel Virgin broadband, switch from Virgin to fibre, Virgin alternative",
  },
  {
    slug: "leaving-talktalk",
    category: "switching",
    title: "Leaving TalkTalk — how to switch away — OCCTA",
    metaDescription: "Leaving TalkTalk broadband: how to switch, exit fees, and finding a faster provider on the same Openreach network.",
    h1: "Leaving TalkTalk",
    shortAnswer: "Sign up with a new provider — they trigger One Touch Switch and cancel TalkTalk for you. If you're outside your minimum term there's no exit fee.",
    intro: "TalkTalk uses Openreach, so switching is fully automatic under the One Touch Switch rules. You never need to phone TalkTalk retention.",
    sections: [
      { heading: "Check your contract term", body: "Log into MyAccount to see when your minimum term ends. Outside it, switching is free." },
      { heading: "Sign up with your new provider", body: "OCCTA covers most TalkTalk areas at the same or higher speeds. Enter your postcode to check." },
      { heading: "One Touch Switch does the paperwork", body: "The new provider notifies TalkTalk and confirms the switch date. You get an OTS notification showing any early-exit fees before it goes ahead." },
      { heading: "Send the router back", body: "TalkTalk emails a returns label. Post the hub back within 30 days." },
    ],
    faqs: [
      { question: "Are TalkTalk exit fees expensive?", answer: "Around £10–£15 per remaining month if you're still in your minimum term." },
      { question: "Will my speed change if I switch from TalkTalk?", answer: "Not on the same line — both use Openreach so line speed is identical. FTTC-to-FTTP upgrades will be much faster." },
      { question: "Do I lose my landline number?", answer: "No — number porting is part of the One Touch Switch process." },
    ],
    related: [{ label: "OCCTA vs TalkTalk", to: "/compare/occta-vs-talktalk" }, { label: "How to switch", to: "/learn/how-to-switch-broadband" }, BROADBAND, CHECK],
    keywords: "leaving TalkTalk, cancel TalkTalk broadband, switch from TalkTalk, TalkTalk alternative",
  },
  {
    slug: "mid-contract-price-rises",
    category: "switching",
    title: "Mid-contract broadband price rises explained — OCCTA",
    metaDescription: "Why do UK broadband providers put prices up mid-contract? What Ofcom rules say, and how to avoid CPI+3.9% hikes altogether.",
    h1: "Mid-contract price rises: what you need to know",
    shortAnswer: "Most UK ISPs raise prices each April by CPI + 3.9%, even during a fixed-term contract. Since 2025 Ofcom requires future rises to be shown in pounds and pence at sign-up. OCCTA doesn't do them at all.",
    intro: "Broadband inflation is quietly one of the biggest household bill increases in the UK. If you're on a 24-month contract, that annual rise compounds. Here's what to look for.",
    sections: [
      { heading: "The CPI+3.9% rule", body: "For years, providers wrote 'we may increase your monthly price each April by CPI + 3.9%' into contracts. With CPI around 4–10% in recent years, that meant real rises of 8–14%." },
      { heading: "The new Ofcom rules", body: "Since January 2025, any in-contract price rise must be expressed as a specific pound-and-pence amount at the time you sign up — not a percentage. This helps you compare true cost." },
      { heading: "How to avoid rises entirely", body: "Two options: (1) pick a fixed-price/price-lock contract where the monthly price is locked for the whole term; (2) go rolling-monthly where the price is what you see and doesn't rise until you're notified of a change." },
    ],
    faqs: [
      { question: "Are broadband price rises legal?", answer: "Yes, provided the contract clearly discloses them at sign-up (in £ and pence under new Ofcom rules)." },
      { question: "Can I leave without a fee if my price goes up?", answer: "Only if the increase wasn't clearly stated at sign-up. Under the new rules that's rare." },
      { question: "Does OCCTA raise prices mid-contract?", answer: "No. Our Price Lock plans are fixed for the term, and Flex plans are rolling monthly — you're notified 30 days before any change." },
    ],
    related: [{ label: "Price Lock 24 broadband", to: "/broadband/contract-saver", description: "Fixed monthly price for 24 months." }, { label: "Flex 30 rolling monthly", to: "/broadband/flex", description: "Rolling monthly where eligible." }, { label: "How to switch", to: "/learn/how-to-switch-broadband" }, BROADBAND, CHECK],
    keywords: "broadband price rise, CPI + 3.9% broadband, mid-contract price rise, Ofcom price rise rules",
  },
  /* ─── SIM & voice ─── */
  {
    slug: "esim-vs-physical-sim",
    category: "sim",
    title: "eSIM vs physical SIM — which should you choose? OCCTA",
    metaDescription: "eSIM vs physical SIM in the UK: what's the difference, which phones support it, and which is right for you.",
    h1: "eSIM vs physical SIM",
    shortAnswer: "An eSIM is a digital SIM that lives inside your phone — no plastic card. It activates in minutes over Wi-Fi and can be swapped without waiting for post. Physical SIMs still work everywhere.",
    intro: "Most new UK phones support both eSIM and traditional physical SIMs. Here's how to choose.",
    sections: [
      { heading: "eSIM: how it works", body: "Instead of inserting a plastic card, you scan a QR code or activate via an app. The eSIM profile is downloaded to your phone's embedded SIM chip." },
      { heading: "Physical SIM: still the default", body: "A traditional nano-SIM works with every phone made in the last decade and is easy to swap between devices by hand." },
      { heading: "Which is better?", body: "eSIM is better for instant activation, dual-SIM travel, and switching providers quickly. Physical SIM is better if you swap between multiple devices, or use an older/budget phone that doesn't support eSIM." },
      { heading: "OCCTA support", body: "OCCTA SIM plans support both. Order online and choose eSIM at checkout for instant activation, or physical SIM for post delivery." },
    ],
    faqs: [
      { question: "Can I switch from physical SIM to eSIM?", answer: "Yes. Contact us and we'll issue you an eSIM QR code for your existing number and plan." },
      { question: "Do all phones support eSIM?", answer: "Most iPhones from XS onwards and most Android phones from 2020 onwards do. Check your phone's SIM settings." },
      { question: "Is eSIM more secure than physical SIM?", answer: "Slightly — it can't be physically removed if your phone is stolen, and can be locked remotely." },
    ],
    related: [SIM, { label: "Best UK SIM deals", to: "/learn/best-sim-only-deals-uk" }, { label: "Keep your landline number", to: "/learn/keeping-your-landline-number" }, CHECK],
    keywords: "eSIM vs physical SIM, what is eSIM, eSIM UK, how does eSIM work",
  },
  {
    slug: "best-sim-only-deals-uk",
    category: "sim",
    title: "Best SIM-only deals UK 2026 — what to look for — OCCTA",
    metaDescription: "How to find the best SIM-only deal in the UK: rolling contracts, data caps, roaming, and what OCCTA offers.",
    h1: "Best SIM-only deals UK 2026",
    shortAnswer: "The best SIM-only deals are rolling monthly, include enough data for your usage without huge overage costs, and don't sting you for EU roaming. OCCTA plans start from £8/mo.",
    intro: "SIM-only is a no-brainer for anyone who already owns their phone. Here's how to spot a genuine bargain vs a headline price with hidden gotchas.",
    sections: [
      { heading: "Rolling monthly beats 12/24-month tie-ins", body: "Rolling monthly means you can leave any time. If your usage or the market changes, you're not stuck." },
      { heading: "Match data to actual usage", body: "Most people use 10–30GB/month. Check your last three bills before buying an unlimited plan you don't need." },
      { heading: "5G coverage and speeds", body: "5G is now widespread in UK cities. Look for a SIM on a 5G network if you want fast mobile data indoors and out." },
      { heading: "EU roaming rules", body: "Since Brexit, roaming isn't automatically free. OCCTA SIM plans include fair-use EU roaming so you don't come home to a shock bill." },
    ],
    faqs: [
      { question: "How much data do I need?", answer: "Casual users: 5–10GB. Heavy streamers on the go: 30GB+. Check your bills or phone settings for real usage." },
      { question: "Is 5G worth it?", answer: "Yes if you have a compatible phone and live in a covered area — much better indoor coverage and less congestion." },
      { question: "Can I keep my number?", answer: "Yes. Get a PAC code from your old provider and give it to OCCTA at sign-up." },
    ],
    related: [SIM, { label: "eSIM vs physical SIM", to: "/learn/esim-vs-physical-sim" }, BROADBAND, CHECK],
    keywords: "best SIM only deals UK, SIM only UK 2026, cheap SIM only, 5G SIM deals UK",
  },
  {
    slug: "digital-voice-explained",
    category: "voice",
    title: "Digital Voice explained — the UK PSTN switch-off — OCCTA",
    metaDescription: "The UK's PSTN switch-off means every landline moves to Digital Voice by 2027. Here's what changes, what stays the same, and what you need to do.",
    h1: "Digital Voice and the PSTN switch-off explained",
    shortAnswer: "The old copper telephone network (PSTN) is being switched off by 2027. Home phones now run over broadband — same number, same handset in most cases, just a different socket.",
    intro: "This is the biggest change to UK telecoms in decades. If you've had a landline for years, here's what it means for you.",
    sections: [
      { heading: "What is PSTN?", body: "PSTN is the analogue phone network that's carried voices over copper wires since the 1800s. It's expensive to maintain and being retired." },
      { heading: "What replaces it?", body: "Digital Voice — your phone connects to a small adapter on your broadband router. Voice calls travel over the internet." },
      { heading: "What stays the same", body: "Your phone number. Your handset (usually). Ability to call any UK or international number. Emergency calls to 999." },
      { heading: "What changes", body: "You need broadband to make calls. In a power cut, a battery back-up or mobile phone is needed for emergencies. Certain older alarms, telecare pendants and PDQ machines may need upgrading." },
    ],
    faqs: [
      { question: "When does PSTN switch off?", answer: "By end of January 2027 for all UK addresses, though many areas have already migrated." },
      { question: "Do I need to buy a new phone?", answer: "No. Any regular corded or cordless phone plugs into the Digital Voice adapter on your router." },
      { question: "Will 999 still work?", answer: "Yes — 999 calls are prioritised. If you rely on the phone for medical alarms, we can provide a battery back-up unit for power cuts." },
    ],
    related: [VOICE, { label: "Keep your landline number", to: "/learn/keeping-your-landline-number" }, BROADBAND, CHECK],
    keywords: "digital voice UK, PSTN switch off, landline switch off 2027, VoIP home phone UK",
  },
  {
    slug: "keeping-your-landline-number",
    category: "voice",
    title: "Keep your landline number when you switch — OCCTA",
    metaDescription: "How to keep your existing UK landline number when you switch broadband or move to Digital Voice.",
    h1: "Keeping your landline number",
    shortAnswer: "Your landline number is yours. Give it to OCCTA when you sign up and we'll port it over as part of the switch — usually with zero downtime.",
    intro: "You've had the same number for years. You shouldn't have to give it up to save money on your bill.",
    sections: [
      { heading: "Number porting is a legal right", body: "Under Ofcom rules, you can take your number with you when you switch provider. This applies to Digital Voice too." },
      { heading: "How to port", body: "Just tell OCCTA the number you want to keep at sign-up. We coordinate with your old provider via the One Touch Switch or standard porting process." },
      { heading: "How long does it take?", body: "Usually completes on your activation day. Very occasionally takes 5–10 working days depending on the losing provider." },
      { heading: "Moving house?", body: "If you're staying on the same exchange you can usually keep your number. Moving to a different area code may require a new number." },
    ],
    faqs: [
      { question: "Can I keep my number if I move to Digital Voice?", answer: "Yes — number portability applies to Digital Voice the same as traditional landlines." },
      { question: "Is there a charge to keep my number?", answer: "No. Porting is free with OCCTA." },
      { question: "What if my old provider refuses?", answer: "They can't refuse a valid port request. If there's a problem, we escalate it via the Ofcom porting rules." },
    ],
    related: [VOICE, { label: "Digital Voice explained", to: "/learn/digital-voice-explained" }, SWITCH, CHECK],
    keywords: "keep landline number, port phone number UK, keep phone number switch broadband",
  },
  /* ─── Payments & billing ─── */
  {
    slug: "direct-debit-explained",
    category: "payments",
    title: "Direct Debit explained — how it works in the UK — OCCTA",
    metaDescription: "How UK Direct Debit works, what protects you under the Direct Debit Guarantee, and why it's the cheapest way to pay a broadband bill.",
    h1: "Direct Debit: how it works",
    shortAnswer: "Direct Debit lets a company collect a variable amount from your bank account automatically. You're protected by the Direct Debit Guarantee — any error is refunded immediately by your bank.",
    intro: "Direct Debit is the backbone of UK bill payment. It's cheaper, more reliable and safer than card payments for recurring services.",
    sections: [
      { heading: "The basics", body: "You sign a mandate authorising the company to collect payments. Each time they collect, they must give you advance notice of the amount and date." },
      { heading: "The Direct Debit Guarantee", body: "If any Direct Debit is taken incorrectly (wrong amount, wrong date, unauthorised), your bank will refund you immediately, no questions asked. The company then has to sort it out." },
      { heading: "Why it's cheaper than card", body: "Direct Debit has almost no processing fees. Card payments cost the business up to 1.5% per transaction — providers pass that cost back to you." },
      { heading: "Setting up with OCCTA", body: "Enter your bank details on our secure DD form. We show you the exact first collection date and amount before you confirm. Cancel any time via your bank or by contacting us." },
    ],
    faqs: [
      { question: "Is Direct Debit safe?", answer: "Yes — arguably the safest way to pay a bill in the UK, because the DD Guarantee gives you immediate refund rights." },
      { question: "Can OCCTA take more than I owe?", answer: "No — the amount for each collection is pre-notified and covered by the DD Guarantee. Any error is refunded by your bank on request." },
      { question: "How do I cancel a Direct Debit?", answer: "Contact us or your bank. You can cancel any Direct Debit at any time without giving a reason." },
    ],
    related: [{ label: "The DD Guarantee", to: "/learn/direct-debit-guarantee" }, { label: "Paying your OCCTA bill", to: "/learn/paying-broadband-bill" }, { label: "Set up Direct Debit", to: "/direct-debit-setup" }, CHECK],
    keywords: "direct debit explained, how does direct debit work UK, direct debit guarantee, DD payment UK",
  },
  {
    slug: "direct-debit-guarantee",
    category: "payments",
    title: "The Direct Debit Guarantee explained — OCCTA",
    metaDescription: "The UK Direct Debit Guarantee gives you an immediate refund if any DD is taken incorrectly. Full rules and what to do if there's a problem.",
    h1: "The Direct Debit Guarantee",
    shortAnswer: "The Direct Debit Guarantee is a legally-backed protection: if any Direct Debit is taken in error, your bank must give you an immediate refund. It's the strongest consumer protection on any UK payment method.",
    intro: "The scheme is administered by Bacs and every UK bank signs up to it. Here's what it actually guarantees.",
    sections: [
      { heading: "The four guarantees", body: "1. Advance notice of every collection (amount, date). 2. Advance notice of any change to that amount or date. 3. Immediate refund from your bank if there's an error. 4. You can cancel at any time." },
      { heading: "How to claim a refund", body: "Contact your bank — not the company. They must refund the disputed DD immediately. The company then has to sort out the underlying issue with you." },
      { heading: "What OCCTA does", body: "We email you a confirmation of every DD collection (date + amount) at least 3 working days in advance. If any details change, we give at least 10 working days' notice." },
    ],
    faqs: [
      { question: "Who runs the DD Guarantee?", answer: "It's a scheme rule enforced by Bacs and every UK bank." },
      { question: "Do I have to prove the DD was wrong?", answer: "No — your bank refunds first and asks questions later. Fraud claims may be reversed on later investigation but the initial refund is immediate." },
      { question: "Does the DD Guarantee cover cancelled services?", answer: "It covers incorrect collections. If you cancel a service but still get charged, contact us to fix the underlying issue; use the DD Guarantee at your bank if we can't resolve it quickly." },
    ],
    related: [{ label: "Direct Debit explained", to: "/learn/direct-debit-explained" }, { label: "Paying your bill", to: "/learn/paying-broadband-bill" }, { label: "Set up Direct Debit", to: "/direct-debit-setup" }, CHECK],
    keywords: "direct debit guarantee, DD guarantee UK, direct debit refund, bacs guarantee",
  },
  {
    slug: "paying-broadband-bill",
    category: "payments",
    title: "How to pay your broadband bill — the cheapest way — OCCTA",
    metaDescription: "Direct Debit, card, bank transfer, cash — the pros and cons of paying your UK broadband bill each way, and which is cheapest.",
    h1: "How to pay your broadband bill",
    shortAnswer: "Direct Debit is almost always the cheapest way to pay a UK broadband bill — providers usually give a discount or waive processing fees. Card payments are convenient but may incur a small charge.",
    intro: "Every payment method has trade-offs. Here's how to pick the one that costs you least while giving you the most control.",
    sections: [
      { heading: "Direct Debit (recommended)", body: "Cheapest, most automatic, protected by the DD Guarantee. Set once and forget. Most UK ISPs — including OCCTA — offer their best prices for DD customers." },
      { heading: "Debit or credit card", body: "Handy for one-off invoices or if you don't want to give a company your bank details. May carry a small processing fee. Card can expire so you'll need to update the details." },
      { heading: "Bank transfer / Faster Payment", body: "Free, fast, and works from any UK bank. Useful for catch-up payments but requires you to remember to send them each month." },
      { heading: "OCCTA's approach", body: "We accept Direct Debit (preferred), card via Worldpay's secure Hosted Payment Page, and bank transfer for larger business invoices. All amounts and dates are shown in your customer dashboard." },
    ],
    faqs: [
      { question: "Is card safer than Direct Debit?", answer: "Both are protected. Card has chargeback rights; DD has the Direct Debit Guarantee, which is generally easier to invoke." },
      { question: "Do I get a discount for paying by Direct Debit?", answer: "Yes — Direct Debit is our recommended method and is priced accordingly. Card payments may carry a small handling charge." },
      { question: "What happens if I miss a payment?", answer: "We'll email a reminder immediately and re-attempt Direct Debit collection. Late fees only apply after 7 days; service suspension only after 30." },
    ],
    related: [{ label: "Direct Debit explained", to: "/learn/direct-debit-explained" }, { label: "Pay by card", to: "/pay-by-card" }, { label: "Billing explained", to: "/billing-explained" }, CHECK],
    keywords: "how to pay broadband bill, cheapest way to pay broadband, direct debit vs card broadband",
  },
];

export const getLearnPageBySlug = (slug: string): LearnPage | undefined =>
  learnPages.find((p) => p.slug === slug);

export const getLearnPagesByCategory = (cat: LearnCategory): LearnPage[] =>
  learnPages.filter((p) => p.category === cat);
