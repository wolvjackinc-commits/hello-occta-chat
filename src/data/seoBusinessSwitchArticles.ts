import type { SeoArticle } from "@/data/seoArticles";

// Business landline switch-off cluster (Nov 2026). Each page answers what a
// small business owner actually searches for about the PSTN retirement and
// ends at the free line check, which is where OCCTA wins business customers.

const LINE_CHECK = {
  label: "Book a free 15-minute line check",
  to: "/business/line-check",
  description: "We list what uses your line, check your address and quote only if something needs to move.",
};

const CHECKLIST = {
  label: "PSTN switch-off checklist for businesses",
  to: "/learn/pstn-switch-off-business-checklist",
  description: "Everything on your line to check before January 2027.",
};

const CARD = {
  label: "Card machines and the switch-off",
  to: "/learn/card-machine-pstn-switch-off",
  description: "Will your card terminal keep taking payments?",
};

const ALARM = {
  label: "Business alarms and the digital switchover",
  to: "/learn/business-alarm-digital-switchover",
  description: "Intruder, fire and monitored alarms on phone lines.",
};

const LIFT = {
  label: "Lift emergency phones and the switch-off",
  to: "/learn/lift-emergency-phone-digital-switchover",
  description: "What building owners and managers need to check.",
};

const DOOR = {
  label: "Door entry and intercoms on phone lines",
  to: "/learn/door-entry-intercom-digital-switchover",
  description: "Telephone-based door entry systems and the 2027 change.",
};

const BUSINESS_BROADBAND = {
  label: "OCCTA business broadband",
  to: "/business/broadband",
  description: "Connectivity for small businesses, with backup options.",
};

const OFCOM_DIGITAL =
  "https://www.ofcom.org.uk/phones-and-broadband/landline-phones/upgrading-landlines-to-digital-technology";
const OPENREACH_SWITCH =
  "https://www.openreach.com/news/openreach-warns-businesses-just-six-months-left-before-the-uks-old-phone-network-is-switched-off/";
const OPENREACH_DIGITAL =
  "https://www.openreach.com/help-and-support/Upgrading-the-UK-to-digital-phone-lines-for-my-home-or-business";
const GOV_PSTN_CHARTER =
  "https://www.gov.uk/government/publications/public-switched-telephone-network-charter/public-switched-telephone-network-charter";

const AUTHOR = "OCCTA Business Team";
const REVIEWER = "OCCTA Compliance and Product Team";
const DATE = "2026-11-27";

const NEXT_STEP =
  "Not sure what is still on your line? Book a free 15-minute line check: we list what uses it, check your address and only quote if something needs to move.";
const CTA = { label: "Book a free line check", to: "/business/line-check" };

export const seoBusinessSwitchArticles: SeoArticle[] = [
  {
    slug: "pstn-switch-off-business-checklist",
    category: "voice",
    title: "PSTN Switch-Off Checklist for UK Businesses (2027) | OCCTA",
    metaDescription:
      "A practical PSTN switch-off checklist for small businesses: phones, card machines, alarms, door entry, lift lines and numbers to check before January 2027.",
    h1: "PSTN switch-off checklist for UK businesses",
    shortAnswer:
      "Openreach plans to retire the old copper phone network on 31 January 2027. Before your line moves, list everything that uses it (phones, card machine, alarm, door entry, lift line, fax), decide which numbers you must keep, and check each device with its supplier.",
    intro:
      "Most businesses think of the switch-off as a phone problem. In practice the desk phone is usually the easiest part. The things that cause trouble are the devices nobody remembers are plugged into the line: the card terminal behind the till, the alarm panel in a cupboard, the door entry system or the lift phone. This checklist walks through each one in the order we check them on a line check.",
    sections: [
      {
        heading: "1. Find every line and number you pay for",
        body:
          "Start with your latest phone bill. List each line, its number and what you think it is used for. Many businesses pay for a line that nobody can account for; it is often an alarm, a fax or an old card machine line. Note which numbers are printed on signs, vans, websites and stationery, because those are the ones you must keep.",
      },
      {
        heading: "2. Walk the building and follow the cables",
        body:
          "Look at every phone socket and note what is plugged in. Check the comms cupboard, behind the till, the alarm panel, the door entry unit and, if you have one, the lift motor room. A short cable from a device to a wall socket is the clue that it depends on the analogue line.",
      },
      {
        heading: "3. Card machines and payment terminals",
        body:
          "Older countertop terminals sometimes dial out over the phone line. Most current terminals use broadband, Wi-Fi or a mobile SIM instead. Ask your payment provider which connection your terminal uses and whether it needs replacing or reconfiguring before your line changes.",
      },
      {
        heading: "4. Alarms, door entry and lift phones",
        body:
          "Monitored intruder and fire alarms, telephone door entry systems and lift emergency phones are the devices most likely to need work. Each must be checked with the company that installed or maintains it, because only they can confirm whether it will work on a digital line or needs a different signalling path such as a mobile connection.",
      },
      {
        heading: "5. Decide how your phones will work",
        body:
          "Phone calls move to digital voice over broadband. For a small office or shop that usually means either hosted (cloud) phones, which replace the phone system, or SIP trunks, which connect an existing phone system to the internet. Keeping your existing numbers is normally possible but depends on the number and the losing provider's records, so confirm it before you order.",
      },
      {
        heading: "6. Plan for power cuts and broadband faults",
        body:
          "Digital voice depends on powered equipment and a working internet connection. If losing phones or card payments for a few hours would hurt the business, ask about backup: a mobile broadband failover, a battery backup for the router, or mobile handsets that can take calls when the line is down.",
      },
    ],
    faqs: [
      {
        question: "When is the PSTN switch-off for businesses?",
        answer:
          "Openreach plans to retire the old phone network on 31 January 2027. Lines are being moved exchange by exchange before then, so a business can be migrated well before that date.",
      },
      {
        question: "Will my business phone number change?",
        answer:
          "Usually not. Numbers can normally be moved to a digital service, subject to the number's eligibility and the current provider's records. Tell your new provider which numbers must be kept before you order.",
      },
      {
        question: "What happens if I do nothing?",
        answer:
          "Your provider will contact you about migrating the line, but devices that rely on the analogue line, such as some alarms and older card machines, may stop working when it moves unless they have been checked and changed.",
      },
      {
        question: "Do I need new phones?",
        answer:
          "Not always. Some existing handsets work through an adapter or a compatible router. Hosted phone systems usually use IP handsets or apps. A line check tells you what you can keep.",
      },
    ],
    related: [LINE_CHECK, CARD, ALARM, DOOR, LIFT],
    keywords:
      "PSTN switch off business, PSTN switch off checklist, business landline switch off 2027, ISDN switch off small business, digital switchover business, what to do PSTN switch off",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Openreach: businesses warned six months before the old network is switched off", url: OPENREACH_SWITCH },
      { label: "Openreach: upgrading to digital phone lines for your home or business", url: OPENREACH_DIGITAL },
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
  {
    slug: "card-machine-pstn-switch-off",
    category: "voice",
    title: "Will My Card Machine Work After the Switch-Off? | OCCTA",
    metaDescription:
      "Some card machines still dial out over a phone line. Find out how to tell which connection your terminal uses and what to do before the 2027 PSTN switch-off.",
    h1: "Will my card machine still work after the landline switch-off?",
    shortAnswer:
      "If your card terminal connects through broadband, Wi-Fi or its own SIM, the switch-off should not affect it. If it plugs into a phone socket and dials out, it may stop taking payments when your line moves to digital. Check with your payment provider now.",
    intro:
      "A card machine that suddenly cannot connect means lost sales at the till. The good news is that most modern terminals do not use the phone line. The risk sits with older countertop terminals that were installed years ago and have quietly kept working on the same line ever since.",
    sections: [
      {
        heading: "How to tell what your card machine uses",
        body:
          "Look at the cables. A terminal connected to a phone socket with a thin phone cable is likely to be dialling out over the analogue line. A terminal connected to your router with a network cable, or one with no cable at all apart from power, normally uses broadband, Wi-Fi or a mobile SIM. The terminal's settings menu or your payment provider can confirm it.",
      },
      {
        heading: "Ask your payment provider, not just your phone provider",
        body:
          "The company that supplies the terminal is the one that can confirm whether it works over a digital line and, if not, arrange a replacement or a change of connection. Have your merchant ID and the terminal model ready when you call.",
      },
      {
        heading: "Why dial-up terminals are at risk",
        body:
          "Dial-up terminals were designed for the analogue network. Digital voice carries calls as data, and the tones some older terminals use to talk to the bank are not always carried reliably. Some may work on an adapter; others will not. Testing it in a controlled way before your line moves is far better than discovering it on a busy Saturday.",
      },
      {
        heading: "Have a backup for taking payments",
        body:
          "Whatever the terminal uses, think about what happens if the connection drops. A terminal with a built-in SIM, a mobile phone hotspot, or a broadband connection with mobile failover can keep the till working during a broadband fault.",
      },
      {
        heading: "Check the line it uses is not doing something else too",
        body:
          "Some shops share one line between the card machine, the phone and an alarm. When you change the terminal, make sure the other devices on that line are also checked, so nothing loses its connection when the line is migrated.",
      },
      {
        heading: "What to do this week",
        body:
          "Identify the connection your terminal uses, call your payment provider if it uses the phone line, and note any other devices sharing that line. If you would like someone to go through it with you, a line check covers the card machine alongside everything else on your line.",
      },
    ],
    faqs: [
      {
        question: "Do card machines need a phone line?",
        answer:
          "Most modern card machines do not; they use broadband, Wi-Fi or a mobile SIM. Some older countertop terminals still dial out over a phone line and are the ones to check.",
      },
      {
        question: "Will my card machine work on a digital landline?",
        answer:
          "It depends on the terminal. Your payment provider can confirm whether it works on digital voice or needs a different connection.",
      },
      {
        question: "Who pays for a replacement card machine?",
        answer:
          "That depends on your agreement with your payment provider. Ask them before your line is migrated so the change can be planned.",
      },
      {
        question: "Can my card machine use mobile data instead?",
        answer:
          "Many terminals can use a built-in SIM. Ask your payment provider whether your model supports it or whether a different terminal is needed.",
      },
    ],
    related: [LINE_CHECK, CHECKLIST, ALARM, BUSINESS_BROADBAND],
    keywords:
      "card machine landline switch off, PDQ machine digital switchover, will my card machine work after PSTN switch off, card terminal phone line, card machine phone line 2027",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Openreach: businesses warned six months before the old network is switched off", url: OPENREACH_SWITCH },
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
  {
    slug: "business-alarm-digital-switchover",
    category: "voice",
    title: "Business Alarms and the Digital Switchover (2027) | OCCTA",
    metaDescription:
      "Monitored intruder and fire alarms often signal over a phone line. Learn what changes at the 2027 PSTN switch-off and what to ask your alarm company.",
    h1: "Business alarms and the digital switchover: what to check",
    shortAnswer:
      "Monitored intruder and fire alarms that send signals over the analogue phone line may stop reaching the monitoring centre when your line moves to digital. Ask your alarm company whether your panel's signalling is compatible, and whether it should move to a mobile or dual-path connection.",
    intro:
      "An alarm that cannot call out is worse than no alarm, because everyone assumes it works. Many business alarm panels were installed with a communicator that dials the monitoring centre over the phone line. This guide explains what to check, who to ask and why you should not wait for the line to move first.",
    sections: [
      {
        heading: "Is your alarm monitored over the phone line?",
        body:
          "If a monitoring centre or keyholders are contacted when the alarm goes off, the panel needs a way to call out. Older systems often use a communicator wired to a phone socket. Newer systems may use a mobile SIM, broadband, or both. Your alarm maintenance company can tell you which yours uses.",
      },
      {
        heading: "Why the switch-off matters for alarm signalling",
        body:
          "Some alarm communicators rely on characteristics of the analogue line that digital voice does not reproduce in the same way. A panel can look healthy on the wall while failing to deliver signals to the monitoring centre. Only a test arranged with your alarm company proves the signal gets through.",
      },
      {
        heading: "Insurance and certification",
        body:
          "Your insurer may require the alarm to be monitored or to meet a particular grade. If the signalling path changes, check with your alarm company that the system still meets the certification your insurance relies on, and keep their confirmation on file.",
      },
      {
        heading: "Fire alarms need the same care",
        body:
          "Monitored fire alarms in shops, offices, care settings and multi-occupancy buildings can also signal over phone lines. The responsible person for fire safety should ask the fire alarm maintainer to confirm the signalling path before the line is migrated.",
      },
      {
        heading: "Do not unplug it to test it",
        body:
          "Pulling the alarm's phone cable to see what happens can cause a false alarm or leave the building unprotected. Arrange a controlled test with the alarm company, ideally before your phone provider schedules the line migration.",
      },
      {
        heading: "Coordinate the alarm and the phone line",
        body:
          "Tell your phone provider that an alarm uses the line, and tell your alarm company when the line is due to change. Doing both avoids the gap where the line has moved but the alarm has not been updated.",
      },
    ],
    faqs: [
      {
        question: "Will my business alarm stop working in 2027?",
        answer:
          "The alarm itself will keep sounding, but if it calls a monitoring centre over the analogue line it may stop reaching them. Your alarm company can confirm and arrange an upgrade if needed.",
      },
      {
        question: "What is dual-path alarm signalling?",
        answer:
          "It means the alarm has two ways to send signals, commonly a mobile connection plus broadband, so one can take over if the other fails. Your alarm company can say whether it suits your system and insurance.",
      },
      {
        question: "Who do I contact about my alarm and the switch-off?",
        answer:
          "The company that installed or maintains the alarm, and your monitoring centre if it is a separate company. Also tell your phone provider an alarm uses the line.",
      },
      {
        question: "Does my insurer need to know?",
        answer:
          "If your policy depends on monitored or graded alarm signalling, check with your insurer and alarm company that any change keeps you covered.",
      },
    ],
    related: [LINE_CHECK, CHECKLIST, DOOR, LIFT],
    keywords:
      "alarm PSTN switch off, business alarm digital switchover, monitored alarm phone line 2027, fire alarm phone line switch off, alarm communicator digital line",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
      { label: "GOV.UK: Public Switched Telephone Network charter", url: GOV_PSTN_CHARTER },
      { label: "Openreach: upgrading to digital phone lines for your home or business", url: OPENREACH_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
  {
    slug: "lift-emergency-phone-digital-switchover",
    category: "voice",
    title: "Lift Emergency Phones and the PSTN Switch-Off | OCCTA",
    metaDescription:
      "Lift emergency phones often use a dedicated phone line. Learn what building owners and managers should check with their lift company before January 2027.",
    h1: "Lift emergency phones and the PSTN switch-off",
    shortAnswer:
      "Many lift emergency phones (autodiallers) use a dedicated analogue phone line. When that line moves to digital, the phone may not connect when someone is trapped. Ask your lift maintenance company to confirm the autodialler works on the new connection, or to move it to a mobile unit, and test it.",
    intro:
      "A lift alarm is the one phone call in the building that has to work. If you own or manage a building with a passenger lift, the emergency phone is likely to be on its own line that nobody thinks about until the bill arrives. Here is what to check.",
    sections: [
      {
        heading: "Find the lift line",
        body:
          "Lift emergency phones are often on a separate line with its own number, sometimes billed to a different account. Check your bills and ask your lift maintenance company which number the lift uses and where the line terminates, usually in the lift motor room or control panel.",
      },
      {
        heading: "Ask the lift company to confirm compatibility",
        body:
          "The autodialler in the lift car calls a monitoring centre and lets the trapped person talk to an operator. Your lift company can confirm whether that unit works over a digital line, needs a compatible adapter, or should be replaced with a mobile-based unit.",
      },
      {
        heading: "Power and resilience",
        body:
          "An analogue line was powered from the exchange. A digital line depends on powered equipment in the building. Lift alarm units normally have battery backup, but the connection they use must also stay up during a power cut. Ask the lift company how the alarm keeps working when the mains fails.",
      },
      {
        heading: "Test after any change",
        body:
          "Whenever the line or unit changes, have the lift company make a test call from the lift car to the monitoring centre and record the result. Keep the record with your lift maintenance documents.",
      },
      {
        heading: "Building managers: check every lift",
        body:
          "If you manage several sites, list each lift, its line number, its maintainer and the date its emergency phone was last tested. The lifts on forgotten lines are the ones at risk.",
      },
      {
        heading: "Coordinate with your phone provider",
        body:
          "Tell your phone provider that a line serves a lift emergency phone, so it is not migrated or ceased without the lift company being ready. A line check identifies these lines alongside everything else in the building.",
      },
    ],
    faqs: [
      {
        question: "Do lift emergency phones need a landline?",
        answer:
          "Many existing lift phones use an analogue line, but modern units can use a mobile connection. Your lift maintenance company can confirm what yours uses and the options.",
      },
      {
        question: "Will my lift phone stop working at the switch-off?",
        answer:
          "It may, if it relies on the analogue line and has not been checked. Ask your lift company to confirm and test it before the line is migrated.",
      },
      {
        question: "Who is responsible for the lift emergency phone?",
        answer:
          "Usually the building owner or managing agent, working with the lift maintenance company that services the lift.",
      },
      {
        question: "Can a lift phone use a SIM instead?",
        answer:
          "Many lift alarm units can use a mobile SIM. Your lift company will advise on signal in the lift shaft and the right unit.",
      },
    ],
    related: [LINE_CHECK, CHECKLIST, DOOR, ALARM],
    keywords:
      "lift emergency phone PSTN switch off, lift line digital switchover, lift autodialler 2027, lift phone line switch off, lift alarm phone line",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Openreach: businesses warned six months before the old network is switched off", url: OPENREACH_SWITCH },
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
  {
    slug: "door-entry-intercom-digital-switchover",
    category: "voice",
    title: "Door Entry and Intercoms: the Digital Switchover | OCCTA",
    metaDescription:
      "Telephone door entry systems often use an analogue phone line. Learn how to check yours and what to ask your installer before the 2027 PSTN switch-off.",
    h1: "Door entry systems, intercoms and the digital switchover",
    shortAnswer:
      "Some door entry panels call residents' or staff phones over an analogue phone line. When that line moves to digital, the panel may stop calling out. Check whether your system uses a phone line, then ask the installer whether it needs an adapter, a mobile (GSM) module or an upgrade.",
    intro:
      "Door entry problems tend to show up as a queue of visitors, couriers and residents who cannot get in. Systems that ring a phone, rather than a handset wired inside the building, are the ones most likely to depend on the old phone line. This guide is for businesses, landlords and managing agents.",
    sections: [
      {
        heading: "Which door entry systems use a phone line?",
        body:
          "Systems where a visitor presses a button and it rings a landline or mobile number often use a phone line to place that call. Systems that ring a handset wired inside each flat or office usually do not. Your installer or the label inside the panel will tell you which type you have.",
      },
      {
        heading: "Find the line and the number",
        body:
          "Door entry lines are often separate lines billed to the building, the landlord or a managing agent. Check bills for a line nobody uses for calls; it may be the door entry.",
      },
      {
        heading: "Options if yours depends on the line",
        body:
          "Depending on the system, the installer may be able to connect it through an adapter on a digital line, fit a mobile (GSM or 4G) module, or replace it with an IP or app-based system. The right option depends on the panel, the building and the mobile signal at the door.",
      },
      {
        heading: "Fire safety and access",
        body:
          "Some access control systems link to fire alarms to release doors. If you change the door entry system or its connection, make sure the fire safety arrangements are checked by the responsible person and the installer.",
      },
      {
        heading: "Landlords and managing agents",
        body:
          "Tell tenants and residents in advance if the door entry will change, especially if they will need to register a new number or app. Keep a list of which buildings have phone-based door entry and when each was checked.",
      },
      {
        heading: "Coordinate before the line moves",
        body:
          "Tell your phone provider the line serves door entry, and agree a date with your installer so the change happens at the same time as the line migration rather than after something stops working.",
      },
    ],
    faqs: [
      {
        question: "Will my intercom stop working after the PSTN switch-off?",
        answer:
          "If it places calls over an analogue phone line, it may. Systems wired to handsets inside the building usually are not affected. Your installer can confirm.",
      },
      {
        question: "What is a GSM door entry system?",
        answer:
          "It uses a mobile SIM to call the numbers programmed into it, so it does not need a phone line. Mobile signal at the door has to be good enough.",
      },
      {
        question: "Who should I contact about my door entry system?",
        answer:
          "The company that installed or maintains it. If you rent, your landlord or managing agent is usually responsible.",
      },
      {
        question: "Can I keep the same door entry number?",
        answer:
          "Sometimes. It depends on the system and the number. Ask your installer and phone provider before the line changes.",
      },
    ],
    related: [LINE_CHECK, CHECKLIST, LIFT, ALARM],
    keywords:
      "door entry PSTN switch off, intercom digital switchover, door entry phone line 2027, telephone entry system landline, GSM door entry",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Openreach: upgrading to digital phone lines for your home or business", url: OPENREACH_DIGITAL },
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
  {
    slug: "huddersfield-business-landline-switch-off",
    category: "voice",
    title: "Landline Switch-Off for Huddersfield Businesses | OCCTA",
    metaDescription:
      "A local guide for Huddersfield and Kirklees businesses: what the 2027 landline switch-off means, what to check on your line, and how to book a free line check.",
    h1: "Landline switch-off: a guide for Huddersfield businesses",
    shortAnswer:
      "Phone lines across Huddersfield and Kirklees are moving from the old copper network to digital before Openreach retires it on 31 January 2027. Shops, offices, salons, care providers and trades should check what uses their line now, before their exchange moves.",
    intro:
      "OCCTA is a Huddersfield-based telecoms provider. We wrote this guide for local businesses because the questions we hear are always the same: when does our line change, will our card machine and alarm keep working, and can we keep our number. Here are the straight answers.",
    sections: [
      {
        heading: "When will my Huddersfield line change?",
        body:
          "Lines move exchange by exchange, and your current provider should contact you before yours is migrated. Do not wait for that letter to start checking: the work that takes time is with your alarm, card machine, door entry or lift company, not the phone line itself.",
      },
      {
        heading: "What local businesses usually find on the line",
        body:
          "On a typical high-street line we find a phone, a card machine and often an alarm. Care providers and accommodation often add door entry, nurse call or a lift line. Offices and workshops sometimes still have a fax or franking machine nobody has used for years but still pay for.",
      },
      {
        heading: "Keeping your local 01484 number",
        body:
          "Local numbers can normally be moved to a digital service, subject to eligibility and the current provider's records. If your number is on your sign, van or website, tell your new provider before ordering so the move is planned.",
      },
      {
        heading: "Broadband is now the line",
        body:
          "Calls run over your broadband, so the connection matters more than it used to. Check what is available at your address, and if losing phones or card payments for a few hours would cost you, ask about mobile backup.",
      },
      {
        heading: "Talk to someone local",
        body:
          "Our team is based in Huddersfield. A free 15-minute line check by phone or video covers what is on your line, what is available at your address and whether anything needs to move. If something does, you get a written quote first; there is no obligation.",
      },
      {
        heading: "What to do this week",
        body:
          "Find your latest phone bill, list what is plugged into each socket, and note which numbers you must keep. Then either work through our business switch-off checklist or book a line check and we will go through it with you.",
      },
    ],
    faqs: [
      {
        question: "Is the landline switch-off happening in Huddersfield?",
        answer:
          "Yes. It is a UK-wide change. Openreach plans to retire the old network on 31 January 2027 and lines are being moved before then.",
      },
      {
        question: "Can I keep my 01484 number?",
        answer:
          "Usually, yes, subject to the number's eligibility and the current provider's records. Confirm it with your new provider before ordering.",
      },
      {
        question: "Is OCCTA based in Huddersfield?",
        answer:
          "Yes. OCCTA's UK team is based in Huddersfield and can help local businesses by phone or video.",
      },
      {
        question: "How much does the line check cost?",
        answer:
          "It is free and there is no obligation. If anything needs to change, you get a written quote before deciding.",
      },
    ],
    related: [LINE_CHECK, CHECKLIST, CARD, BUSINESS_BROADBAND],
    keywords:
      "landline switch off Huddersfield, business phone line Huddersfield, PSTN switch off Kirklees, business broadband Huddersfield, digital phone line Huddersfield",
    authorName: AUTHOR,
    reviewedBy: REVIEWER,
    datePublished: DATE,
    dateModified: DATE,
    sources: [
      { label: "Openreach: businesses warned six months before the old network is switched off", url: OPENREACH_SWITCH },
      { label: "Ofcom: landlines going digital", url: OFCOM_DIGITAL },
    ],
    primaryCta: CTA,
    nextStepText: NEXT_STEP,
  },
];

export function getSeoBusinessSwitchArticleBySlug(slug: string): SeoArticle | undefined {
  return seoBusinessSwitchArticles.find((article) => article.slug === slug);
}
