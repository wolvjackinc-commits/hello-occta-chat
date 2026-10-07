import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function SwitchBroadbandSeo() {
  return (
    <>
      <SeoContentLayout
        title="Switch broadband provider — One Touch Switch in 14 days | OCCTA"
        metaDescription="Switch to OCCTA broadband using One Touch Switch where it applies. Current prices, dates, downtime expectations and any promotional switch credit are confirmed before you order."
        canonical="/switch-broadband-provider"
        h1="Switch broadband — we coordinate eligible OTS switches"
        shortAnswer="Where One Touch Switch applies, the gaining provider coordinates the switch. Your expected activation or switch date, engineer requirement and any known downtime risk are confirmed for the actual order."
        intro="For eligible residential broadband and landline switches, One Touch Switch lets the gaining provider coordinate the provider-to-provider steps. Here is how OCCTA handles the order-specific process."
        sections={[
          { heading: "How One Touch Switch works", body: "You order with us. Where One Touch Switch applies, the providers coordinate the switch and you receive the required switching information, including any charge from your existing provider. The expected date and any known downtime risk are confirmed for the order; we do not promise zero downtime." },
          { heading: "What we cover", body: "Any current OCCTA switching promotion or credit is shown explicitly in the order or written quote before acceptance. We do not promise reimbursement of another provider’s early-termination charge unless that specific promotion is offered and recorded for your order." },
          { heading: "Keeping your number", body: "Add Digital Home Phone at signup and we'll port your landline number as part of the switch — no separate porting form." },
          { heading: "Timeline", body: "Day 0 order, Day 1–2 notification, Day 10–14 switchover. FTTP-to-FTTP moves can be same-week; new-build FTTP installs need an engineer slot (2–4 weeks)." },
        ]}
        faqs={[
          { question: "Will I lose internet during the switch?", answer: "On FTTC to FTTC, expect under an hour on the day. FTTP-to-FTTP is usually seamless. We'll tell you the exact window when your slot is booked." },
          { question: "What if I'm still in contract?", answer: "Your existing provider should tell you any charge that applies to leaving. OCCTA only contributes toward that charge where a current promotion explicitly says so and the credit is recorded in your order or written quote." },
          { question: "Do I need to cancel with my old provider?", answer: "No — OTS forbids that. If you cancel yourself you break the process. Just order with us." },
          { question: "Can I keep my email address?", answer: "Only if your old provider offers a paid mailbox add-on. Most ISP email addresses stop working after the switch — we recommend Gmail/Outlook well before you move." },
          { question: "What about my router?", answer: "Send-back rules vary by ISP. BT and Sky ask for the router back; TalkTalk and Vodafone rarely do. We include a new Wi-Fi 6 router free." },
        ]}
        relatedLinks={[
          { label: "How to switch (full guide)", to: "/learn/how-to-switch-broadband", description: "Step-by-step OTS walkthrough." },
          { label: "Leaving BT", to: "/learn/leaving-bt", description: "BT-specific switching notes." },
          { label: "Leaving Sky", to: "/learn/leaving-sky", description: "Sky-specific switching notes." },
          { label: "Leaving Virgin Media", to: "/learn/leaving-virgin", description: "Virgin-to-Openreach move." },
          { label: "Broadband plans", to: "/broadband-plans", description: "Pick a plan to switch to." },
          { label: "£50 switch cashback", to: "/broadband-cashback-offer", description: "SWITCH50 offer terms and how to claim." },
          { label: "Coverage check", to: "/coverage-areas", description: "Confirm your address is served." },
        ]}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 -mt-8">
        <LeadCaptureWidget
          source="switch-broadband-seo"
          title="Want us to sanity-check your switch?"
          description="Postcode + your current provider — we'll tell you what to expect and any likely fees, before you commit."
          defaultInterest="broadband"
          compact
        />
      </section>
    </>
  );
}