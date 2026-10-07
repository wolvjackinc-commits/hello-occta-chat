import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Wifi, Shield, ArrowRight, Phone } from "lucide-react";
import { useEffect } from "react";
import { logClientEvent } from "@/lib/activityLog";

const points = [
  "Lower headline monthly pricing in exchange for a 24-month minimum term.",
  "Eligible for the OCCTA Rewards programme (launching soon).",
  "All monthly and one-off charges shown before you order.",
  "Availability depends on your exact address.",
];

export default function ContractSaverBroadband() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Price Lock 24 page", source_module: "marketing" });
  }, []);

  return (
    <Layout>
      <SEO
        title="Price Lock 24 Broadband"
        description="OCCTA Price Lock 24 broadband has a 24-month minimum term. Final price, address-specific speed information, setup, equipment and applicable charges are confirmed before acceptance."
        canonical="/broadband/contract-saver"
      />
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Price Lock 24 Broadband
        </p>
        <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight mb-6">
          Lower monthly bill, <span className="text-primary">longer term.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Price Lock 24 is for customers who prefer lower headline monthly pricing and can commit to a 24-month minimum term.
          Final price, address-specific speed information, setup, equipment, minimum term and applicable charges are confirmed in the Contract Summary and Contract Information before acceptance.
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
              <li>A fair-loss Early Termination Charge may apply if you leave during the 24-month minimum term and no penalty-free exit right applies; the method is shown in your accepted documents.</li>
              <li>Any setup, equipment or supplier charges are shown before you order.</li>
              <li>Speeds and final price depend on your confirmed address.</li>
              <li>A 14-day cooling-off period normally applies to distance consumer orders; if you expressly request an early start, lawful proportionate charges may apply for service or installation already supplied.</li>
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
            <Link to="/broadband">
              <Button variant="hero" className="font-display uppercase">
                Check Availability
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