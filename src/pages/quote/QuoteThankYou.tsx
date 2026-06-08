import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Check } from "lucide-react";

export default function QuoteThankYou() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  return (
    <Layout>
      <SEO title="Quote request received" description="Thanks — OCCTA will check the best available option for your address." canonical="/quote/thank-you" />
      <section className="container mx-auto px-4 py-16 max-w-xl text-center">
        <div className="w-14 h-14 mx-auto mb-6 border-4 border-foreground bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="w-7 h-7" />
        </div>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-4">Thanks — we've got it.</h1>
        {ref && <p className="text-sm text-muted-foreground mb-4">Your reference: <strong className="font-mono">{ref}</strong></p>}
        <p className="text-base text-muted-foreground mb-6">
          OCCTA will check the best available option for your address and confirm speed, price, installation
          and switching details before you pay.
        </p>
        <p className="text-xs text-muted-foreground mb-8">
          We'll be in touch by your preferred contact method. No payment is taken until you've reviewed and
          accepted your Contract Summary.
        </p>
        <Link to="/" className="font-display uppercase underline">Back to home</Link>
      </section>
    </Layout>
  );
}