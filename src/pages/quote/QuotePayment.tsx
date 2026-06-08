import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Check } from "lucide-react";

export default function QuotePayment() {
  const { token } = useParams();
  return (
    <Layout>
      <SEO title="Next step — payment" description="OCCTA will issue your secure payment link." canonical={`/quote/payment/${token}`} />
      <section className="container mx-auto px-4 py-16 max-w-xl text-center">
        <div className="w-14 h-14 mx-auto mb-6 border-4 border-foreground bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="w-7 h-7" />
        </div>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-4">You're set.</h1>
        <p className="text-base text-muted-foreground mb-4">
          Your Contract Summary has been accepted and recorded. OCCTA will email you a secure payment link
          for any amount due, and will confirm next steps for provisioning and switching.
        </p>
        <p className="text-xs text-muted-foreground">
          We never take card details by email or phone. Payments are processed through our secure Worldpay
          hosted payment page.
        </p>
      </section>
    </Layout>
  );
}