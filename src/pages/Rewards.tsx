import { useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Gift, Lock } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { logClientEvent } from "@/lib/activityLog";

export default function RewardsPage() {
  const { rewardsEnabled } = usePlatformSettings();

  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "Rewards teaser", source_module: "marketing" });
  }, []);

  return (
    <Layout>
      <SEO
        title="OCCTA Rewards"
        description="The OCCTA Rewards programme is launching soon. Final reward values, eligibility and unlock rules will be published before activation."
        canonical="/rewards"
      />
      <section className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-foreground mb-6 text-xs font-display uppercase tracking-wider">
          <Lock className="w-3 h-3" /> Launching soon
        </div>
        <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.95] tracking-tight mb-6">
          OCCTA <span className="text-primary">Rewards</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Our rewards programme is launching soon. Final reward values, eligibility, fraud rules and the unlock
          trigger will be published before activation — nothing here is guaranteed yet, and no live reward
          values are shown until we've confirmed them.
        </p>

        <div className="border-4 border-foreground p-6 text-left mb-6">
          <h2 className="font-display uppercase text-xl mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" /> What we can tell you today
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Rewards will be tied to cleared payments, not sign-ups.</li>
            <li>Eligibility rules and fraud checks will be transparent and published.</li>
            <li>Contract Saver customers will have stronger rewards eligibility than Flex customers.</li>
            <li>You'll see your reward status inside your customer dashboard once the programme is live.</li>
          </ul>
        </div>

        {rewardsEnabled ? (
          <p className="text-sm text-muted-foreground">
            Rewards are now enabled — see your dashboard for live reward status.
          </p>
        ) : (
          <Link to="/quote/start?interest=rewards">
            <Button variant="outline" className="font-display uppercase">Be first to know — start a quote</Button>
          </Link>
        )}
      </section>
    </Layout>
  );
}