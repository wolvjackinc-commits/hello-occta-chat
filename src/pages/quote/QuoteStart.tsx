import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageCircle, Mail } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { logClientEvent } from "@/lib/activityLog";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";

const INTEREST_LABELS: Record<string, string> = {
  broadband: "Broadband",
  broadband_flex: "Flex Broadband",
  broadband_contract_saver: "Contract Saver Broadband",
  sim: "SIM Plan",
  voice: "Digital Home Phone",
  business: "Business Telecom",
  switch: "Switching",
  rewards: "Rewards",
};

export default function QuoteStart() {
  const [params] = useSearchParams();
  const interest = params.get("interest") ?? "broadband";
  const interestLabel = INTEREST_LABELS[interest] ?? "Telecom";
  const { settings } = usePlatformSettings();

  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    logClientEvent({
      event_type: "quote_start",
      title: `Quote start: ${interestLabel}`,
      source_module: "quote",
      details: { interest },
    });
  }, [interest, interestLabel]);

  const handleChat = () => {
    logClientEvent({ event_type: "cta_click", title: "Quote start: open chat", source_module: "quote" });
    window.dispatchEvent(new Event("open-ai-chat"));
  };

  const handlePostcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postcode.trim().length < 5) return;
    logClientEvent({
      event_type: "postcode_check",
      title: "Quote start postcode entered",
      source_module: "quote",
    });
    handleChat();
  };

  return (
    <Layout>
      <SEO
        title={`Request a quote — ${interestLabel}`}
        description="Tell us a little about what you need and we'll prepare a confirmed quote and Contract Summary before you pay. No commitment until you accept your Contract Summary."
        canonical="/quote/start"
      />
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Quote request — {interestLabel}
        </p>
        <h1 className="font-display uppercase text-3xl md:text-5xl leading-[0.95] tracking-tight mb-4">
          Let's get you a <span className="text-primary">proper quote.</span>
        </h1>
        <p className="text-base text-muted-foreground mb-6">
          {settings.manual_mode_message}
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Final price, contract length, fees, speed and key terms will be confirmed in your Contract Summary
          before you pay.
        </p>

        <div className="border-4 border-foreground p-6 mb-6">
          <h2 className="font-display uppercase text-xl mb-4">Tell us your postcode</h2>
          <form onSubmit={handlePostcodeSubmit} className="space-y-3">
            <Label htmlFor="postcode" className="text-sm">UK postcode</Label>
            <Input
              id="postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              maxLength={10}
              className="font-mono"
            />
            <Button type="submit" variant="hero" className="w-full font-display uppercase">
              Continue in chat
              <MessageCircle className="w-4 h-4 ml-2" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            We only store this locally for your session right now. We'll capture full details once an OCCTA
            advisor picks up your quote.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <a href={CONTACT_PHONE_TEL} className="border-4 border-foreground p-5 hover:bg-muted/30 transition-colors">
            <Phone className="w-5 h-5 text-primary mb-2" />
            <p className="font-display uppercase text-sm mb-1">Prefer to talk?</p>
            <p className="text-sm text-muted-foreground">Call {CONTACT_PHONE_DISPLAY}</p>
          </a>
          <a href="mailto:hello@occta.co.uk" className="border-4 border-foreground p-5 hover:bg-muted/30 transition-colors">
            <Mail className="w-5 h-5 text-primary mb-2" />
            <p className="font-display uppercase text-sm mb-1">Email us</p>
            <p className="text-sm text-muted-foreground">hello@occta.co.uk</p>
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          By starting a quote you agree to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
          We won't take any payment until you've reviewed and accepted your Contract Summary.
        </p>
      </section>
    </Layout>
  );
}