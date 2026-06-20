import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function CancellationPage() {
  return (
    <SeoContentLayout
      title="Cancellation — How to Cancel Your OCCTA Service"
      metaDescription="How to cancel an OCCTA broadband, Digital Voice or SIM service. Cancellation terms depend on the agreement you accepted — here's the process and what to expect."
      canonical="/cancellation"
      h1="Cancellation"
      shortAnswer="To cancel, contact OCCTA and we'll start the cancellation process. The notice period, any early-termination charges and any final invoice depend on the agreement you accepted — your contract is the binding source of truth."
      intro={
        <p>This page explains the general cancellation process. Specific charges and notice depend on your accepted agreement.</p>
      }
      sections={[
        {
          heading: "How to cancel",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Email <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a> or call <a href="tel:08002606626" className="underline">0800 260 6626</a>.</li>
              <li>Confirm your account number, the service you're cancelling and your preferred end date.</li>
              <li>We'll confirm any notice period, any remaining minimum-term charges and your final invoice in writing before the cancellation takes effect.</li>
            </ul>
          ),
        },
        {
          heading: "What depends on your agreement",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Whether you're inside a minimum term.</li>
              <li>Whether an early-termination charge applies.</li>
              <li>The notice period before cancellation takes effect.</li>
              <li>Any equipment to return.</li>
            </ul>
          ),
        },
        {
          heading: "Switching to another provider",
          body: (
            <p>If you're moving to another UK provider, they normally handle the switch on your behalf under the One Touch Switch process. You don't need to cancel with OCCTA separately in that case — the new provider triggers it.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Is cancellation always free?", answer: "No. Free cancellation only applies where the agreed terms say so — for example, outside a minimum term, or during the statutory cooling-off period for new orders." },
        { question: "How quickly can I cancel?", answer: "We acknowledge the request within one working day. The actual end date depends on the notice period in your agreement." },
      ]}
      faqs={[
        { question: "Do I have a cooling-off period?", answer: "New consumer orders normally include a statutory cooling-off period — your accepted agreement and order confirmation state how long applies to you." },
        { question: "What happens to my final invoice?", answer: "We issue a closing invoice covering any used time up to the end date and any agreed cancellation charges. It's payable like any other invoice." },
        { question: "Will I lose my phone number?", answer: "If you're porting to another provider they request the number transfer. If you're cancelling without porting, the number is released." },
      ]}
      relatedLinks={[
        { label: "Billing explained", to: "/billing-explained" },
        { label: "Switching", to: "/switching" },
        { label: "Contact support", to: "/contact" },
        { label: "Complaints", to: "/complaints" },
        { label: "Switching policy", to: "/legal/switching-policy" },
      ]}
      primaryCta={{ label: "Contact support", to: "/contact" }}
      secondaryCta={{ label: "Read switching policy", to: "/legal/switching-policy" }}
      compliance={
        <p>Cancellation terms, notice periods and any charges depend on the agreement you accepted with OCCTA. See your contract and the <a href="/legal/switching-policy" className="underline">Switching Policy</a> for full details.</p>
      }
    />
  );
}