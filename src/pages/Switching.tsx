import { useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { logClientEvent } from "@/lib/activityLog";

export default function SwitchingPage() {
  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Switching page", source_module: "marketing" });
  }, []);

  return (
    <Layout>
      <SEO
        title="Switching to OCCTA"
        description="How OCCTA handles your broadband switch using One Touch Switch. Your current provider, dates, fees and any downtime risks are confirmed in your Contract Summary before you pay."
        canonical="/switching"
      />
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight mb-6">
          Switching to <span className="text-primary">OCCTA</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          The UK telecoms industry uses One Touch Switch for residential broadband and home phone switches.
          When you accept your OCCTA Contract Summary, we coordinate with your losing provider so you don't
          have to ring them yourself.
        </p>

        <div className="border-4 border-foreground p-6 mb-6">
          <h2 className="font-display uppercase text-xl mb-3">What we'll confirm before you pay</h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>The provisional switch date and any expected downtime window.</li>
            <li>Any early termination charges from your current provider (you'll see these in your Contract Summary).</li>
            <li>Whether you can keep your home phone number.</li>
            <li>Any installation, router or supplier charges.</li>
          </ul>
        </div>

        <div className="border-4 border-foreground p-6 mb-6 bg-muted/30">
          <h2 className="font-display uppercase text-xl mb-3">What we won't do</h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Promise zero downtime — switches occasionally involve a short outage.</li>
            <li>Cancel your existing service without your consent.</li>
            <li>Lock you into anything before you've reviewed and accepted your Contract Summary.</li>
          </ul>
        </div>

        <div className="border-4 border-primary p-6 bg-primary/5">
          <p className="text-muted-foreground mb-4">
            Ready to see what's available at your address? Final price, contract length, fees, speed and key
            terms will be confirmed in your Contract Summary before you pay.
          </p>
          <Link to="/quote/start?interest=switch">
            <Button variant="hero" className="font-display uppercase">Start a switch enquiry</Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}