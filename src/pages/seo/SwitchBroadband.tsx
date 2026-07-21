import SeoContentLayout from "@/components/seo/SeoContentLayout";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

export default function SwitchBroadbandSeo() {
  return (
    <>
      <SeoContentLayout
        title="Switch broadband provider — One Touch Switch in 14 days | OCCTA"
        metaDescription="Switch to OCCTA broadband under One Touch Switch. We contact your old provider, keep you online, and refund any early termination fee up to £150 on Price Lock 24."
        canonical="/switch-broadband-provider"
        h1="Switch broadband — we do the paperwork, you stay online"
        shortAnswer="OCCTA is a One Touch Switch (OTS) participant. Enter your postcode, pick a plan, and we contact your current provider for you. Most switches complete in 10–14 days with no downtime and no engineer visit."
        intro="Since April 2024, UK broadband switches run under One Touch Switch — the new provider does the leg work. Here's exactly how it works with OCCTA."
        sections={[
          { heading: "How One Touch Switch works", body: "You order with us. We notify your current provider. They send you a switch letter with your end date, any early-exit fee, and how to stop the switch if you change your mind. On the agreed day, service moves — usually with less than an hour of interruption on FTTC and none on FTTP." },
          { heading: "What we cover", body: "New Price Lock 24 customers get up to £150 credited back against a documented early-termination fee from their old provider. Flex 30 customers get the switch admin done for free — no ETF refund." },
          { heading: "Keeping your number", body: "Add Digital Home Phone at signup and we'll port your landline number as part of the switch — no separate porting form." },
          { heading: "Timeline", body: "Day 0 order, Day 1–2 notification, Day 10–14 switchover. FTTP-to-FTTP moves can be same-week; new-build FTTP installs need an engineer slot (2–4 weeks)." },
        ]}
        faqs={[
          { question: "Will I lose internet during the switch?", answer: "On FTTC to FTTC, expect under an hour on the day. FTTP-to-FTTP is usually seamless. We'll tell you the exact window when your slot is booked." },
          { question: "What if I'm still in contract?", answer: "Your old provider must tell you the exit fee. On Price Lock 24 we credit up to £150 towards it. On Flex 30 we cover the switching admin only." },
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