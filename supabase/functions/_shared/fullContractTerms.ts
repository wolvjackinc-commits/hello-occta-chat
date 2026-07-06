// OCCTA Full Contract Summary — comprehensive, multi-million-dollar-telecom-style
// content used in BOTH the on-screen Contract Summary and the downloadable PDF.
//
// Mirror this file at: supabase/functions/_shared/fullContractTerms.ts
// If you change one, change the other. Bump FULL_CONTRACT_TERMS_VERSION.

export const FULL_CONTRACT_TERMS_VERSION = "2026-06-a";

export type ContractSection = {
  heading: string;
  // Each paragraph is rendered as its own block. Use "• " prefix for bullets.
  paragraphs: string[];
};

export const FULL_CONTRACT_SECTIONS: ContractSection[] = [
  {
    heading: "1. About this agreement",
    paragraphs: [
      "This Contract Summary, together with the OCCTA Terms of Service, Acceptable Use Policy, Privacy Policy, Code of Practice, Complaints Code, Switching Policy, Vulnerable Customers Policy, Price Transparency document and any service-specific schedules (the \"Agreement\"), forms the legally binding contract between OCCTA LIMITED (\"OCCTA\", \"we\", \"us\", \"our\") and you (\"the customer\", \"you\", \"your\") for the supply of the communications services described above.",
      "OCCTA LIMITED is a company registered in England & Wales. Our registered office, company number and VAT registration number are published at www.occta.co.uk and on every VAT invoice we issue. Our regulated activities as a Communications Provider are subject to the Communications Act 2003 and the Ofcom General Conditions of Entitlement (in particular C1, C2, C4, C5, C7 and B1).",
      "This Contract Summary has been prepared in accordance with Ofcom General Condition C1.3 and the European Electronic Communications Code (EECC) implementing requirements. It is a faithful, accurate summary of the key terms of your contract. The full terms — which take precedence in case of any conflict with a non-material part of this summary — are published at www.occta.co.uk/legal and were provided to you before you completed your order.",
    ],
  },
  {
    heading: "2. The service we will provide",
    paragraphs: [
      "We will provide you with the service(s) described in the \"Plan\" and \"Speed Estimate\" sections above, delivered over the underlying access network identified during your address check (typically Openreach FTTC, SOGEA or FTTP, or in some cases CityFibre or another wholesale partner).",
      "Service activation is subject to a successful line check, a successful credit check (where applicable for post-pay services), the availability of the underlying network on your activation date, and your acceptance of this Agreement. If activation is not possible we will tell you in writing and refund any sums you have paid.",
      "Your service includes: (a) the broadband connection at the headline access type stated above; (b) a unique public IPv4 address (dynamically allocated unless a static IP add-on is purchased); (c) access to OCCTA's UK customer support; (d) an online account at occta.co.uk where you can manage billing, raise tickets, view invoices and download this Contract Summary; (e) any add-ons listed on your itemised order (router, Digital Voice, static IP, enhanced care, etc.).",
    ],
  },
  {
    heading: "3. Equipment, router and ownership",
    paragraphs: [
      "Where a router or other equipment is supplied by OCCTA it remains your property once delivered, unless your order expressly states the equipment is provided on loan. You are responsible for the safekeeping of equipment from the point of delivery.",
      "We will provide reasonable setup guidance and a pre-configured device where possible. You must not tamper with, modify, resell or use OCCTA-supplied equipment on another provider's network in a way that breaches that provider's terms.",
      "If equipment is faulty on arrival we will replace it free of charge within the manufacturer's warranty period. After that period, repair or replacement is chargeable at the rates published in our Price Transparency document.",
    ],
  },
  {
    heading: "4. Installation, activation & engineer visits",
    paragraphs: [
      "Where the underlying network requires an engineer visit (for example, an FTTP install, a new line install, or a fault that cannot be cleared remotely) we will book the appointment with you. You, or an adult aged 18 or over, must be present for the duration of the visit and provide safe access.",
      "Missed-appointment, no-access and abortive-visit charges may apply at the wholesale rates set by the access-network operator. These are passed through at cost and will be itemised on your next invoice; we will tell you the rate before you confirm an appointment date.",
      "Standard residential setup fees, where applicable, are shown in the \"One-off charges\" section above. SOGEA orders that subsequently require a new line install may incur additional Openreach charges; if this happens we will contact you with the exact figure and only proceed with your written approval.",
    ],
  },
  {
    heading: "5. Speeds, performance & remedies",
    paragraphs: [
      "The estimated download and upload speeds shown above are personalised to your address based on data from the access-network operator. They include a normal-range estimate and, where available, a minimum guaranteed speed. They are not a maximum theoretical figure.",
      "Real-world performance depends on factors outside our control: your in-home wiring, the router position, the device(s) being used, Wi-Fi interference, the number of concurrent users, the website or service you are connecting to, and the underlying network's contention at the time.",
      "If your achieved download speed remains below the minimum guaranteed speed for a continuous period of more than 30 days, after we have had a fair opportunity to diagnose and resolve the issue, you may exit the contract without penalty in line with Ofcom's Voluntary Code of Practice on Broadband Speeds, to which OCCTA voluntarily subscribes.",
    ],
  },
  {
    heading: "6. Price, VAT, billing & payment",
    paragraphs: [
      "Residential prices are quoted inclusive of VAT at the prevailing standard rate. Business prices are quoted exclusive of VAT; VAT is added on the invoice. The exact monthly price, any one-off charges and your billing cycle (monthly or quarterly) are shown above.",
      "Charges are taken in advance via the payment method you have set up (typically Direct Debit under the Direct Debit Guarantee, or card-on-file via Worldpay). One-off charges shown above are taken before service activation unless agreed otherwise in writing.",
      "If a Direct Debit or card payment fails we will retry once, notify you, and give you a reasonable opportunity to settle the invoice before any late-payment action. A late-payment fee of £5 applies after 7 days of non-payment; service may be suspended after 30 days of non-payment in line with our published policy. Reconnection after suspension is free, provided the outstanding balance is paid in full.",
      "All bank-transfer, manual and phone payments are receipted and reflected in your online account within one working day.",
    ],
  },
  {
    heading: "7. Price rises (OCCTA's no-CPI promise)",
    paragraphs: [
      "OCCTA does not apply automatic CPI, RPI or annual inflation-linked price rises to residential telecom services. This is a fundamental promise of our brand: \"Simple telecom. Clear terms. No mid-contract price hikes.\"",
      "If we ever need to change the recurring price you pay, we will tell you in writing at least 30 days in advance, explaining what is changing and why. You will then have the right to leave the affected service, without penalty and without any early-termination charge, at any time within that 30-day notice window. This right is consistent with Ofcom General Condition C1.6.",
      "Pass-through of changes that are entirely outside our control (for example, a statutory change in VAT) is not a price rise initiated by OCCTA and may apply to your next bill without the 30-day notice. Any such change will be itemised on the invoice and explained on your dashboard.",
    ],
  },
  {
    heading: "8. Contract length, renewal & how to leave",
    paragraphs: [
      "The contract length and notice period are shown above. Many OCCTA plans are sold as rolling 30-day or 1-month contracts with no minimum term; where a longer initial term applies it is explicitly stated above and was disclosed at checkout.",
      "At the end of any minimum term your service automatically continues on the same terms on a 30-day rolling basis. You may end the contract at any time after the minimum term by giving the notice period stated above through your dashboard, by email to support@occta.co.uk or by post.",
      "If you end the service during a minimum term (other than for a reason that gives you a right to leave without penalty — for example, a 30-day price-rise notice, a sustained failure to meet the minimum guaranteed speed, a material breach by us, or a statutory right under the Consumer Contracts Regulations 2013), an Early Termination Charge equal to the remaining monthly charges of the minimum term may apply. The exact figure is shown in the \"Cease / Cancellation\" section above and is calculated in line with Ofcom guidance on fair ETCs.",
    ],
  },
  {
    heading: "9. 14-day cooling-off (Consumer Contracts Regulations 2013)",
    paragraphs: [
      "Because this contract was concluded at a distance (online, by phone or off-premises) you have a statutory right to cancel within 14 calendar days of accepting this Contract Summary, without giving any reason.",
      "If you ask us to begin the service inside the cooling-off period and then exercise your right to cancel, you must pay a fair pro-rata charge for the service actually supplied up to the date you tell us you want to cancel, plus any third-party engineer or installation costs that have already been incurred and cannot be avoided.",
      "To exercise your right to cancel, contact support@occta.co.uk or write to OCCTA LIMITED at the registered office address. A model cancellation form is published at www.occta.co.uk/legal/cooling-off.",
    ],
  },
  {
    heading: "10. Switching provider (One Touch Switch)",
    paragraphs: [
      "OCCTA is a signed-up participant in the industry One Touch Switch (OTS) process required by Ofcom General Condition C7.",
      "If you are switching to OCCTA from another provider, you do not need to contact your losing provider — we will manage the switch on your behalf and tell you the proposed switch-over date. If you are switching away from OCCTA to another provider, the gaining provider will manage the switch and we will release your service on the agreed date.",
      "We do not charge a notice-period fee that extends past the OTS switch date. If you have already paid in advance for service beyond the switch date, we will refund the unused portion within 30 days.",
    ],
  },
  {
    heading: "11. Digital Voice & emergency calls",
    paragraphs: [
      "If your service includes a digital phone line (Digital Voice / VoIP), please read this section carefully. Digital Voice works through your broadband connection and mains power supply. It may not work during a power cut, a broadband outage, or if the router is unplugged, unless a battery back-up unit (BBU) has been supplied and is correctly installed.",
      "If you, or anyone in your household, relies on the phone line for emergency calls, telecare or medical equipment (for example a pendant alarm, dialysis monitor or health alert pager) you must tell OCCTA before activating the service. We will assess the situation, may provide a free battery back-up unit, and may signpost you to an alternative service if Digital Voice is not appropriate. This is in line with the Ofcom protections for vulnerable customers and the industry commitments on Public Switched Telephone Network (PSTN) migration.",
      "999/112 emergency calls remain free and are routed using the location data we hold for your service address. You must keep this address up to date.",
    ],
  },
  {
    heading: "12. Acceptable use & lawful behaviour",
    paragraphs: [
      "You must use the service in accordance with our Acceptable Use Policy (published at www.occta.co.uk/legal/aup). You must not use the service to: send unsolicited bulk email; host or distribute malware; conduct denial-of-service attacks; infringe intellectual property rights; share child sexual abuse material; harass others; or breach any UK law.",
      "We may suspend or terminate the service, with appropriate notice where possible, if we reasonably believe you are in serious or persistent breach of the AUP, or if we are required to do so by a competent court, regulator or law-enforcement authority (including under the Investigatory Powers Act 2016).",
      "We do not actively monitor the content of your traffic. We do collect and process network telemetry necessary to operate, secure and bill the service, as described in our Privacy Policy.",
    ],
  },
  {
    heading: "13. Network management, traffic & quality of service",
    paragraphs: [
      "OCCTA operates on an open-internet basis consistent with the EU Open Internet Regulation 2015/2120 as retained in UK law and Ofcom's enforcement guidance.",
      "We may take reasonable and proportionate network-management measures to: respond to a security incident; comply with a court order; prevent congestion that would degrade service for other customers; or honour a customer-elected option (for example, a parental-control filter). We do not throttle specific lawful services, applications or content based on commercial considerations.",
      "Planned maintenance windows are published at www.occta.co.uk/status. Major unplanned incidents are tracked on the same page with a public post-incident summary.",
    ],
  },
  {
    heading: "14. Faults, support & service credits",
    paragraphs: [
      "If you experience a fault, raise a ticket in your dashboard or call/email OCCTA support. Our standard UK support hours are 09:00–18:00 Monday to Friday and 10:00–16:00 Saturdays (excluding English bank holidays). Critical-impact incidents are monitored 24/7 by our on-call team.",
      "Care levels (Standard, Priority, Enhanced) determine our target fix-time SLAs and any service-credit entitlement. The care level applicable to your service is shown in the \"Plan\" section above and on each invoice.",
      "Where a confirmed fault on OCCTA's side, or on the underlying access network, exceeds the published SLA, we will credit your account in line with our published Compensation Scheme (which meets or exceeds the Ofcom Automatic Compensation Scheme thresholds for total loss of service, delayed repair after total loss of service, missed appointments, and delayed provision).",
    ],
  },
  {
    heading: "15. Suspension, restriction & termination by OCCTA",
    paragraphs: [
      "We may suspend, restrict or terminate the service if: (a) you fail to pay an undisputed invoice within 30 days of its due date, following our published reminder process; (b) you are in material or persistent breach of this Agreement or the AUP; (c) we are instructed to do so by a court, regulator or law-enforcement authority; (d) we reasonably believe the service is being used fraudulently or in a way that endangers the network or other users; or (e) the access-network operator withdraws the underlying product.",
      "Wherever possible we will give you reasonable advance notice and a chance to put things right. We will not suspend service for a disputed amount while the dispute is being investigated in good faith.",
      "If we terminate the contract for your serious breach we may recover the remainder of the minimum-term charges as a debt; if we terminate for our own convenience or because the access network is withdrawn we will not charge an ETC and will help you switch provider.",
    ],
  },
  {
    heading: "16. Liability — what we are and aren't responsible for",
    paragraphs: [
      "Nothing in this Agreement limits or excludes our liability for: (a) death or personal injury caused by our negligence; (b) fraud or fraudulent misrepresentation; (c) any liability that cannot be limited or excluded by UK law (including under the Consumer Rights Act 2015).",
      "Subject to that, our total aggregate liability to you arising out of or in connection with the service in any 12-month period is limited to the total charges you have paid OCCTA for that service in that 12-month period. We are not liable for indirect or consequential losses, loss of profit, loss of business, loss of data (other than where we have failed to take reasonable security measures), or losses caused by events outside our reasonable control.",
      "We will not be in breach of this Agreement, and not liable for any failure or delay in performing it, due to a Force Majeure Event — including (without limitation) acts of God, war, terrorism, riot, fire, flood, pandemic, government action, industry-wide industrial action, or failure of a third-party network or utility. Where a Force Majeure Event lasts more than 30 consecutive days you may terminate the affected service free of charge.",
    ],
  },
  {
    heading: "17. Data protection, privacy & lawful interception",
    paragraphs: [
      "OCCTA is the data controller for the personal data you provide to take and use our services. We process personal data in accordance with the UK GDPR, the Data Protection Act 2018 and the Privacy and Electronic Communications Regulations (PECR). Our full Privacy Policy at www.occta.co.uk/privacy describes what we collect, why, the lawful basis, retention periods, your rights and how to contact our Data Protection contact.",
      "We retain billing records for at least 6 years to meet HMRC and accounting obligations; service-usage telemetry is retained for the minimum period required to operate the network securely; and tickets and complaint correspondence are retained for at least 2 years from closure. After the applicable retention period your personal data is deleted or anonymised in accordance with our published Data Retention Schedule.",
      "We may be required, under the Investigatory Powers Act 2016, to disclose specific traffic data, subscriber data or content to a designated authority under a lawful warrant or authorisation. We will only do so where we are legally obliged to, and we publish an annual transparency report describing the number and type of requests received.",
    ],
  },
  {
    heading: "18. Vulnerable customers & accessibility",
    paragraphs: [
      "We recognise that some customers, or members of their household, may be in a vulnerable situation — for reasons including health, age, disability, financial difficulty, bereavement or domestic abuse. Our Vulnerable Customers Policy (www.occta.co.uk/legal/vulnerable-customers) sets out the practical adjustments we will make, free of charge, including priority fault-fixing, nominated representatives, accessible bill formats and bespoke payment plans.",
      "Please tell us at any time — at sign-up, by ticket, or by calling support — if you would like us to record additional needs. We will treat this information confidentially and only use it to support you.",
      "We comply with our duties under the Equality Act 2010 to make reasonable adjustments. Bills and communications can be provided in large print, braille or by audio on request, free of charge.",
    ],
  },
  {
    heading: "19. Complaints, ADR & how to escalate",
    paragraphs: [
      "If something goes wrong, please raise a complaint in your dashboard, email complaints@occta.co.uk or write to the registered office. Our Complaints Code (www.occta.co.uk/legal/complaints-code) sets out our internal escalation, target response times and senior-management review steps.",
      "If we have not resolved your complaint within 6 weeks, or if we issue a deadlock letter sooner, you have the right — free of charge — to refer your complaint to our Alternative Dispute Resolution (ADR) provider: Ombudsman Services: Communications, P.O. Box 730, Warrington, WA4 6WU; phone 0330 440 1614; www.ombudsman-services.org/sectors/communications. The ADR decision is binding on OCCTA but not on you.",
      "You can also contact Ofcom (the industry regulator) at www.ofcom.org.uk for general information about your rights as a communications customer, though Ofcom does not handle individual disputes.",
    ],
  },
  {
    heading: "20. Changes to this Agreement",
    paragraphs: [
      "We may make changes to the non-price terms of this Agreement from time to time, for example to reflect changes in law, regulator guidance, security best-practice or how a service feature works. We will give you at least 30 days' written notice of any change that is materially detrimental to you. During that notice period you have the right to terminate the affected service without penalty.",
      "Minor administrative changes (typos, clarifications, contact-detail updates) take effect on publication without a separate notice.",
    ],
  },
  {
    heading: "21. Notices, assignment & general",
    paragraphs: [
      "Notices to OCCTA should be sent to support@occta.co.uk or to the registered office. Notices to you will be sent to the email address on your account; it is your responsibility to keep that email address current.",
      "You may not assign or transfer this Agreement without our prior written consent (not to be unreasonably withheld). We may assign or transfer it to a successor entity (for example, on a corporate reorganisation) provided your rights are not adversely affected.",
      "If any part of this Agreement is found by a court to be unenforceable, the rest will continue in full force and effect. A failure or delay by us to enforce a right is not a waiver of that right. No other person other than OCCTA and you has any rights under this Agreement (the Contracts (Rights of Third Parties) Act 1999 is excluded).",
      "This Agreement is governed by the laws of England & Wales and the courts of England & Wales have exclusive jurisdiction, save that nothing prevents you from bringing proceedings in the courts of the part of the UK in which you live as a consumer.",
    ],
  },
  {
    heading: "22. Your acceptance",
    paragraphs: [
      "By ticking the confirmation boxes and clicking \"Sign and enter into the agreement\" you confirm that: (a) you have read, downloaded and understood this Contract Summary and the documents it references; (b) the personal and service details shown above are correct; (c) you are at least 18 years old and have authority to enter into this Agreement; (d) you expressly consent to OCCTA supplying the service on the terms set out above; and (e) where you have asked us to begin the service inside the 14-day cooling-off period, you understand that a fair pro-rata charge applies if you then cancel.",
      "A signed PDF copy of this Contract Summary, plus a separate Acceptance Certificate evidencing the date, time, IP address and confirmation choices you made, will be stored against your account and emailed to you. You can re-download both at any time from your OCCTA dashboard.",
    ],
  },
];

export const FULL_CONTRACT_INTRO =
  "The sections below form your full Contract Summary — the legally-binding terms of your agreement with OCCTA, written in plain English under Ofcom General Condition C1.3, with nothing hidden in small print.";