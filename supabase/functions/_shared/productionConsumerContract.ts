// Canonical OCCTA production consumer contract clauses for server-side PDF generation.
// Keep aligned with src/lib/legal/contractInformation.ts.
// New consumer contracts only; historic accepted documents remain immutable.

export const PRODUCTION_CONTRACT_VERSION = "2026.10.1";
export type ProductionContractSection = { heading: string; paragraphs: string[] };

export const PRODUCTION_CONTRACT_SECTIONS: ProductionContractSection[] = [
  { heading: "Service activation and provisioning", paragraphs: [
    "We will provide the service shown in your Contract Summary subject to final network availability, address validation and necessary installation/provisioning work. A preferred/likely start date remains subject to network confirmation unless expressly confirmed as committed.",
    "If the ordered product cannot be supplied, OCCTA will not silently substitute a materially different product, technology, price or minimum term. We will explain the available alternative and obtain your agreement where a contractual change is required."
  ]},
  { heading: "Broadband technology, data allowance and performance", paragraphs: [
    "Your Contract Summary identifies the ordered service and available access technology, such as Full-fibre (FTTP) or Part-fibre (SOGEA/FTTC). An 'up to' figure is not a guaranteed speed unless expressly stated.",
    "Where the access network supplies contractual minimum, normally available, maximum and advertised download/upload figures, they are shown in the order documents. OCCTA will not invent missing network speed metrics.",
    "Unless your order says otherwise, standard residential fixed broadband has no monthly data-usage cap. Any service-specific fair-use or traffic-volume limit is disclosed before acceptance.",
    "Unless expressly stated, OCCTA does not promise a separate consumer SLA for latency, jitter or packet loss, but material quality faults will be investigated and mandatory remedies preserved."
  ]},
  { heading: "Traffic management", paragraphs: [
    "OCCTA does not intentionally block or throttle lawful applications or content for commercial reasons. Reasonable and proportionate measures may be used for security, legal compliance, network integrity or temporary/exceptional congestion.",
    "Such measures can temporarily affect throughput, latency or availability. Network/security telemetry and related personal data are processed as described in the Privacy Policy."
  ]},
  { heading: "Equipment and router", paragraphs: [
    "Your order states whether equipment is purchased, loaned, rented or not supplied. Purchased equipment becomes yours once paid for; loan/rental equipment remains OCCTA property unless agreed otherwise.",
    "Where return is required, follow our instructions and return the equipment within 14 days. Non-return/damage charges are applied only where fair, lawful and properly disclosed."
  ]},
  { heading: "Billing, payment and bill monitoring", paragraphs: [
    "Billing starts only after the service is confirmed live. Monthly subscription charges are then billed in advance on the agreed billing date; the first invoice may include agreed one-off charges and an applicable pro-rata amount.",
    "You can review invoices, payment status and available usage/itemisation through your account/dashboard or support. Direct Debit is treated as active only after the payment provider confirms the mandate.",
    "A £10 late-payment administration charge may be applied only after overdue notice and reasonable opportunity to pay, only where lawful and reflecting the administrative action taken. It is not repeatedly added to the same overdue invoice."
  ]},
  { heading: "Price changes", paragraphs: [
    "No scheduled CPI-, RPI-, inflation-linked or percentage-based price increase applies to this consumer agreement.",
    "Where a contractual modification gives you a regulatory or statutory right to leave without penalty, OCCTA will give the required notice on a durable medium and explain the right and deadline."
  ]},
  { heading: "Flex 30 and Price Lock 24", paragraphs: [
    "Flex 30 is a 30-day rolling service with no fixed minimum term and no remaining-month ETF. The normal notice period is 30 days, subject to applicable switching rules.",
    "Price Lock 24 has a 24-month minimum term from the service live date. After that it continues on a 30-day rolling basis unless you expressly agree a new fixed term.",
    "A valid Price Lock 24 ETF starts with remaining recurring broadband charges and deducts VAT no longer due and direct costs OCCTA reasonably avoids. It never exceeds the remaining recurring charges and does not double-recover the same loss.",
    "Buying equipment or adding a service/add-on does not by itself extend an existing minimum term."
  ]},
  { heading: "Network cease/migration charge", paragraphs: [
    "A network cease/migration charge is separate from an ETF and applies only where lawful and actually incurred by OCCTA. The customer charge is the actual qualifying cost incurred, capped at £114 incl. VAT within the first 12 months after go-live and £60 incl. VAT thereafter.",
    "It is not used to recreate a prohibited notice charge or defeat a statutory/regulatory penalty-free exit or switching right."
  ]},
  { heading: "Pre-live cancellation and cooling-off", paragraphs: [
    "For a consumer distance contract you normally have 14 calendar days from the day the contract is entered into to cancel without giving a reason.",
    "Where available, you may expressly request installation or supply during that period. If you then cancel, you may have to pay the lawful proportionate amount for service supplied and applicable installation work already carried out.",
    "If you cancel after the cooling-off period but before go-live, no recurring-service ETF arises merely because the service has not activated; only a properly disclosed, fair and legally recoverable network/order/installation cost actually incurred may be considered."
  ]},
  { heading: "Switching and number porting", paragraphs: [
    "Where One Touch Switch applies, providers coordinate the switch and subscription notice charges do not continue beyond the completed switch date where the rules prohibit them.",
    "Number porting is subject to technical availability and the applicable process. Where qualifying switching/porting delay or failure compensation is required, OCCTA will provide it or explain how it is obtained."
  ]},
  { heading: "Moving home", paragraphs: [
    "If the existing service can migrate without a new line, ONT, network installation or additional equipment/work, OCCTA will not charge a home-move migration fee.",
    "If new network work/equipment is needed, we will disclose the charge or calculation basis before it is ordered where reasonably possible. If OCCTA can provide the same or genuinely equivalent contracted service and you decline the properly disclosed work, that decision does not by itself remove an otherwise valid ETF/cease charge.",
    "A materially slower service, materially different technology, materially different price or other material change is not treated as equivalent without your express agreement. If OCCTA cannot reasonably provide the contracted/equivalent service, we will not impose an unfair penalty solely because you moved somewhere we cannot serve."
  ]},
  { heading: "Engineer visits", paragraphs: [
    "Where a charge can reasonably be known before an appointment or additional work, OCCTA will disclose the total price or calculation method before you agree.",
    "A later no-access, missed-appointment, abortive-visit or customer-caused fault charge is limited to the actual third-party/network charge OCCTA incurs where the basis was disclosed and the charge is fair and legally recoverable. No separate OCCTA engineer administration fee applies unless expressly disclosed before acceptance."
  ]},
  { heading: "Digital Voice and emergency calls", paragraphs: [
    "Digital Voice depends on broadband, compatible equipment and mains power and may not work during an outage. 999/112 calls are free when operational. Keep the service address current for emergency-location purposes.",
    "If you rely on the phone because of vulnerability, medical needs, telecare or poor mobile coverage, tell OCCTA so we can assess and discuss available resilience or alternative communication arrangements; where appropriate and available, suitable backup/resilience equipment or other support may be provided.",
    "Call allowances, out-of-bundle rates, premium/service-number charges and international rates are shown in the order or version-controlled OCCTA call tariff supplied/incorporated before acceptance."
  ]},
  { heading: "Faults, guarantees and after-sales support", paragraphs: [
    "Report faults through OCCTA support. Automatic compensation, service credits, commercial guarantees or a specific repair SLA apply only where required by law or expressly included in the order/service schedule. Statutory rights and applicable manufacturer warranties remain unaffected."
  ]},
  { heading: "Accessibility and vulnerability", paragraphs: [
    "Tell OCCTA about relevant communication, disability, health, financial or other support needs. We will consider reasonable adjustments, accessible communications and appropriate support arrangements, and handle vulnerability information in accordance with the Privacy Policy."
  ]},
  { heading: "Complaints and ADR", paragraphs: [
    "OCCTA follows an Alternative Dispute Resolution (ADR) scheme. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached; see the Customer Complaints Code for the referral process."
  ]},
  { heading: "Data protection", paragraphs: [
    "OCCTA processes account/contact data, service/address data, billing/payment status, contract/acceptance evidence, service/network information and support/complaint records needed to provide and administer the service. The Privacy Policy explains purposes, lawful bases, sharing, retention and rights."
  ]},
  { heading: "Changes, liability and general terms", paragraphs: [
    "Where required, contractual modifications are notified on a durable medium at least one month before they take effect and include any applicable penalty-free termination right. Administrative corrections do not create a new minimum term.",
    "Nothing excludes liability that cannot lawfully be excluded. OCCTA is responsible for foreseeable consumer loss caused by breach or failure to use reasonable care and skill, subject to mandatory law.",
    "English law applies where permitted while consumers retain mandatory protections and court rights applicable where they live in the UK."
  ]},
  { heading: "Acceptance and immutable evidence", paragraphs: [
    "The Contract Summary and this Pack are provided before acceptance. Accepted document references/versions and integrity evidence are recorded. Accepted customer PDFs are not silently regenerated or overwritten; if commercial terms change before acceptance, a new version is issued."
  ]}
];
