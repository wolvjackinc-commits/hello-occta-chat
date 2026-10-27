import { AlertCircle, AlertTriangle, Lock, Receipt, ShoppingCart, Smartphone, Wifi } from "lucide-react";

// FAQ hub data, used by /faq, /support and the chat help panel.
// Same accuracy rules as src/data/helpArticles.ts: Direct Debit or bank
// transfer only, facts from the live consumer agreement, no invented fees,
// SLAs, compensation schemes or support hours.

export const faqCategories = [
  { id: "billing", icon: Receipt, title: "Billing & Payments", description: "Invoices, Direct Debit, bank transfer, refunds" },
  { id: "services", icon: Wifi, title: "Broadband & Home Phone", description: "Setup, speeds, Wi-Fi, Digital Voice" },
  { id: "mobile", icon: Smartphone, title: "Mobile & SIM", description: "Activation, eSIM, PAC codes, data" },
  { id: "faults", icon: AlertTriangle, title: "Faults & Troubleshooting", description: "No internet, dropouts, outages" },
  { id: "orders", icon: ShoppingCart, title: "Orders, Moving & Switching", description: "Go-live, engineers, moving, leaving" },
  { id: "account", icon: Lock, title: "Account & Security", description: "Sign-in, details, scams, privacy" },
  { id: "complaints", icon: AlertCircle, title: "Complaints & Extra Help", description: "Complaints, ADR, accessibility" },
];

export const faqs = [
  // Billing & Payments
  { question: "How do I pay my bill?", answer: "Pay by Direct Debit for automatic payments each month, or by bank transfer to OCCTA LIMITED (Lloyds Bank, sort code 30-98-97, account 61499362) quoting your OCCTA account number. We do not take card or phone payments.", category: "billing" },
  { question: "When does billing start?", answer: "Only once your service is confirmed live. Monthly charges are then billed in advance on your billing date. Your first invoice may include a pro-rata amount and any one-off charges from your Contract Summary.", category: "billing" },
  { question: "Where can I download invoices?", answer: "Sign in to your account and open Billing. Every invoice is available to view and download as a PDF.", category: "billing" },
  { question: "How do I set up or change my Direct Debit?", answer: "Sign in, open Billing and set up a Direct Debit mandate, or use the secure link we email you. To change bank, set up a new mandate and let us know. Until a mandate is confirmed active, pay invoices by bank transfer.", category: "billing" },
  { question: "My Direct Debit failed — what now?", answer: "We'll email you. Pay that invoice by bank transfer, quoting your account number. If money is tight, contact us early and we'll talk through a payment arrangement.", category: "billing" },
  { question: "Is there a late-payment charge?", answer: "A £10 late-payment administration charge may apply only after an overdue notice and a reasonable opportunity to pay, and never repeatedly on the same invoice.", category: "billing" },
  { question: "Do prices go up every April?", answer: "No. OCCTA residential contracts don't include scheduled CPI-, RPI-, inflation-linked or percentage-based price rises. Price Lock 24 keeps your broadband price fixed for the 24-month minimum term.", category: "billing" },
  { question: "Can I change my billing date?", answer: "Contact us with your preferred day of the month and we'll tell you whether it can be moved and how it's pro-rated.", category: "billing" },
  { question: "I think I've been charged incorrectly.", answer: "Raise a billing ticket with the invoice number and what looks wrong. If a Direct Debit was taken in error, you're also protected by the Direct Debit Guarantee. We won't restrict service over an amount that's genuinely disputed.", category: "billing" },
  { question: "How do refunds work?", answer: "Approved refunds are returned by bank transfer to the paying account, or applied as a credit to your next invoice if you prefer.", category: "billing" },
  { question: "Is there a data cap?", answer: "Standard residential broadband has no monthly data cap unless your order says otherwise. Mobile plan allowances are shown in your plan details.", category: "billing" },

  // Broadband & Home Phone
  { question: "How do I check my broadband speed?", answer: "Test with a laptop connected to the router by Ethernet, with other devices paused, at a few different times of day. Compare the average with the speeds in your Contract Summary. Wi-Fi results are usually lower than wired.", category: "services" },
  { question: "My Wi-Fi is slow — what should I try first?", answer: "Restart the router, move it into the open and off the floor, and connect nearby devices to the 5 GHz network. If a wired test is fast, the broadband is fine and the issue is Wi-Fi coverage.", category: "services" },
  { question: "Is a router included?", answer: "Not as standard. Your order states whether you bought, rented or are using your own equipment. You can use your own compatible PPPoE router — see /help/own-router-setup.", category: "services" },
  { question: "How do I set up my own router with OCCTA?", answer: "Use the PPPoE username and password from your OCCTA welcome / go-live email. Full instructions, brand-specific admin URLs and troubleshooting are at /help/own-router-setup.", category: "services" },
  { question: "What is PPPoE?", answer: "PPPoE is the login method your router uses to authenticate with OCCTA broadband. Enter the OCCTA-supplied username and password into your router's PPPoE / WAN settings.", category: "services" },
  { question: "What's the difference between 2.4 GHz and 5 GHz Wi-Fi?", answer: "2.4 GHz reaches further but is slower and busier. 5 GHz is much faster at short range. Use 5 GHz for devices near the router.", category: "services" },
  { question: "How do I change my Wi-Fi name and password?", answer: "Log in to your router's admin page (the address is usually on the router label), open the Wi-Fi settings, change the network name and password, save and reconnect your devices.", category: "services" },
  { question: "Do you throttle streaming or gaming?", answer: "No. We don't block or throttle lawful apps or content for commercial reasons. Temporary, proportionate measures are only used for security, legal compliance or exceptional congestion.", category: "services" },
  { question: "How do I set up Digital Voice?", answer: "Plug your home phone into the Phone/Tel port on the router, not the wall socket, and check for a dial tone. Most standard phones work.", category: "services" },
  { question: "Does Digital Voice work in a power cut?", answer: "Not on its own — it needs working broadband, compatible equipment and mains power. 999 and 112 are free when it's working. If anyone relies on the line for telecare or safety, tell us so we can discuss resilience options.", category: "services" },
  { question: "Can I keep my landline number?", answer: "Usually, yes. Tell us when you order and we'll arrange the port. Don't cancel your old line yourself before it completes, or the number may be lost.", category: "services" },
  { question: "How do I block nuisance calls?", answer: "Register free with the Telephone Preference Service, use your handset's block list and forward spam texts to 7726.", category: "services" },
  { question: "Do you provide parental controls?", answer: "Most routers, devices and apps include parental controls and schedules. Ask us what customer-chosen filtering is available for your service.", category: "services" },

  // Mobile & SIM
  { question: "How do I activate my SIM?", answer: "Power the phone off, insert the SIM, power it on and follow any activation instructions we sent. You should see signal within a few minutes.", category: "mobile" },
  { question: "Which networks do OCCTA SIMs use?", answer: "OCCTA SIM plans are available on O2, Vodafone and EE. Your plan details show which network your SIM uses.", category: "mobile" },
  { question: "Do you support eSIM?", answer: "Yes, on compatible unlocked phones. We send a QR code — scan it from your phone's mobile/SIM settings while connected to Wi-Fi.", category: "mobile" },
  { question: "How do I keep my mobile number?", answer: "Text PAC to 65075 from your current phone, then give us the PAC code. Ports normally complete within one working day.", category: "mobile" },
  { question: "My mobile data isn't working.", answer: "Check mobile data is on and Aeroplane mode is off, restart the phone, then check the APN matches your SIM setup information. If it still fails, raise a ticket with your phone model.", category: "mobile" },
  { question: "Can I use my plan abroad?", answer: "Roaming depends on your plan. Check your plan details or ask us before you travel, and turn data roaming on or off in your phone settings.", category: "mobile" },
  { question: "My phone was lost or stolen.", answer: "Contact us straight away so we can bar the SIM, lock the phone with Find My / Find My Device, change your key passwords and report theft to the police on 101.", category: "mobile" },

  // Faults & Troubleshooting
  { question: "My internet isn't working — what should I do?", answer: "Check occta.co.uk/status from mobile data, check power and cables, restart the router and wait 10 minutes, then test with an Ethernet cable. Still down? Report a fault with your account number and what the lights are showing.", category: "faults" },
  { question: "How do I report a fault?", answer: "Raise a ticket from your account so it's tracked from the start, or email hello@occta.co.uk. Include when it started, the router lights, wired speed tests and what you've tried.", category: "faults" },
  { question: "How do I reboot or reset my router?", answer: "To restart, turn it off at the wall for 30 seconds then back on. A factory reset (holding the reset pin 10–15 seconds) wipes all settings, including own-router PPPoE details — only do it if we ask.", category: "faults" },
  { question: "Why does my connection keep dropping?", answer: "Watch the router's internet light when it happens. If it goes off, the line is dropping — report it. If it stays on, it's Wi-Fi: move the router into the open and reduce interference.", category: "faults" },
  { question: "Why is my latency high while gaming?", answer: "Use a wired connection, pause downloads and streams, and choose a nearby game server. Consistent packet loss over Ethernet is worth reporting to us.", category: "faults" },
  { question: "What should I do if there's an outage?", answer: "Check occta.co.uk/status for updates. Use a mobile for urgent calls. If there's no reported outage, restart your equipment and report a fault.", category: "faults" },
  { question: "Will I get a credit for a long outage?", answer: "Credits and compensation apply where required by law or included in your order. Tell us about a long outage and we'll explain what's available to you.", category: "faults" },

  // Orders, Moving & Switching
  { question: "How long until my broadband is live?", answer: "We confirm your go-live date once the network accepts your order. Switches without an engineer visit are typically quicker than new full-fibre installs.", category: "orders" },
  { question: "Do I need an engineer visit?", answer: "Most switches don't. New full-fibre installs, new lines and some faults do. An adult aged 18 or over must be present.", category: "orders" },
  { question: "Do I need to cancel my old provider?", answer: "Not where One Touch Switch applies — we coordinate the switch with them. Don't cancel yourself, especially if you're keeping your phone number.", category: "orders" },
  { question: "Is there a cooling-off period?", answer: "Yes. For contracts made online or by phone you normally have 14 calendar days to cancel. If you asked us to start in that time, a proportionate amount for service supplied may apply.", category: "orders" },
  { question: "Can I move my broadband to a new address?", answer: "Yes. Tell us your move date as early as possible — ideally a month ahead. If the service can move without new network work, there's no home-move fee.", category: "orders" },
  { question: "How do I cancel my service?", answer: "To switch provider, just sign up with your new provider. To cancel outright, give notice through your account, by email or by post. Flex 30 has a 30-day notice period and no remaining-month early termination charge.", category: "orders" },
  { question: "Is there an Early Termination Charge?", answer: "Only on fixed terms such as Price Lock 24 if you leave during the minimum term and no penalty-free exit applies. It never exceeds the recurring charges remaining. Flex 30 has no remaining-month early termination charge.", category: "orders" },
  { question: "Do I need to return my router?", answer: "Only if it was rented or loaned. Follow the return instructions we send and return it within 14 days. If you bought it, it's yours.", category: "orders" },

  // Account & Security
  { question: "How do I contact support or raise a ticket?", answer: "Chat with Ollie any time, sign in to raise a tracked ticket, email hello@occta.co.uk, or call 0800 260 6626 (Mon–Fri, 8am–6pm).", category: "account" },
  { question: "I forgot my password — how do I reset it?", answer: "Use 'Forgot password' on the sign-in page and follow the email link. Check your spam folder if it doesn't arrive.", category: "account" },
  { question: "How do I update my personal details?", answer: "Sign in and open Account Settings. For a change of name or account holder, raise a ticket so we can verify it. Keep your service address current — emergency calls on Digital Voice may rely on it.", category: "account" },
  { question: "Can someone else manage my account?", answer: "Yes. With your consent you can nominate a trusted person, or send us a registered power of attorney.", category: "account" },
  { question: "Will OCCTA ever ask for my card details or password?", answer: "Never. We don't take card payments and we never ask for passwords or one-time codes. If someone does, it isn't us — hang up and contact us directly.", category: "account" },
  { question: "How do I get a copy of my data?", answer: "Email hello@occta.co.uk with 'Data request' in the subject. We'll verify your identity and normally respond within one month.", category: "account" },
  { question: "How do I report a security issue?", answer: "Email hello@occta.co.uk with 'Security' in the subject and as much detail as you can. We'll investigate promptly.", category: "account" },

  // Complaints & Extra Help
  { question: "How do I make a formal complaint?", answer: "Use our Complaints page, raise a ticket or email hello@occta.co.uk. We acknowledge within 2 working days and aim to resolve within 10 working days. If it isn't resolved within 6 weeks, or we issue a deadlock letter sooner, you can go to ADR free of charge.", category: "complaints" },
  { question: "What is ADR?", answer: "Alternative Dispute Resolution is a free, independent service that reviews complaints we haven't been able to resolve. We'll give you the scheme's details in writing.", category: "complaints" },
  { question: "I need extra support — who do I tell?", answer: "Tell us at any time by ticket, email or phone. We offer priority handling, Digital Voice resilience assessments, payment arrangements, accessible formats and nominated contacts — free and confidential.", category: "complaints" },
  { question: "Can I get bills in large print or braille?", answer: "Yes, large print, braille or audio formats are available free of charge on request.", category: "complaints" },
];
