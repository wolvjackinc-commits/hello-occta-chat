import Layout from "@/components/layout/Layout";

const sections = [
  {
    title: "1. Introduction & Legal Status",
    content: [
      "These Terms of Service (\"Terms\") govern the provision of telecommunications and related services by OCCTA Limited (\"OCCTA\", \"we\", \"us\", \"our\") through www.occtatele.com.",
      "These Terms form a legally binding agreement between you (\"Customer\", \"you\") and OCCTA once you:",
      "• Place an order on www.occtatele.com",
      "• Activate a service",
      "• Make a payment, or",
      "• Use any of our services.",
      "These Terms comply with all applicable UK laws, including the Communications Act 2003, Ofcom General Conditions of Entitlement, Consumer Rights Act 2015, Data Protection Act 2018, UK GDPR, and the Privacy and Electronic Communications Regulations (PECR).",
    ],
  },
  {
    title: "2. Company Information",
    content: [
      "Company Name: OCCTA Limited",
      "Company Number: 13828933",
      "Registered Address: 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom",
      "Website: https://www.occtatele.com",
      "Contact Email: support@occtatele.com",
    ],
  },
  {
    title: "3. Definitions",
    content: [
      "Account – Your registered customer account on www.occtatele.com",
      "Charges – All fees payable for Services, including recurring, usage-based, setup, suspension, reactivation, and termination charges",
      "Contract – These Terms, your Order, and any service-specific terms",
      "Equipment – Any SIM, router, modem, or hardware supplied",
      "Services – Telecommunications, connectivity, voice, data, messaging, or related services",
      "Service Start Date – Date Services commence",
      "Minimum Term – Any minimum contractual commitment period",
    ],
  },
  {
    title: "4. Eligibility & Customer Responsibilities",
    content: [
      "You must:",
      "• Be 18 years or older",
      "• Have legal capacity to contract",
      "• Provide accurate and complete information",
      "You are responsible for:",
      "• All activity carried out via your Account",
      "• All Charges incurred under your Account",
      "• Ensuring authorised use only",
    ],
  },
  {
    title: "5. Orders, Acceptance & Activation",
    content: [
      "All orders placed on www.occtatele.com are subject to acceptance by OCCTA.",
      "We may refuse or delay orders where lawful, including for:",
      "• Credit or fraud checks",
      "• Network limitations",
      "• Regulatory requirements",
      "• Incomplete or incorrect information",
      "Services begin on the confirmed Service Start Date.",
    ],
  },
  {
    title: "6. Services Provided",
    content: [
      "OCCTA provides telecommunications and related services, including but not limited to:",
      "• Voice services",
      "• Data / internet connectivity",
      "• Messaging services",
      "• Ancillary telecom services",
      "Service availability, speed, quality, and coverage are not guaranteed and may vary due to location, network congestion, third-party infrastructure, and maintenance or upgrades.",
    ],
  },
  {
    title: "7. Charges, Billing & Payments",
    content: [
      "You must pay all Charges in accordance with the billing terms shown on www.occtatele.com or your Order.",
      "Charges may include:",
      "• Installation or setup fees",
      "• Monthly recurring charges",
      "• Usage-based charges",
      "• Late payment fees",
      "• Suspension or reactivation fees",
      "• Early termination charges",
      "We may change Charges where permitted by law, with notice where required.",
      "Failure to pay may result in suspension, termination, or debt recovery action.",
    ],
  },
  {
    title: "8. Direct Debit & Payment Methods",
    content: [
      "Where Direct Debit is used, you authorise OCCTA to collect payments in accordance with the Direct Debit mandate.",
      "You must ensure sufficient funds are available.",
      "Failed or reversed payments may incur additional Charges.",
    ],
  },
  {
    title: "9. Fair & Acceptable Use",
    content: [
      "You must not use Services to:",
      "• Break UK or international law",
      "• Transmit harmful, offensive, or abusive material",
      "• Commit fraud, spam, or misuse",
      "• Interfere with networks or other users",
      "OCCTA may restrict, suspend, or terminate Services for misuse.",
    ],
  },
  {
    title: "10. Equipment",
    content: [
      "Equipment remains the property of OCCTA unless expressly sold.",
      "You must:",
      "• Take reasonable care of Equipment",
      "• Use Equipment only as instructed",
      "• Return Equipment on termination if required",
      "You are responsible for loss or damage beyond fair wear and tear.",
    ],
  },
  {
    title: "11. Number Portability (Where Applicable)",
    content: [
      "You have statutory rights to number portability under UK telecom regulations.",
      "Porting requests will be handled in line with regulatory requirements and timelines.",
    ],
  },
  {
    title: "12. Service Availability & Maintenance",
    content: [
      "We aim to provide continuous service but do not guarantee uninterrupted availability.",
      "Interruptions may occur due to:",
      "• Maintenance or upgrades",
      "• Network faults",
      "• Force majeure events",
      "• Third-party service failures",
    ],
  },
  {
    title: "13. Suspension & Termination",
    content: [
      "OCCTA may suspend or terminate Services if:",
      "• You breach these Terms",
      "• Payments are overdue",
      "• Required by law or regulator",
      "• Continued provision becomes impractical",
      "You may terminate Services in accordance with your Minimum Term and notice requirements.",
      "Early termination may result in termination Charges.",
    ],
  },
  {
    title: "14. Limitation of Liability",
    content: [
      "To the fullest extent permitted by law:",
      "• We exclude liability for indirect or consequential loss",
      "• We are not liable for loss of profit, business, or data",
      "Our total liability is limited to the Charges paid by you in the previous 12 months.",
      "Nothing limits liability for death or personal injury caused by negligence.",
    ],
  },
  {
    title: "15. Force Majeure",
    content: [
      "OCCTA is not liable for failure caused by events beyond reasonable control, including:",
      "• Natural disasters",
      "• Power or network failures",
      "• Government actions",
      "• Acts of third-party providers",
    ],
  },
  {
    title: "16. Complaints & Dispute Resolution",
    content: [
      "Complaints should be raised via support@occtatele.com.",
      "If unresolved, disputes may be escalated in line with UK telecom regulatory procedures.",
    ],
  },
  {
    title: "17. Data Protection & Privacy",
    content: [
      "Use of Services is subject to our Privacy Policy, published on www.occtatele.com.",
      "Personal data is processed in accordance with UK GDPR and PECR.",
    ],
  },
  {
    title: "18. Marketing Communications",
    content: [
      "Marketing communications are sent only where lawful.",
      "You may opt out at any time.",
    ],
  },
  {
    title: "19. Assignment & Subcontracting",
    content: [
      "OCCTA may assign or subcontract obligations where lawful.",
      "You may not transfer this Contract without written consent.",
    ],
  },
  {
    title: "20. Changes to These Terms",
    content: [
      "We may update these Terms from time to time.",
      "The latest version will always be published on www.occtatele.com.",
      "Continued use of Services constitutes acceptance.",
    ],
  },
  {
    title: "21. Severability",
    content: [
      "If any provision is unenforceable, the remainder will remain in force.",
    ],
  },
  {
    title: "22. Governing Law & Jurisdiction",
    content: [
      "These Terms are governed by the laws of England and Wales.",
      "The courts of England and Wales have exclusive jurisdiction.",
    ],
  },
  {
    title: "23. Entire Agreement",
    content: [
      "These Terms constitute the entire agreement between you and OCCTA.",
    ],
  },
  {
    title: "24. Contact Details",
    content: [
      "OCCTA Limited",
      "22 Pavilion View",
      "Huddersfield, HD3 3WU",
      "United Kingdom",
      "📧 support@occtatele.com",
      "🌐 https://www.occtatele.com",
    ],
  },
];

const TermsOfService = () => {
  return (
    <Layout>
      <section className="min-h-[calc(100vh-80px)] py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 card-brutal bg-card p-8">
              <p className="font-display uppercase text-primary text-sm">Terms of Service</p>
              <h1 className="text-display-md mt-2">OCCTA Limited</h1>
              <p className="text-muted-foreground mt-2">Effective date: 18 January 2026</p>
              <p className="text-muted-foreground mt-4">
                These Terms of Service set out the terms on which OCCTA Limited provides
                telecommunications and related services through https://www.occtatele.com. By
                ordering, activating, paying for, or using our services, you agree to be bound
                by these Terms.
              </p>
              <p className="text-muted-foreground mt-4">
                If you do not agree to these Terms, you should not use our services. Please
                review them carefully and contact us with any questions.
              </p>
            </div>

            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.title} className="card-brutal bg-card p-6">
                  <h2 className="text-display-sm mb-4">{section.title}</h2>
                  <div className="space-y-2 text-muted-foreground text-sm">
                    {section.content.map((line, index) => (
                      <p key={`${section.title}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default TermsOfService;
