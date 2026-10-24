import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { HeroKicker, HeroTitle, PosterStage, BrandSection } from "@/components/brand/kit";
import { getFromPrices } from "@/lib/pricing/engine";
import { getPartnerLanding, partnerAttributionSearch, type PartnerLanding as Landing, validPartnerCode } from "@/lib/partners/partners";

/**
 * Tenant landing page behind a partner's QR code / short link (/p/CODE).
 * When the code belongs to an active partner, the URL gains the partner's
 * reference code + UTM tags so the existing first-touch capture records it
 * and the order form pre-fills the code.
 */
export default function PartnerLanding() {
  const { code: rawCode = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Landing | null>(null);
  const [checked, setChecked] = useState(false);
  const prices = getFromPrices();
  const code = validPartnerCode(rawCode);

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setChecked(true);
      return;
    }
    void getPartnerLanding(code).then((found) => {
      if (cancelled) return;
      setPartner(found);
      setChecked(true);
      if (found && !new URLSearchParams(location.search).get("cc")) {
        navigate({ pathname: location.pathname, search: partnerAttributionSearch(found.code) }, { replace: true });
      }
    });
    return () => { cancelled = true; };
  }, [code, location.pathname, location.search, navigate]);

  const name = partner?.display_name;

  return (
    <Layout>
      <SEO
        title={name ? `Broadband for your new home — via ${name}` : "Broadband for your new home"}
        description="30-day rolling broadband where available, with the full price shown before you order. UK-based support from OCCTA."
        canonical="/moving-house-broadband"
        noIndex
      />
      <PosterStage>
        <HeroKicker>{name ? `Recommended by ${name}` : "Moving in?"}</HeroKicker>
        <HeroTitle size="md">Get connected for your move-in.</HeroTitle>
        <p className="mt-6 max-w-2xl text-lg text-white/80">
          Broadband from £{prices.broadband} a month. Choose Flex 30 to roll monthly where available, so you're never tied in past your tenancy.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/order">Check my new address <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/40 bg-transparent text-white hover:bg-white/10">
            <Link to="/moving-house-broadband">Moving house guide</Link>
          </Button>
        </div>
        {checked && partner && (
          <p className="mt-6 text-sm text-white/70">
            Your reference <span className="font-mono font-semibold text-primary">{partner.code}</span> is applied automatically. If you order on another device, type it in the "Offer or reference code" box.
          </p>
        )}
        {checked && code && !partner && (
          <p className="mt-6 text-sm text-white/70">This partner link is no longer active, but you can still order as normal.</p>
        )}
      </PosterStage>
      <BrandSection tone="paper">
        <h2 className="font-display text-3xl uppercase">Why tenants choose OCCTA</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ["Flex 30", "30-day rolling broadband where available. Price Lock 24 if you're staying longer."],
            ["Price shown first", "Monthly price, setup and router cost are confirmed before you order."],
            ["Up to 1000Mbps", "Full fibre where available. Speeds for your address are shown before you order."],
            ["UK-based support", "Track tickets and bills in your OCCTA dashboard."],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3 border-4 border-foreground bg-background p-4">
              <Check className="mt-1 h-5 w-5 flex-none text-foreground" aria-hidden="true" />
              <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{body}</p></div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">
          Availability, speed and price depend on your address and are confirmed before you order. Payment is by Direct Debit.
        </p>
      </BrandSection>
    </Layout>
  );
}
