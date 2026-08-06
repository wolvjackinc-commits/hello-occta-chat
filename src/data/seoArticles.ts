import type { LearnPage } from "@/data/learnPages";

export interface SeoArticleSource {
  label: string;
  url: string;
}

export interface SeoArticle extends LearnPage {
  authorName: string;
  reviewedBy: string;
  datePublished: string;
  dateModified: string;
  sources: SeoArticleSource[];
}

const CHECK = {
  label: "Check availability at your address",
  to: "/build-plan",
  description: "See the broadband options available at your postcode.",
};

const BUSINESS = {
  label: "Business broadband",
  to: "/business/broadband",
  description: "Connectivity options for UK small businesses.",
};

const BUSINESS_QUOTE = {
  label: "Request a business quote",
  to: "/business/quote",
  description: "Tell us what your organisation needs.",
};

const BROADBAND = {
  label: "OCCTA broadband plans",
  to: "/broadband",
};

const SIM = {
  label: "OCCTA SIM plans",
  to: "/sim",
};

const OPENREACH_INSTALL =
  "https://www.openreach.com/help-and-support/how-is-full-fibre-installed";
const OPENREACH_CHECKLIST =
  "https://www.openreach.com/help-and-support/full-fibre-broadband-installation-checklist";
const OFCOM_SPEEDS =
  "https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/broadband-speeds-code-practice";
const OFCOM_CONTRACT =
  "https://www.ofcom.org.uk/phones-and-broadband/switching-provider/checklist-when-taking-out-new-phone-or-broadband-contract";
const OFCOM_JARGON =
  "https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/jargon-buster";
const NCSC_PREPARE =
  "https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery/step-1-prepare-for-incidents";
const NCSC_BACKUPS =
  "https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security/backing-up-your-data";

export const seoArticles: SeoArticle[] = [
  {
    slug: "small-business-broadband-guide",
    category: "broadband",
    title: "Small business broadband guide: what to compare — OCCTA",
    metaDescription:
      "A practical UK small business broadband checklist covering speed, upload capacity, resilience, support, static IP needs and contract terms.",
    h1: "Small business broadband: what should you compare?",
    shortAnswer:
      "Choose business broadband by matching the connection to the work it must support. Compare busy-time download and upload speeds, reliability, support, resilience, contract terms and any need for a static IP—not just the headline Mbps.",
    intro:
      "Broadband is now part of the operating infrastructure of most small businesses. Card terminals, cloud software, calls, security systems and customer Wi-Fi may all depend on it. This guide helps you turn those daily requirements into a sensible connectivity brief before you request quotes.",
    sections: [
      {
        heading: "Start with the work the connection must carry",
        body:
          "List the services that stop or become difficult without internet access: cloud accounting, Microsoft 365 or Google Workspace, video meetings, online ordering, EPOS, VoIP, CCTV, file transfers and guest Wi-Fi. Note how many people and devices use them at the same time. A five-person office uploading design files has a different requirement from a café whose most critical devices are tills and card terminals.",
      },
      {
        heading: "Compare upload speed as well as download speed",
        body:
          "Download speed affects receiving data, streaming and loading cloud applications. Upload speed affects sending files, cloud backups, video calls, hosted services and off-site CCTV viewing. Ask for both estimated download and upload performance at the address, including the speed expected during the provider's stated busy period.",
      },
      {
        heading: "Decide how much downtime the business can tolerate",
        body:
          "A low-cost connection may be appropriate where staff can temporarily use mobile data. A business that cannot take payments or answer internet-based calls during an outage needs a stronger continuity plan. That may include a 4G or 5G backup connection, a separate second line, documented failover steps and battery power for essential networking equipment.",
      },
      {
        heading: "Check support and fault-handling arrangements",
        body:
          "Ask when support is available, how faults are logged, what information is provided during an incident and whether the service has any stated repair objective. Keep the order reference, circuit details and support contacts somewhere staff can reach even when the main connection is unavailable.",
      },
      {
        heading: "Work out whether you need a static IP",
        body:
          "Most small firms do not need a static public IP. It can be useful for approved remote access, IP allow-listing, some VPN designs, hosted services and certain monitoring systems. It should not be treated as a security feature by itself. Ask your IT provider what is genuinely required before adding it to the specification.",
      },
      {
        heading: "Read the complete commercial terms",
        body:
          "Compare the minimum term, notice period, setup charges, equipment ownership, price changes, moving-premises process and early termination charges. Ofcom says customers should receive clear information about estimated download and upload speeds when buying fixed broadband. Keep the Contract Summary and related agreement documents with your business records.",
      },
    ],
    faqs: [
      {
        question: "Is business broadband different from home broadband?",
        answer:
          "It can include business-focused support, service options, static IP availability and terms designed for commercial use. The exact differences vary by provider and product, so compare the written specification rather than relying on the label.",
      },
      {
        question: "How much broadband speed does a small office need?",
        answer:
          "There is no single correct figure. Count simultaneous users and identify heavy activities such as cloud backups, large uploads and video meetings. A reliable connection with suitable upload capacity can matter more than buying the highest headline download speed.",
      },
      {
        question: "Should a small business have backup internet?",
        answer:
          "It is sensible when losing connectivity would stop payments, calls, bookings or essential cloud systems. The backup can be mobile or fixed, but it should use a sufficiently independent route and be tested before it is needed.",
      },
      {
        question: "Can OCCTA quote for business connectivity?",
        answer:
          "Yes. Use the business quote form to describe your premises, users, critical systems, voice requirements and resilience needs. Availability and product features are confirmed for the specific address.",
      },
    ],
    related: [
      BUSINESS,
      BUSINESS_QUOTE,
      { label: "Business broadband backup guide", to: "/learn/business-broadband-backup-guide" },
      { label: "Static IP addresses explained", to: "/learn/static-ip-address-explained" },
    ],
    keywords:
      "small business broadband UK, business internet checklist, compare business broadband, broadband for small office, SME broadband",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Ofcom: checklist for a new phone or broadband contract", url: OFCOM_CONTRACT },
      { label: "Ofcom: broadband speeds—what you need to know", url: OFCOM_SPEEDS },
      { label: "NCSC: prepare for incidents", url: NCSC_PREPARE },
    ],
  },
  {
    slug: "static-ip-address-explained",
    category: "broadband",
    title: "Static IP address explained for UK small businesses — OCCTA",
    metaDescription:
      "What a static public IP address is, when a small business may need one, common use cases, security limits and questions to ask before ordering.",
    h1: "What is a static IP address, and does your business need one?",
    shortAnswer:
      "A static public IP is an internet-facing address that normally stays the same. It can help with allow-listing, selected VPN or hosted-service designs, but most small businesses do not need one and it does not make a connection secure on its own.",
    intro:
      "IP address terminology is easy to overcomplicate. The useful question is not whether static sounds more professional, but whether a system you operate or a trusted IT supplier genuinely needs a predictable public address.",
    sections: [
      {
        heading: "Dynamic and static public IP addresses",
        body:
          "A dynamic public IP can change when the provider renews the connection or network lease. A static public IP is assigned so that the public address normally remains consistent. Devices inside the premises still use private local addresses supplied by the router; the public address is what internet services see.",
      },
      {
        heading: "Common reasons a business may request one",
        body:
          "Typical uses include allowing access only from an approved office address, connecting certain site-to-site VPNs, reaching an on-premises service, managing specialist equipment or meeting a supplier's network rule. Modern cloud services often avoid this requirement through identity-based access, managed gateways or outbound connections.",
      },
      {
        heading: "What a static IP does not do",
        body:
          "A fixed address is not encryption, a firewall, antivirus or authentication. Because it is predictable, poorly secured services exposed on it can be easier to revisit. Any internet-facing service should be deliberately configured, patched, monitored and protected with strong authentication.",
      },
      {
        heading: "Questions for your IT supplier",
        body:
          "Ask which exact application needs the address, whether IPv4 or IPv6 is required, whether one address or a routed block is needed, what ports must be exposed, who will maintain the firewall and whether a safer managed or cloud-based design is available.",
      },
      {
        heading: "Questions for the broadband provider",
        body:
          "Confirm whether a static IP is available on the selected product, whether it is included or chargeable, when it becomes active, whether it changes after a move or product migration and what support information will be supplied. Availability should be confirmed before relying on it in a technical design.",
      },
      {
        heading: "A sensible default for most small firms",
        body:
          "Do not add a static IP without a defined requirement. Start with secure cloud applications, multi-factor authentication and a properly configured router. Add a static address only where the business case and security ownership are clear.",
      },
    ],
    faqs: [
      {
        question: "Does a static IP make broadband faster?",
        answer:
          "No. It changes address assignment, not the physical line speed, latency or Wi-Fi performance.",
      },
      {
        question: "Is a static IP safer than a dynamic IP?",
        answer:
          "Not by itself. Security depends on firewall rules, patching, encryption, authentication and how exposed services are managed.",
      },
      {
        question: "Do I need a static IP for remote working?",
        answer:
          "Usually not. Most modern cloud tools and remote-access platforms work without one. Some VPN or allow-listing designs may require it, so check with the person responsible for your IT.",
      },
      {
        question: "Can a static IP be added later?",
        answer:
          "Often it can, but this depends on the provider and product. Confirm whether adding it causes a brief reconnect or configuration change.",
      },
    ],
    related: [
      BUSINESS,
      BUSINESS_QUOTE,
      { label: "Small business broadband guide", to: "/learn/small-business-broadband-guide" },
      { label: "Business broadband backup", to: "/learn/business-broadband-backup-guide" },
    ],
    keywords:
      "static IP address UK, static IP business broadband, do I need a static IP, fixed IP small business, public IP explained",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Ofcom communications jargon buster", url: OFCOM_JARGON },
      { label: "NCSC: prepare for incidents and identify critical systems", url: NCSC_PREPARE },
    ],
  },
  {
    slug: "business-broadband-backup-guide",
    category: "broadband",
    title: "Business broadband backup and failover guide — OCCTA",
    metaDescription:
      "How UK small businesses can plan internet backup using 4G, 5G or a second fixed connection, with practical failover and testing steps.",
    h1: "Business broadband backup: how to stay operational during an outage",
    shortAnswer:
      "A useful backup connection must be independent enough, sized for essential work and tested regularly. Decide what must keep running, choose mobile or fixed failover, document the switch process and confirm staff can operate with reduced capacity.",
    intro:
      "Backup broadband is not simply a second router in a cupboard. It is a continuity arrangement covering the connection, power, equipment, people and reduced-service procedures that keep the most important parts of the business working.",
    sections: [
      {
        heading: "Identify the minimum viable operation",
        body:
          "List the systems that must continue during an outage and rank them. Card payments, cloud telephony, order processing and access to customer records may be essential; guest Wi-Fi, large downloads and software updates may be paused. This gives you the capacity and configuration the backup actually needs.",
      },
      {
        heading: "Choose the backup route",
        body:
          "A 4G or 5G service is quick to deploy and may use different infrastructure from the fixed line. A second fixed connection can provide more capacity, but resilience is limited if both services share the same duct, pole, cabinet, building entry point or wholesale network. Ask how independent the routes really are.",
      },
      {
        heading: "Automatic failover versus manual switching",
        body:
          "A compatible router can monitor the primary line and switch traffic automatically. Manual failover costs less but depends on someone being present, knowing the steps and having access to passwords and cables. Whichever method you choose, document how to return safely to the main connection.",
      },
      {
        heading: "Keep the backup secure",
        body:
          "Use supported equipment, change default administrator credentials, keep firmware current and apply the same access controls used on the main network. Do not expose internal systems merely to make emergency access convenient. Restrict guest traffic and non-essential devices while running on limited mobile data.",
      },
      {
        heading: "Plan for power and voice",
        body:
          "Routers, ONTs, switches, cordless phones and Wi-Fi access points need electricity. A short-duration uninterruptible power supply can keep essential equipment running through brief power interruptions. Check how internet-based calls and emergency contact procedures work when the primary service or mains power is unavailable.",
      },
      {
        heading: "Test the complete process",
        body:
          "Disconnect the primary service during a planned test, confirm essential applications work, check call routing and card terminals, measure mobile signal where the backup device will sit and record any manual steps. Repeat tests after equipment, passwords or business systems change.",
      },
      {
        heading: "Keep data backups separate from connection backup",
        body:
          "Internet failover helps you reach cloud systems; it does not replace backups of essential data. The NCSC recommends keeping copies of the data an organisation needs to operate and checking that those copies can be restored.",
      },
    ],
    faqs: [
      {
        question: "Is a mobile hotspot enough as business backup?",
        answer:
          "It may be enough for a very small team and a few essential tasks. A managed router with a dedicated 4G or 5G connection is normally easier to control, test and share across business devices.",
      },
      {
        question: "Will 5G backup always be faster than 4G?",
        answer:
          "No. Performance depends on local coverage, building construction, network load, antenna placement and the device. Test at the actual premises rather than relying only on a coverage map.",
      },
      {
        question: "Can two fixed broadband lines still fail together?",
        answer:
          "Yes. They may share physical routes, exchange infrastructure, power or a wholesale network. Ask about route diversity when the business requires stronger resilience.",
      },
      {
        question: "How often should failover be tested?",
        answer:
          "Test on a planned schedule and after material changes. The right frequency depends on the impact of downtime, but an untested backup should not be treated as dependable.",
      },
    ],
    related: [
      BUSINESS,
      BUSINESS_QUOTE,
      { label: "Small business broadband checklist", to: "/learn/small-business-broadband-guide" },
      { label: "Full fibre for small businesses", to: "/learn/full-fibre-for-small-business" },
    ],
    keywords:
      "business broadband backup, 4G failover UK, 5G backup internet, business continuity broadband, backup internet small business",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "NCSC: prepare for incidents", url: NCSC_PREPARE },
      { label: "NCSC: backing up your data", url: NCSC_BACKUPS },
    ],
  },
  {
    slug: "full-fibre-for-small-business",
    category: "broadband",
    title: "Full fibre for small businesses: benefits and checks — OCCTA",
    metaDescription:
      "A UK small business guide to FTTP: reliability, upload needs, installation, resilience, contract questions and what to verify at the premises.",
    h1: "Is full-fibre broadband right for your small business?",
    shortAnswer:
      "FTTP runs fibre to the premises instead of relying on the final copper section used by FTTC. It can provide higher capacity and more consistent line performance, but the right product still depends on upload needs, support, resilience and availability at the exact address.",
    intro:
      "Full fibre is a connection technology, not a complete business continuity plan. It can be an excellent foundation, but businesses should still compare the full service specification and prepare for equipment, power or wider network failures.",
    sections: [
      {
        heading: "What full fibre changes",
        body:
          "Fibre-to-the-Premises connects the Openreach fibre network to an Optical Network Terminal inside the property. The router connects to that ONT. Unlike FTTC, the final access section is not carried over the traditional copper telephone pair.",
      },
      {
        heading: "Where businesses usually notice the difference",
        body:
          "Higher-capacity packages can reduce large download and upload times, support more simultaneous cloud applications and give teams more headroom for video meetings and hosted services. Actual benefits depend on the selected package, internal network and Wi-Fi—not simply on the word fibre.",
      },
      {
        heading: "Upload capacity deserves its own check",
        body:
          "Businesses sending design files, synchronising cloud storage, backing up data or running multiple video calls should compare estimated upload speeds. Two products with similar download marketing can have meaningfully different upload performance.",
      },
      {
        heading: "Plan the installation location",
        body:
          "An engineer normally installs an ONT inside the premises and connects it to the external fibre route. Choose a position near power, the router and any structured cabling. Openreach says most installations take around two to four hours, although property access or blocked ducts can extend the work.",
      },
      {
        heading: "Check landlord and site access requirements",
        body:
          "A person over 18 may need to provide access and agree the equipment location. Rented or managed premises may require permission for drilling, cabling or an external box. Confirm building access, parking, reception procedures and any restricted working hours before the appointment.",
      },
      {
        heading: "Do not forget resilience",
        body:
          "The ONT, router and network equipment need power. A fibre service can also be affected by damaged cables, upstream faults or provider systems. Businesses that cannot tolerate downtime should consider failover, power protection and documented manual procedures.",
      },
      {
        heading: "Confirm the commercial and support terms",
        body:
          "Compare estimated speeds, minimum term, setup work, equipment, support availability, fault handling, moving-premises terms and any static IP requirement. The final choice should be based on the written order and contract information for the specific address.",
      },
    ],
    faqs: [
      {
        question: "Is FTTP the same as leased line service?",
        answer:
          "No. FTTP is a shared broadband access technology. A leased line is a different business connectivity product, usually with dedicated capacity and different service terms.",
      },
      {
        question: "Does full fibre work during a power cut?",
        answer:
          "The ONT, router and local network need power. Without suitable backup power, connected devices and internet-based voice services will normally stop even if the fibre cable itself is intact.",
      },
      {
        question: "Will full fibre improve office Wi-Fi?",
        answer:
          "It improves the connection delivered to the premises, but Wi-Fi still depends on access-point placement, building materials, interference, device capability and the internal network.",
      },
      {
        question: "How do I know whether FTTP is available?",
        answer:
          "Run an address-level availability check. Results can differ between neighbouring premises, and the provider must confirm the product that can actually be ordered.",
      },
    ],
    related: [
      BUSINESS,
      BUSINESS_QUOTE,
      { label: "What to expect during FTTP installation", to: "/learn/fttp-installation-what-to-expect" },
      { label: "What is an ONT?", to: "/learn/what-is-an-ont" },
    ],
    keywords:
      "full fibre small business UK, FTTP business broadband, fibre broadband for business, small office full fibre, business FTTP",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Openreach: how Full Fibre is installed", url: OPENREACH_INSTALL },
      { label: "Ofcom: broadband speeds—what you need to know", url: OFCOM_SPEEDS },
    ],
  },
  {
    slug: "fttp-installation-what-to-expect",
    category: "broadband",
    title: "FTTP installation: what to expect on the day — OCCTA",
    metaDescription:
      "A practical UK FTTP installation guide covering engineer access, external fibre, the ONT, router position, landlord permission and appointment preparation.",
    h1: "FTTP installation: what happens and how should you prepare?",
    shortAnswer:
      "An engineer normally brings fibre from the external network to a small Optical Network Terminal inside the property, then connects the router. Prepare access, power and an agreed equipment position; most straightforward Openreach installations take about two to four hours.",
    intro:
      "A little preparation can prevent delays and leave the equipment in a better position for reliable Wi-Fi and cabling. The exact work depends on whether fibre and suitable ducting already reach the property.",
    sections: [
      {
        heading: "Before the appointment",
        body:
          "Confirm the date, contact number and whether an adult must be present throughout. Clear access to the likely cable route and the preferred equipment location. If the property is rented or managed, obtain any permission needed for drilling, external cabling or a new wall-mounted box.",
      },
      {
        heading: "External work",
        body:
          "The fibre may arrive through an underground duct or from a pole. An engineer may fit or use an external connection point on the property. Some external work can be completed before the main appointment; difficult access or a blocked duct may require additional work.",
      },
      {
        heading: "The cable entry point",
        body:
          "The engineer will agree where the fibre enters. Openreach guidance notes that drilling may be required. Think about the route before the visit: the shortest route is not always the best location for the router, office network or future furniture.",
      },
      {
        heading: "The ONT inside the property",
        body:
          "The Optical Network Terminal is the powered unit where the fibre service enters the premises. It should be near a mains socket and somewhere dry, ventilated and accessible. The router connects to the ONT using Ethernet.",
      },
      {
        heading: "Router and Wi-Fi position",
        body:
          "The ONT and router do not have to provide perfect Wi-Fi coverage from the same corner. Where possible, place the router centrally or use Ethernet cabling and additional access points. Avoid hiding networking equipment inside metal cabinets or behind large appliances.",
      },
      {
        heading: "Testing before the engineer leaves",
        body:
          "Confirm the ONT status, router connection and service activation. Test with Ethernet where practical, then check Wi-Fi in the areas that matter. Keep the provider's order details and report any activation issue to the provider, because Openreach does not manage the retail account.",
      },
      {
        heading: "When installation takes longer",
        body:
          "Openreach says most installations take between two and four hours, but blocked ducts, access constraints or extra external work can extend the process. Your provider should communicate revised appointments or next steps if the service cannot be completed on the first visit.",
      },
    ],
    faqs: [
      {
        question: "Do I need to be at home for an FTTP installation?",
        answer:
          "For an installation needing internal access, an adult normally needs to be present to provide access and agree where equipment is fitted.",
      },
      {
        question: "Will the engineer drill through the wall?",
        answer:
          "Drilling may be needed to bring the fibre from the external connection point to the ONT. Agree the position before work starts and obtain landlord permission where required.",
      },
      {
        question: "Can I choose where the ONT goes?",
        answer:
          "You can discuss the position with the engineer, subject to a safe and practical cable route, power availability and installation rules.",
      },
      {
        question: "Who should I contact if the appointment changes?",
        answer:
          "Contact your broadband provider. The provider manages the retail order and liaises with Openreach where Openreach infrastructure is involved.",
      },
    ],
    related: [
      CHECK,
      BROADBAND,
      { label: "What is an ONT?", to: "/learn/what-is-an-ont" },
      { label: "Full fibre for small businesses", to: "/learn/full-fibre-for-small-business" },
    ],
    keywords:
      "FTTP installation UK, full fibre installation what to expect, Openreach engineer appointment, ONT installation, fibre installation guide",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Openreach: how Full Fibre is installed", url: OPENREACH_INSTALL },
      { label: "Openreach Full Fibre installation checklist", url: OPENREACH_CHECKLIST },
    ],
  },
  {
    slug: "what-is-an-ont",
    category: "broadband",
    title: "What is an ONT? Full-fibre equipment explained — OCCTA",
    metaDescription:
      "Learn what an Optical Network Terminal does, how it connects to an FTTP router, what its lights mean broadly and where it should be installed.",
    h1: "What is an ONT on a full-fibre connection?",
    shortAnswer:
      "An ONT, or Optical Network Terminal, is the powered box inside an FTTP property that converts the fibre signal into an Ethernet connection for the router. It is part of the access connection and should normally remain powered and connected.",
    intro:
      "The ONT is often mistaken for the router, but the two devices have different jobs. Understanding that difference makes installation planning and fault checks much easier.",
    sections: [
      {
        heading: "The ONT's job",
        body:
          "Fibre carries information as light. The ONT terminates the incoming fibre and presents a network connection that the broadband router can use. It also reports status to the access network. The retail provider supplies or specifies the router that creates the local wired and Wi-Fi network.",
      },
      {
        heading: "How the equipment connects",
        body:
          "The incoming fibre connects to the ONT. An Ethernet cable runs from the ONT's data port to the router's WAN or internet port. Both devices need power. Additional switches, access points or mesh units connect on the router side of the network.",
      },
      {
        heading: "Where the ONT should be fitted",
        body:
          "Choose a dry, accessible place near a mains socket and a practical fibre route. Consider how Ethernet will reach the router or office network. Avoid positions likely to be blocked by furniture, exposed to moisture or repeatedly unplugged.",
      },
      {
        heading: "ONT lights and basic checks",
        body:
          "Labels vary by ONT model, but indicators commonly cover power, optical connection and Ethernet activity. Do not stare into or disconnect the fibre connector. If service fails, note the light pattern, check power and Ethernet, restart only as directed and give the provider the observed status.",
      },
      {
        heading: "ONT versus router",
        body:
          "The ONT connects the property to the fibre network. The router authenticates or establishes the retail internet service and distributes it to devices. Replacing a router does not normally replace the ONT, and moving the ONT usually requires an engineer.",
      },
      {
        heading: "Power cuts and backup",
        body:
          "The ONT requires electricity. If the ONT or router loses power, broadband and internet-based voice services normally stop. Customers who rely on connectivity for safety, care or business-critical use should discuss resilience and power-backup needs with their provider.",
      },
    ],
    faqs: [
      {
        question: "Can I plug a computer directly into the ONT?",
        answer:
          "The physical cable may fit, but most services are designed to use the provider's router or a correctly configured compatible router. Direct connection may not authenticate, protect or distribute the service properly.",
      },
      {
        question: "Can I move the ONT myself?",
        answer:
          "Do not move or alter the fibre termination yourself. Fibre is delicate and the installed location is part of the network setup. Ask the provider whether an engineer visit is required.",
      },
      {
        question: "Should the ONT stay switched on?",
        answer:
          "Yes, normally. Turning it off disconnects the fibre service and can prevent broadband and digital voice from working.",
      },
      {
        question: "Is the ONT the Wi-Fi router?",
        answer:
          "No. The ONT terminates the fibre. The router creates the local network and Wi-Fi connection used by your devices.",
      },
    ],
    related: [
      { label: "FTTP installation guide", to: "/learn/fttp-installation-what-to-expect" },
      { label: "What is FTTP?", to: "/learn/what-is-fttp" },
      { label: "Router buying guide", to: "/learn/router-buying-guide" },
      CHECK,
    ],
    keywords:
      "what is an ONT, optical network terminal explained, FTTP ONT box, fibre broadband equipment, ONT vs router",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Openreach Full Fibre installation checklist", url: OPENREACH_CHECKLIST },
      { label: "Openreach: how Full Fibre is installed", url: OPENREACH_INSTALL },
    ],
  },
  {
    slug: "upload-speed-explained",
    category: "broadband",
    title: "Upload speed explained: how much do you need? — OCCTA",
    metaDescription:
      "A plain-English UK guide to broadband upload speed for video calls, cloud backups, file sharing, CCTV, gaming and small business use.",
    h1: "Upload speed explained: why it matters and how much you need",
    shortAnswer:
      "Upload speed controls how quickly your connection sends data. It matters for video calls, cloud backups, large file transfers, live streaming, remote CCTV and hosted services. Compare the estimated upload figure—not only the advertised download speed.",
    intro:
      "Broadband advertising usually leads with download speed, but many modern tasks send data continuously. A connection can feel fine for streaming and still struggle when several people join video meetings or a large cloud backup starts.",
    sections: [
      {
        heading: "Download and upload are different directions",
        body:
          "Downloading brings data to you: web pages, films, software and incoming files. Uploading sends data away from you: your camera feed in a video meeting, attachments, cloud synchronisation, online backups and live broadcasts. Most consumer packages are asymmetrical, meaning upload is lower than download.",
      },
      {
        heading: "Everyday tasks that use upload capacity",
        body:
          "Video calls, sending photos and documents, online gaming traffic, smart doorbells, CCTV viewed remotely, cloud storage and phone backups all send data. One task may use little capacity, but several simultaneous tasks can compete and cause frozen calls or slow transfers.",
      },
      {
        heading: "Small business and home-office use",
        body:
          "Teams working with shared cloud drives, design files, off-site backups or multiple video calls should treat upload as a core requirement. Ask for estimated upload speed at the address and consider whether the connection remains suitable during the provider's stated business busy period.",
      },
      {
        heading: "Why latency and stability still matter",
        body:
          "A high upload headline does not compensate for packet loss, unstable Wi-Fi or excessive latency. Real-time calls need data to arrive consistently. Test using Ethernet to separate the broadband line from Wi-Fi limitations, and pause large backups when diagnosing a call-quality problem.",
      },
      {
        heading: "How to test upload speed properly",
        body:
          "Connect a capable device to the router by Ethernet, close heavy applications, stop VPNs if permitted and run more than one reputable test at different times. Compare results with the personalised information supplied for the service. Wi-Fi tests are useful for user experience but do not isolate line performance.",
      },
      {
        heading: "Choosing a package",
        body:
          "Estimate simultaneous activity rather than chasing a single number. A household making occasional video calls needs less than a studio uploading media all day. Check download, upload, minimum or guaranteed information, technology, internal network and support together.",
      },
    ],
    faqs: [
      {
        question: "What upload speed do I need for video calls?",
        answer:
          "The requirement varies by platform, quality and number of simultaneous calls. Leave headroom for other users and cloud activity instead of sizing the line to one call's minimum figure.",
      },
      {
        question: "Why is my upload much slower than my download?",
        answer:
          "Many broadband products are designed asymmetrically because typical residential use historically consumed more data than it sent. The available ratio depends on the access technology and package.",
      },
      {
        question: "Does faster upload improve gaming?",
        answer:
          "Games usually need modest bandwidth but benefit from low latency, low packet loss and stability. Upload congestion elsewhere on the network can still increase lag.",
      },
      {
        question: "Can Wi-Fi reduce upload speed?",
        answer:
          "Yes. Distance, interference, walls, device capability and router placement can reduce performance in either direction. Test by Ethernet when checking the broadband service itself.",
      },
    ],
    related: [
      { label: "Broadband speed guide", to: "/learn/broadband-speed-guide" },
      { label: "Wi-Fi versus broadband", to: "/learn/wifi-vs-broadband" },
      { label: "Full fibre for small businesses", to: "/learn/full-fibre-for-small-business" },
      CHECK,
    ],
    keywords:
      "upload speed explained, broadband upload speed UK, upload speed for video calls, business upload speed, how much upload speed do I need",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Ofcom: broadband speeds—what you need to know", url: OFCOM_SPEEDS },
      { label: "Ofcom: latest home broadband performance trends", url: "https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/latest-home-broadband-performance-trends-revealed" },
    ],
  },
  {
    slug: "wifi-calling-explained",
    category: "sim",
    title: "Wi-Fi Calling explained: calls over broadband — OCCTA",
    metaDescription:
      "Learn how Wi-Fi Calling works, when it helps indoor mobile coverage, what you need, how emergency calls and roaming may differ, and basic fixes.",
    h1: "What is Wi-Fi Calling and when should you use it?",
    shortAnswer:
      "Wi-Fi Calling lets a compatible phone and mobile service carry normal calls and texts through a Wi-Fi internet connection when mobile signal is weak. It usually uses the phone's normal dialler and number, but support and charging rules depend on the network and plan.",
    intro:
      "Wi-Fi Calling can improve coverage inside buildings where walls or location weaken the mobile signal. It is different from calling through WhatsApp or another app because it is integrated with the mobile service.",
    sections: [
      {
        heading: "How Wi-Fi Calling works",
        body:
          "The phone securely connects to the mobile network through the internet connection provided by the Wi-Fi network. You normally make and receive calls using the standard phone app and existing mobile number. The device and mobile account must both support the feature.",
      },
      {
        heading: "When it is useful",
        body:
          "It can help in basements, rural properties, thick-walled buildings and offices where indoor mobile coverage is poor but broadband and Wi-Fi are reliable. It does not improve the outdoor mobile network; it provides another route while the phone is connected to suitable Wi-Fi.",
      },
      {
        heading: "What you need",
        body:
          "You need a compatible handset, current software, a mobile plan with Wi-Fi Calling enabled and a stable internet connection. Some phones show a Wi-Fi Calling indicator. Settings may be under Mobile Network, SIM or Phone options depending on the manufacturer.",
      },
      {
        heading: "Call quality depends on the Wi-Fi connection",
        body:
          "Congested Wi-Fi, weak coverage, packet loss or a busy upload link can cause broken audio. Move closer to the access point, stop heavy transfers and test another Wi-Fi network. Business networks may need firewall settings that permit the service.",
      },
      {
        heading: "Emergency calls and location",
        body:
          "Emergency-call behaviour and location handling can differ by network, device and country. Keep the handset's software, emergency address or location settings current where the service asks for them. Do not rely on Wi-Fi Calling as the only emergency communication method during a broadband or power failure.",
      },
      {
        heading: "Roaming and charges",
        body:
          "Do not assume a Wi-Fi connection makes every call free or domestic. Charging and availability abroad depend on the mobile provider and plan. Check the provider's current Wi-Fi Calling and roaming terms before travelling or making international calls.",
      },
      {
        heading: "Basic troubleshooting",
        body:
          "Confirm the feature is enabled, restart the phone, install software updates, reconnect to Wi-Fi and check whether ordinary internet access works. If the indicator never appears, confirm handset compatibility and account provisioning with the mobile provider.",
      },
    ],
    faqs: [
      {
        question: "Is Wi-Fi Calling the same as WhatsApp calling?",
        answer:
          "No. Wi-Fi Calling is integrated with the mobile network and normally uses the standard dialler and mobile number. App calls use the app's own account and service.",
      },
      {
        question: "Does Wi-Fi Calling use mobile data?",
        answer:
          "While connected through Wi-Fi, the call uses the internet connection behind that Wi-Fi network rather than the local mobile radio path. Provider rules still determine how the call is billed.",
      },
      {
        question: "Will Wi-Fi Calling work during a power cut?",
        answer:
          "Only if the broadband equipment and Wi-Fi network still have power and internet access. Mobile signal may be a separate fallback where available.",
      },
      {
        question: "Why does Wi-Fi Calling keep dropping?",
        answer:
          "Weak or congested Wi-Fi, movement between access points, broadband instability or device settings can interrupt it. Test close to the router and remove other heavy network activity.",
      },
    ],
    related: [
      SIM,
      { label: "eSIM versus physical SIM", to: "/learn/esim-vs-physical-sim" },
      { label: "Upload speed explained", to: "/learn/upload-speed-explained" },
      { label: "Mesh Wi-Fi guide", to: "/learn/mesh-wifi-guide" },
    ],
    keywords:
      "Wi-Fi Calling explained UK, what is WiFi calling, calls over broadband, improve indoor mobile signal, WiFi calling troubleshooting",
    authorName: "OCCTA Telecom Team",
    reviewedBy: "OCCTA Compliance and Product Team",
    datePublished: "2026-08-06",
    dateModified: "2026-08-06",
    sources: [
      { label: "Ofcom communications jargon buster", url: OFCOM_JARGON },
      { label: "Ofcom: get more from your broadband", url: "https://www.ofcom.org.uk/phones-and-broadband/saving-money/get-more-from-your-broadband" },
    ],
  },
];

export const getSeoArticleBySlug = (slug: string): SeoArticle | undefined =>
  seoArticles.find((article) => article.slug === slug);
