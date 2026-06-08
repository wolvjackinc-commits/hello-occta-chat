import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Wifi, Phone, Shield, ArrowRight } from "lucide-react";

const points = [
  "30-day rolling options available. Cancel with notice.",
  "All monthly and one-off charges shown before you order.",
  "Free standard installation where available and shown in your quote.",
  "Availability depends on your exact address.",
];

export default function FlexBroadband() {
  return (
    <Layout>
      <SEO
        title="Flex Broadband — 30-day rolling"
        description="OCCTA Flex Broadband. 30-day rolling options. Charges shown before you order. Availability depends on your exact address."
        canonical="/broadband/flex"
      />
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Flex Broadband
        </p>
        <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight mb-6">
          Broadband <span className="text-primary">without the lock-in.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Flex Broadband is for customers who want flexibility over the lowest possible price.
          Choose a 30-day rolling option, cancel with notice, and pay only for what's shown in your quote.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="border-4 border-foreground p-6">
            <h2 className="font-display uppercase text-xl mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" /> What you get
            </h2>
            <ul className="space-y-3 text-sm">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-4 border-foreground p-6 bg-muted/30">
            <h2 className="font-display uppercase text-xl mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Things to know
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Any setup, cease, equipment or supplier charges are shown before you order.</li>
              <li>Checks or deposits may apply depending on product/supplier.</li>
              <li>Speeds and final price depend on your confirmed address.</li>
              <li>14-day cooling-off period applies under the Consumer Contracts Regulations.</li>
            </ul>
          </div>
        </div>

        <div className="border-4 border-primary p-6 md:p-8 bg-primary/5">
          <h3 className="font-display uppercase text-2xl mb-2">Want lower monthly pricing?</h3>
          <p className="text-muted-foreground mb-4">
            Look at Contract Saver — keeps your monthly bill down in exchange for a longer term and
            stronger rewards eligibility.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/broadband/contract-saver">
              <Button variant="outline" className="font-display uppercase">
                Contract Saver <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/quote/start?service=broadband&plan=flex">
              <Button variant="hero" className="font-display uppercase">
                Request a confirmed quote
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8 flex items-center gap-2">
          <Phone className="w-3 h-3" /> Prefer to talk? Call 0800 260 6626.
        </p>
      </section>
    </Layout>
  );
}
