import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Wifi, Shield, ArrowRight, Phone } from "lucide-react";
import { useEffect } from "react";
import { logClientEvent } from "@/lib/activityLog";

const points = [
  "Lower indicative monthly pricing in exchange for a longer minimum term.",
  "Eligible for the OCCTA Rewards programme (launching soon).",
  "All monthly and one-off charges shown before you order.",
  "Availability depends on your exact address.",
];

export default function ContractSaverBroadband() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Contract Saver page", source_module: "marketing" });
  }, []);

  return (
    <Layout>
      <SEO
        title="Contract Saver Broadband"
        description="OCCTA Contract Saver Broadband. Lower indicative monthly pricing in exchange for a longer minimum term. Final price and key terms confirmed in your Contract Summary before you pay."
        canonical="/broadband/contract-saver"
      />
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Contract Saver Broadband
        </p>
        <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight mb-6">
          Lower monthly bill, <span className="text-primary">longer term.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Contract Saver is for customers who want a lower monthly price and don't mind committing for longer.
          Final price, contract length, fees, speed and key terms will be confirmed in your Contract Summary before you pay.
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
              <li>Early termination fees may apply if you leave before the minimum term ends — shown in your Contract Summary.</li>
              <li>Any setup, equipment or supplier charges are shown before you order.</li>
              <li>Speeds and final price depend on your confirmed address.</li>
              <li>14-day cooling-off period applies under the Consumer Contracts Regulations.</li>
            </ul>
          </div>
        </div>

        <div className="border-4 border-primary p-6 md:p-8 bg-primary/5">
          <h3 className="font-display uppercase text-2xl mb-2">Prefer no minimum term?</h3>
          <p className="text-muted-foreground mb-4">
            Look at Flex — 30-day rolling, cancel with notice.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/broadband/flex">
              <Button variant="outline" className="font-display uppercase">
                Flex Broadband <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/quote/start?interest=broadband_contract_saver">
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