export const CONTRACT_INFORMATION_VERSION = "2026-08-10-v1";

export type ContractInformationSection = { heading: string; paragraphs: string[] };

export const CONTRACT_INFORMATION_INTRO =
  "This Contract Information gives the detailed terms that sit alongside your OCCTA Contract Summary. Read both before accepting. The Contract Summary contains the service-specific price, speed estimate, minimum term, one-off charges and ending charges for your order; those service-specific figures are not replaced by generic wording here.";

export const CONTRACT_INFORMATION_SECTIONS: ContractInformationSection[] = [
  {
    heading: "1. Your agreement with OCCTA",
    paragraphs: [
      "Your agreement is with OCCTA LIMITED. It consists of the Contract Summary issued for your order, this Contract Information, and the OCCTA policies expressly referred to during checkout. Keep the Contract Summary because it records the service-specific figures you agreed.",
      "If generic wording in this Contract Information conflicts with a service-specific price, duration, speed estimate, setup charge or ending charge in your Contract Summary, the service-specific Contract Summary figure applies unless the law requires a different result.",
    ],
  },
  {
    heading: "2. Service and activation",
    paragraphs: [
      "We will provide the communications service shown in your Contract Summary, subject to final network availability, a successful order with the underlying network and any checks disclosed before order.",
      "If the selected product cannot be supplied at your address, we will not silently substitute a different product or price. We will tell you what changed and obtain your agreement before proceeding where a contractual change is required.",
      "Billing begins in accordance with the billing commencement and payment schedule shown in your order documents. A supplier delay does not by itself change the price or minimum term you accepted.",
    ],
  },
  {
    heading: "3. Broadband speeds",
    paragraphs: [
      "The estimated download and upload speeds in your Contract Summary are estimates for the selected service and are not guarantees. Actual performance can be affected by the access network, line conditions, Wi-Fi, your equipment, congestion and the services or devices you use.",
      "If we provide a separate minimum guaranteed speed or another speed remedy for your order, it will be stated in your Contract Summary or service-specific information. Your statutory and regulatory rights are not reduced by this clause.",
    ],
  },
  {
    heading: "4. Router and other equipment",
    paragraphs: [
      "Any router or equipment charge is shown before you accept. If you choose to use your own compatible router, you are responsible for its compatibility and configuration, although we will provide the connection settings reasonably needed to use the service.",
      "Where equipment is supplied, warranty, return and replacement conditions depend on the equipment supplied. We will tell you about any charge before a chargeable replacement is agreed. We do not treat an unknown supplier or replacement cost as £0.",
    ],
  },
  {
    heading: "5. Setup, installation and engineer work",
    paragraphs: [
      "Your known setup or activation charge is itemised in the Contract Summary. Complex or non-standard work that cannot be priced safely in advance is not automatically ordered: we will confirm the additional work and price before you agree to it.",
      "If an engineer visit is required, you must provide safe and reasonable access to the premises. Any known appointment, no-access or non-standard installation charge will be disclosed before we ask you to approve chargeable work, except where a charge arises because information or access provided by you was materially inaccurate.",
    ],
  },
  {
    heading: "6. Prices, VAT and billing",
    paragraphs: [
      "Residential prices are shown inclusive of VAT. Where business pricing is shown exclusive of VAT, the VAT-inclusive figure is also provided where required. Your recurring and one-off charges are the figures shown in your Contract Summary and order confirmation.",
      "We will not add an undisclosed optional product or one-off charge to your order without your agreement. Usage charges, third-party call charges or other variable charges can still arise where they form part of a service you chose and are described in the applicable tariff or service information.",
      "If a payment fails, we may contact you and take reasonable collection or service-protection steps in accordance with our published payment and collections process. Any separate fee must have been disclosed or otherwise be lawfully chargeable; this clause does not create a new fee by itself.",
    ],
  },
  {
    heading: "7. Price Lock 24 and Flex 30",
    paragraphs: [
      "If you chose Price Lock 24, the recurring broadband price shown for the Price Lock scope stays fixed for the agreed 24-month minimum term. Optional add-ons, usage charges, services added later and charges outside that scope are governed by their own stated terms.",
      "If you chose Flex 30, the broadband service is 30-day rolling where stated. If we make a contractual change that gives you a legal or regulatory right to exit without penalty, that right applies regardless of any other wording in these terms.",
    ],
  },
  {
    heading: "8. Ending, switching and early termination",
    paragraphs: [
      "Your minimum term, notice period and network cease/migration-away charge are stated in your Contract Summary. A network cease/migration-away charge can apply whether the underlying broadband is ceased completely or transferred away, where that charge was disclosed in the Contract Summary.",
      "Flex 30 has no remaining-month Early Termination Charge. The disclosed network cease/migration-away charge may still apply, together with any unpaid charges up to the service end date.",
      "For a fixed minimum term, if you choose to leave early and no penalty-free exit right applies, an Early Termination Charge may be payable. It is calculated from the recurring broadband charges remaining to the end of the minimum term, less VAT that no longer becomes due and less costs OCCTA reasonably saves because the service ends early. It will never exceed the remaining contracted broadband charges, and we will not recover the same loss twice.",
      "No Early Termination Charge is payable where the law or an applicable Ofcom rule gives you a penalty-free right to exit. Any network cease/migration-away charge is also subject to those rights and any waiver OCCTA confirms in writing.",
    ],
  },
  {
    heading: "9. Cooling-off rights",
    paragraphs: [
      "Where consumer distance-contract cancellation rights apply, you normally have 14 days to cancel from the date the contract is made. Your order journey explains this before acceptance.",
      "If you expressly ask for service to start during the cooling-off period and then cancel, you may have to pay a proportionate amount for service actually supplied up to cancellation and reasonable non-recoverable work already performed, where the law permits. Equipment supplied must be returned where required.",
    ],
  },
  {
    heading: "10. Switching provider",
    paragraphs: [
      "Where the Ofcom One Touch Switch rules apply to your switch, OCCTA will handle the process in accordance with those rules and the information provided by the gaining or losing provider. Do not cancel an existing service separately unless we or your gaining provider tell you that this is necessary for your particular service.",
      "A switch does not erase charges already lawfully due under the existing agreement. Any OCCTA ending charge that can apply to the service is the charge disclosed in your Contract Summary, subject to your statutory and regulatory rights.",
    ],
  },
  {
    heading: "11. Digital Voice, power cuts and vulnerable customers",
    paragraphs: [
      "Digital Voice works over broadband and mains electricity and may not work during a power cut or broadband outage, including for emergency calls, unless an appropriate resilience solution is available and functioning.",
      "Tell us before migration if anyone at the premises relies on the phone for emergency contact, telecare, a personal alarm or another safety-critical service. We will assess the needs and the appropriate migration/resilience arrangement before proceeding.",
      "We can record accessibility or vulnerability support needs with your consent so that appropriate support can be considered. This does not affect your right to ordinary customer service or complaints handling.",
    ],
  },
  {
    heading: "12. Faults, maintenance and support",
    paragraphs: [
      "Report a fault through the OCCTA Help Centre, customer account or the contact methods published on occta.co.uk. Repair targets depend on the underlying network and any care level included in your service; a target is not a guarantee unless expressly described as one.",
      "We may carry out reasonable maintenance or network-management work to operate, secure or repair the service. We will provide notice where reasonably practicable for planned work likely to cause a material interruption.",
      "Any statutory, regulatory or specifically agreed compensation right continues to apply. We do not promise a compensation scheme, service credit or repair time unless it is stated for your service or required by law or regulation.",
    ],
  },
  {
    heading: "13. Acceptable use and suspension",
    paragraphs: [
      "You must use the service lawfully and in accordance with the OCCTA Acceptable Use Policy. We may take proportionate action to protect customers or the network where there is fraud, unlawful use, serious security risk or a material breach.",
      "We may restrict or suspend service for material non-payment or serious breach only in accordance with the applicable contract, law and Ofcom requirements. We will give appropriate notice and an opportunity to resolve the issue where required and reasonably possible.",
    ],
  },
  {
    heading: "14. Liability and events outside reasonable control",
    paragraphs: [
      "Nothing in the agreement excludes or restricts liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, fraud, or rights that cannot be limited under consumer law.",
      "For losses that can lawfully be limited, the applicable limits must be fair and proportionate to the service and circumstances. We are not responsible for a failure caused solely by an event genuinely outside our reasonable control, but this does not remove any statutory or regulatory remedy that still applies.",
    ],
  },
  {
    heading: "15. Privacy and account security",
    paragraphs: [
      "We process personal information to provide, secure, bill and support the service, and for other purposes described in the OCCTA Privacy Policy. We use suppliers and network partners where necessary to deliver the service and require appropriate handling of personal data.",
      "Keep your customer-account credentials secure. We may ask you to complete reasonable identity verification before disclosing account-specific information or making sensitive changes.",
    ],
  },
  {
    heading: "16. Complaints, ADR and contract changes",
    paragraphs: [
      "If something goes wrong, contact OCCTA using the complaints details shown in your Contract Summary or on occta.co.uk. If a complaint is not resolved within the applicable ADR timeframe, or we issue a deadlock letter earlier, you can use the ADR process described in the Complaints Code.",
      "If we propose a change to your contract, we will give the notice and any penalty-free exit right required by law and Ofcom rules. An information-only refresh that expressly says it does not change your agreement does not by itself create a new price, fee or minimum term.",
      "The agreement is governed by the law applicable to your contract and does not remove rights you have under mandatory UK consumer or communications law.",
    ],
  },
];
