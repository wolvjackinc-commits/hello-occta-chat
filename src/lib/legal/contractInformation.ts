// OCCTA Consumer Contract Information & Customer Agreement Pack.
// Production benchmark for NEW residential consumer contracts from 6 October 2026.
// Historic accepted contracts retain their original immutable versions.

export const CONTRACT_INFORMATION_VERSION = "2026.10.1";

export type ContractInformationSection = { heading: string; paragraphs: string[] };

export const CONTRACT_INFORMATION_INTRO =
  "This Contract Information & Customer Agreement Pack contains the detailed terms for your OCCTA consumer service. Read it together with the Contract Summary issued for your order. Both documents must be provided before you are asked to enter into the agreement. Customer-specific prices, service details, speeds, dates and charges shown in your Contract Summary/order take priority over generic examples in this Pack, except where law requires otherwise.";

export const CONTRACT_INFORMATION_SECTIONS: ContractInformationSection[] = [
  { heading: "1. Who your agreement is with", paragraphs: [
    "Your agreement is with OCCTA LIMITED (OCCTA, we, us or our), company number 13828933, registered office at 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom. Website: www.occta.co.uk. Telephone: 0800 260 6626. General and support email: hello@occta.co.uk.",
    "The underlying access network or wholesale service may be supplied by another communications/network provider. Your retail contract remains with OCCTA unless we expressly tell you otherwise."
  ]},
  { heading: "2. What forms your agreement and when it starts", paragraphs: [
    "Your agreement consists of your final order/quote, the Contract Summary, this Contract Information & Customer Agreement Pack, and any service-specific schedule or policy expressly incorporated and supplied or made available to you before acceptance.",
    "You are not bound merely because documents are generated, viewed or emailed. The agreement is entered into only after the required pre-contract documents have been provided and you expressly accept the order.",
    "Accepted customer-specific documents are versioned and retained. A later website update does not silently replace an accepted price, minimum term, notice period, cancellation rule or other customer-specific commitment."
  ]},
  { heading: "3. Service, availability, likely start date and provisioning", paragraphs: [
    "We will provide the service shown in your Contract Summary subject to final network availability, address validation and any necessary installation or provisioning work. Your preferred or likely service-start date is shown in the order journey where available and remains subject to network confirmation unless expressly confirmed as a committed appointment.",
    "If the ordered product cannot be supplied, we will not silently substitute a materially different product, technology, price or minimum term. We will explain the available alternative and obtain your agreement where a contractual change is required.",
    "If OCCTA or the access network cannot provision the ordered service, we will explain the options, including re-ordering an available service or cancelling the affected order. Amounts paid for an unprovided service are refunded where required by law."
  ]},
  { heading: "4. Broadband technology, data allowance and performance information", paragraphs: [
    "Your Contract Summary identifies the service and the broadband technology available for the order, for example Full-fibre (FTTP) or Part-fibre (SOGEA/FTTC). We will not use an 'up to' headline figure as a guaranteed speed unless an express guarantee is stated.",
    "Where the access-network data provides contractual minimum, normally available, maximum and advertised download/upload speeds, those values are shown in your order documents. If a metric is not supplied by the access network, OCCTA will not invent it and will identify the available address-specific estimate instead.",
    "Unless your order says otherwise, standard residential fixed broadband is supplied without a monthly data-usage cap. Any fair-use, traffic-volume or specialist limitation that applies to a particular service will be stated before acceptance."
  ]},
  { heading: "5. Broadband remedies, latency, jitter, packet loss and service quality", paragraphs: [
    "If you experience a material speed or quality problem, contact OCCTA and give us a reasonable opportunity to investigate. We may ask you to perform appropriate diagnostics, including a wired test where relevant.",
    "If there is a significant, continuous or regularly recurring discrepancy between actual performance and the performance stated in your contract, the remedies required by applicable law, regulation and your service commitments remain available. Depending on the circumstances these may include repair/repeat performance, price reduction or a right to end the affected service without penalty.",
    "Unless your Contract Summary or service schedule states a specific contractual target, OCCTA does not promise a separate consumer SLA for latency, jitter or packet loss. We will nevertheless investigate material quality faults and apply any mandatory remedy."
  ]},
  { heading: "6. Traffic management and open-internet information", paragraphs: [
    "OCCTA does not intentionally block or throttle lawful applications or content for commercial reasons. Reasonable, proportionate network-management measures may be used where necessary for security, legal compliance, network integrity or temporary/exceptional congestion.",
    "Network-management measures can, while they operate, affect throughput, latency or availability. Network/security telemetry and related personal data are processed only as permitted by law and as described in the Privacy Policy."
  ]},
  { heading: "7. Equipment, router and ownership", paragraphs: [
    "Your order states whether a router or other equipment is purchased outright, rented, loaned or not supplied. Equipment purchased outright becomes yours once paid for, subject to your statutory rights. Loan/rental equipment remains OCCTA property unless we agree otherwise.",
    "Where loan/rental equipment must be returned after service ends, follow the return instructions and return it within 14 days of those instructions. A non-return or damage charge is applied only where the basis is fair, lawful and properly disclosed.",
    "You may use compatible customer-owned equipment where the selected service permits it. OCCTA is not responsible for a fault caused solely by incompatible or faulty customer-owned equipment."
  ]},
  { heading: "8. Prices, VAT, bills, monitoring usage and payment", paragraphs: [
    "The recurring price and one-off charges for your order are shown in your Contract Summary/order. Consumer prices are inclusive of VAT unless expressly stated otherwise.",
    "Billing starts only after the service is confirmed live. Monthly subscription charges are then billed in advance on your agreed billing date. The first invoice may also contain agreed one-off charges and a pro-rata amount where the live date and billing date differ.",
    "You can review invoices, payment status and available usage/itemisation through your OCCTA account/dashboard or by asking support. Where a service has usage-based charges, the applicable tariff/allowance information is supplied or incorporated before acceptance.",
    "Direct Debit is treated as active only after the payment provider confirms the mandate. Card payments use a secure payment process/link unless you separately and expressly agree to another compliant recurring-card arrangement."
  ]},
  { heading: "9. Late payment, failed collections, restriction and debt", paragraphs: [
    "If an undisputed payment fails or becomes overdue, we will notify you and give you a reasonable opportunity to pay before proportionate recovery or service action is taken.",
    "A £10 late-payment administration charge may be applied only after an overdue notice and reasonable opportunity to pay, only where the charge is lawful and reflects the administrative action taken. We will not repeatedly add the same fee to the same overdue invoice.",
    "Restriction or suspension for material non-payment is subject to reasonable notice, applicable Ofcom/consumer-law requirements and appropriate consideration of vulnerable customers. A genuinely disputed amount will be reviewed in good faith."
  ]},
  { heading: "10. Price changes", paragraphs: [
    "OCCTA does not include a scheduled CPI-, RPI-, inflation-linked or percentage-based in-contract increase in this consumer agreement.",
    "For Price Lock 24, the agreed recurring broadband subscription price remains fixed during the 24-month minimum term except where a change is required or permitted by law in circumstances that do not give a penalty-free exit. We will explain any such change.",
    "Where a contractual modification gives you a regulatory or statutory right to leave without penalty, OCCTA will give the required notice on a durable medium, normally at least one month where the applicable rules require it, and explain the right and deadline."
  ]},
  { heading: "11. Flex 30", paragraphs: [
    "Flex 30 is a 30-day rolling service with no fixed minimum term. The normal notice period is 30 days, subject to applicable switching rules.",
    "There is no remaining-month early termination charge on Flex 30. Amounts validly due up to the effective end date and any separately valid charge already incurred remain payable.",
    "Where One Touch Switch applies, OCCTA will not continue charging notice-period subscription charges beyond the completed switch date."
  ]},
  { heading: "12. Price Lock 24, renewal and Early Termination Charge", paragraphs: [
    "Price Lock 24 has a 24-month minimum term from the service live date. After the minimum term, the service continues on a 30-day rolling basis unless you expressly agree to a new fixed term.",
    "If you choose to end Price Lock 24 during the minimum term and no penalty-free exit right applies, an Early Termination Charge may apply. The calculation starts with the recurring broadband charges remaining to the end of the minimum term, then deducts VAT that will no longer be due and direct costs OCCTA reasonably avoids because the service ends early. It will never exceed the remaining recurring charges and there will be no double recovery of the same loss.",
    "Buying equipment, taking an add-on or adding another service does not by itself extend the existing minimum term. A new or extended minimum term requires your express agreement."
  ]},
  { heading: "13. Network cease/migration charge", paragraphs: [
    "A network cease/migration charge is separate from an Early Termination Charge. It is applied only where it is lawful in the circumstances and OCCTA actually incurs the relevant wholesale/network charge.",
    "Where applicable, the customer charge is the actual qualifying cost incurred, capped at £114 including VAT if the broadband service ends within the first 12 months after going live and £60 including VAT after 12 months.",
    "It is not used to recreate a prohibited notice-period charge or to defeat a statutory/regulatory penalty-free exit or switching right. OCCTA retains supporting network/wholesale evidence for a charge it passes through."
  ]},
  { heading: "14. Pre-live cancellation and provisioning costs", paragraphs: [
    "If you cancel after the statutory cooling-off period but before the service goes live, a recurring-service Early Termination Charge does not arise merely because the service has not yet activated.",
    "OCCTA may recover only a properly disclosed, fair and legally recoverable network/order/installation cancellation cost that has actually been incurred and cannot reasonably be avoided."
  ]},
  { heading: "15. 14-day cooling-off and early start", paragraphs: [
    "For a consumer distance contract you normally have 14 calendar days from the day the contract is entered into to cancel without giving a reason.",
    "You may expressly request that OCCTA begins installation or supply during the cooling-off period where that option is available. If you make that request and later cancel during the period, you may have to pay the lawful proportionate amount for service already supplied and applicable installation work already carried out.",
    "Where goods/equipment are supplied, statutory return, handling and refund rules apply. OCCTA's model cancellation form and contact routes may be used, but use of the model form is not mandatory."
  ]},
  { heading: "16. Switching provider and One Touch Switch", paragraphs: [
    "Where One Touch Switch applies, you normally contact your new provider and the providers coordinate the switch. OCCTA will provide required switching information, including any valid Early Termination Charge.",
    "When the switch completes, the OCCTA service ends on the completed migration date and notice-period subscription charges do not continue beyond that date where the rules prohibit them.",
    "If a switch or port is delayed or fails in circumstances where regulatory compensation is due, OCCTA will provide the applicable compensation or explain how it is obtained."
  ]},
  { heading: "17. Moving home", paragraphs: [
    "Tell OCCTA as early as reasonably possible if you are moving. We will check the new address and tell you what service can be provided.",
    "If the existing service can be migrated without a new line, ONT, network installation or additional equipment/work, OCCTA will not charge a home-move migration fee.",
    "If the new address requires a new ONT, line, installation, equipment or other chargeable network work, we will tell you the charge or calculation basis before it is ordered where reasonably possible. You must agree to and pay that charge if you want the installation to proceed.",
    "If OCCTA can provide the same or a reasonably equivalent contracted service but you decline a properly disclosed installation/network charge and choose to leave, that decision does not by itself remove an otherwise valid ETF or cease charge. A materially slower service, materially different technology, materially different price or other material change is not treated as 'reasonably equivalent' without your express agreement.",
    "If OCCTA cannot reasonably provide the contracted or a genuinely equivalent service at the new address, we will review the case fairly and will not impose an unfair termination penalty solely because you moved somewhere we cannot serve."
  ]},
  { heading: "18. Engineer visits, missed appointments and customer-caused work", paragraphs: [
    "Where an engineer visit is required, ensure an adult aged 18 or over is present and safe, reasonable access is available.",
    "Where a charge can reasonably be known before an appointment or additional work, we will disclose the total price or calculation method before you agree.",
    "Where a network operator later raises a no-access, missed-appointment, abortive-visit or customer-caused fault charge that could not reasonably be calculated in advance, the customer charge is limited to the actual third-party/network charge OCCTA incurs, provided the basis was disclosed and the charge is fair and legally recoverable. No separate OCCTA engineer administration fee applies unless it was expressly disclosed before acceptance."
  ]},
  { heading: "19. Digital Voice and emergency calling", paragraphs: [
    "Digital Voice/VoIP requires working broadband, compatible equipment and mains electricity. It may not work during a power cut, broadband outage, router failure or certain network incidents. 999 and 112 calls are free when the service is operational.",
    "Keep the service address up to date because emergency-calling location information may depend on the address data held for the service.",
    "If you rely on the phone because of vulnerability, medical needs, telecare or poor mobile coverage, tell OCCTA. We will assess your circumstances and discuss available resilience or alternative communication arrangements; where appropriate and available we may provide suitable backup/resilience equipment or other support.",
    "Legacy analogue devices, alarms, fax machines, card terminals or telecare equipment may not be compatible. Check compatibility with the relevant device/service provider unless OCCTA expressly agrees to do so."
  ]},
  { heading: "20. Digital Voice calls, number porting and directory choice", paragraphs: [
    "If Digital Voice includes outgoing calls, your call allowance and any out-of-bundle, premium-rate, service-number or international charging is shown in your order or the version-controlled OCCTA call tariff supplied/incorporated before acceptance.",
    "Number porting is subject to technical availability and the applicable process. Do not independently cancel an existing number before a port where doing so could cause the number to be lost. Porting rights, timing and any qualifying compensation are provided in accordance with applicable rules.",
    "Where directory services apply, you can tell OCCTA whether you want eligible personal details included or excluded, subject to the applicable directory process."
  ]},
  { heading: "21. Faults, maintenance, guarantees and after-sales support", paragraphs: [
    "Report faults through OCCTA support. We will take reasonable steps to diagnose and resolve faults within the capabilities of the service and underlying network.",
    "Planned and urgent maintenance may interrupt service. Where reasonably practicable we will give advance notice of planned work likely to cause a material interruption.",
    "Automatic compensation, service credits, commercial guarantees or a specific repair SLA apply only where required by law or expressly included in your order/service schedule. Manufacturer warranties and your statutory consumer rights remain unaffected."
  ]},
  { heading: "22. Acceptable use, security and suspension", paragraphs: [
    "You must not use the service unlawfully or in a way that materially harms, disrupts or compromises the network, other users or third parties. Reasonable and proportionate security action may be taken where required.",
    "OCCTA may restrict or suspend service for serious misuse, fraud, network/security risk, legal/regulatory requirement or material non-payment where lawful and proportionate. We will provide notice where reasonably possible and consider particular risks to vulnerable users."
  ]},
  { heading: "23. Accessibility and vulnerability", paragraphs: [
    "Tell us if you or someone in your household has communication, disability, health, financial or other support needs relevant to the service. We will consider reasonable adjustments and available support arrangements.",
    "Accessible-format communications and nominated-contact arrangements may be available where appropriate. Current accessibility/vulnerability information is available through OCCTA support and the relevant website policy.",
    "Information about vulnerability is handled sensitively and in accordance with the Privacy Policy."
  ]},
  { heading: "24. Complaints and ADR", paragraphs: [
    "If you are unhappy, contact OCCTA using the support/complaints contact routes. We will handle the matter under the OCCTA Complaints Code.",
    "OCCTA follows an Alternative Dispute Resolution (ADR) scheme. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached; see the Customer Complaints Code for the referral process.",
    "Ofcom regulates the communications sector but does not normally determine individual customer disputes."
  ]},
  { heading: "25. Data protection and communications", paragraphs: [
    "OCCTA processes account/contact data, service/address data, billing/payment status, contract/acceptance evidence, service/network information, support/complaint records and other information needed to provide and administer the service. The Privacy Policy explains purposes, lawful bases, sharing, retention and your rights.",
    "Necessary contract, billing, service, security, fault, complaint and regulatory communications may be sent to the contact details on your account. Marketing is handled separately under applicable consent/lawful-basis rules."
  ]},
  { heading: "26. Liability and events outside reasonable control", paragraphs: [
    "Nothing excludes or limits liability where it would be unlawful, including death/personal injury caused by negligence, fraud/fraudulent misrepresentation, or non-excludable consumer rights.",
    "OCCTA is responsible for foreseeable consumer loss or damage caused by our breach or failure to use reasonable care and skill. We are not responsible for loss that was not reasonably foreseeable when the contract was made.",
    "We are not responsible for a failure caused solely by events outside our reasonable control, but we will take reasonable steps to reduce disruption and this does not remove mandatory legal/regulatory rights."
  ]},
  { heading: "27. Changes to the agreement", paragraphs: [
    "If we make a contractual modification, we will follow the applicable notice and exit-right rules. Where required, notice is given on a durable medium at least one month before the change takes effect and explains any right to terminate without penalty.",
    "Administrative corrections or contact-detail updates do not create a new minimum term. A customer-specific accepted price, term, charge or service commitment is not changed merely because later website wording differs."
  ]},
  { heading: "28. Notices, assignment, severability and law", paragraphs: [
    "Formal notices may be sent using the contact details stated by OCCTA and notices to you may be sent to the contact details on your account or another durable medium where permitted. Keep your details current.",
    "OCCTA may transfer the agreement as part of a legitimate business transfer/reorganisation provided your legal rights are not reduced. You may not transfer it to another person without agreement except where law gives you that right.",
    "If a term is invalid or unenforceable, the remaining terms continue as far as legally possible. English law applies where permitted, while consumers retain any mandatory protections and court rights applicable in the part of the UK where they live."
  ]},
  { heading: "29. Acceptance and evidence", paragraphs: [
    "Before acceptance you must have access to the Contract Summary and Contract Information & Customer Agreement Pack. The final electronic order action clearly states that it creates an obligation to pay.",
    "OCCTA records the accepted document references/versions and integrity evidence. Accepted customer PDFs are not silently regenerated or overwritten. If commercial terms change before acceptance, a new version must be issued."
  ]}
];
