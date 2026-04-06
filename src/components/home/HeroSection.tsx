import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Wifi, Phone, X, RefreshCcw, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getFromPrices, getRetailBroadbandCards } from "@/lib/pricing/engine";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { useAvailability, getShortAddress } from "@/contexts/AvailabilityContext";

const PLAN_LABELS: Record<string, { name: string; tagline: string; speed: string }> = {
  essential: { name: "Essential", tagline: "Everyday browsing", speed: "Up to 80Mbps" },
  superfast: { name: "Superfast", tagline: "Streaming & busy homes", speed: "Up to 330Mbps" },
  ultrafast: { name: "Ultrafast", tagline: "Gamers & heavy usage", speed: "Up to 550Mbps" },
  gigabit: { name: "Gigabit", tagline: "Serious speed", speed: "Up to 1Gbps" },
};

const HeroSection = () => {
  const prices = getFromPrices();
  const navigate = useNavigate();
  const { status, result, postcode, selectedAddress, reset } = useAvailability();
  const retailCards = getRetailBroadbandCards();

  const hasResult = status === "success" && result;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
  };

  const benefits = [
    { icon: X, text: "No Contracts" },
    { icon: Shield, text: "No Annual Price Hikes" },
    { icon: Phone, text: "UK-based Support" },
    { icon: Wifi, text: "Openreach Network" },
    { icon: RefreshCcw, text: "Cancel Anytime" },
  ];

  const getSpeedLabel = (speed: number) => speed >= 1000 ? "1Gbps" : `${speed}Mbps`;

  const handleChoosePlan = (planId: string) => {
    navigate(`/broadband?plan=${planId}`);
  };

  // Get retail card info for eligible plans
  const getEligiblePlanCards = () => {
    if (!result) return [];
    return result.eligibleOcctaPlans
      .map(planId => {
        const card = retailCards.find(c => c.id === planId);
        if (!card) return null;
        return {
          id: planId,
          name: card.publicTitle,
          speed: card.maxSpeed,
          speedLabel: card.speedLabel,
          price: card.fromPrice,
          features: card.publicFeatures.slice(0, 3),
          isRecommended: planId === result.recommendedPlan,
          isUpgrade: planId === result.upgradePlan,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Recommended first
        if (a!.isRecommended) return -1;
        if (b!.isRecommended) return 1;
        return 0;
      }) as NonNullable<ReturnType<typeof getEligiblePlanCards>[0]>[];
  };

  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/20 -skew-x-12 translate-x-20 hidden lg:block" />

      {/* Results banner */}
      {hasResult && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-primary/10 border-b-2 border-primary/20">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              Results for: <span className="font-display uppercase">{postcode}</span>
            </p>
            <button onClick={reset} className="text-sm text-primary hover:underline font-medium">
              Change postcode
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 md:px-16 py-12 lg:pt-12 lg:pb-14 relative z-10" style={{ maxWidth: 1440 }}>
        <div className="grid lg:grid-cols-[52fr_48fr] gap-12 items-center">
          {/* ─── LEFT COLUMN ─── */}
          <motion.div className="space-y-5" variants={containerVariants} initial="hidden" animate="visible">
            {/* Eyebrow */}
            <motion.p variants={itemVariants} className="font-display text-[11px] sm:text-xs uppercase tracking-[0.15em] text-muted-foreground">
              No Contracts • No Annual Price Hikes • UK-based Support
            </motion.p>

            {/* Headline */}
            <motion.h1 variants={itemVariants} className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] xl:text-[110px] font-display uppercase leading-[0.9] tracking-tight text-foreground">
              Finally.
              <br />
              Broadband that
              <br />
              <span className="text-gradient">doesn't lock you in.</span>
            </motion.h1>

            {/* Paragraph */}
            <motion.p variants={itemVariants} className="text-lg text-muted-foreground max-w-[620px]">
              No contracts. No annual price hikes. No nonsense. Just fast, reliable broadband from £{prices.broadband}/month.
            </motion.p>

            {/* Value chips */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
              {benefits.map((b, i) => (
                <div
                  key={b.text}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 ${
                    i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 bg-background"
                  }`}
                >
                  <b.icon className="w-3.5 h-3.5" />
                  {b.text}
                </div>
              ))}
            </motion.div>

            {/* Checker */}
            <motion.div variants={itemVariants}>
              <PostcodeChecker variant="hero" />
            </motion.div>

            {/* Left result card */}
            {hasResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 border-4 animate-slide-up max-w-[700px] ${
                  result.available ? "border-success bg-success/10" : "border-destructive bg-destructive/10"
                }`}
              >
                {result.primaryTechnology === "FTTP" ? (
                  <>
                    <p className="font-display text-base uppercase mb-1">
                      Brilliant — Full Fibre is available at your address.
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fastest available speed: up to {getSpeedLabel(result.maxDownload)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.eligibleOcctaPlans.map(id => (
                        <span key={id} className="inline-block text-xs font-bold px-2 py-1 bg-primary/10 text-primary border border-primary/20">
                          {PLAN_LABELS[id]?.name || id}
                        </span>
                      ))}
                    </div>
                  </>
                ) : result.available ? (
                  <>
                    <p className="font-display text-base uppercase mb-1">
                      Good news — Fibre is available at your address.
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fastest available speed: up to {getSpeedLabel(result.maxDownload)}
                    </p>
                    <span className="inline-block text-xs font-bold px-2 py-1 bg-primary/10 text-primary border border-primary/20">
                      Essential
                    </span>
                  </>
                ) : null}
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 border-4 border-destructive bg-destructive/10 max-w-[700px]"
              >
                <p className="font-display text-base uppercase mb-1">
                  We couldn't confirm availability online.
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Call 0800 260 6626 — we'll check instantly and get you connected.
                </p>
                <a href="tel:08002606626">
                  <Button variant="outline" size="sm" className="font-display uppercase">
                    Call 0800 260 6626
                  </Button>
                </a>
              </motion.div>
            )}
          </motion.div>

          {/* ─── RIGHT COLUMN ─── */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            {!hasResult ? (
              /* ── STATE A: Before check ── */
              <motion.div
                variants={itemVariants}
                className="card-brutal bg-card p-6 md:p-8"
                style={{ minHeight: 420 }}
              >
                <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Starting From
                </p>
                <p className="font-display text-5xl text-primary mb-1">
                  £{prices.broadband}<span className="text-lg text-foreground/70">/month</span>
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  No contracts • No annual price hikes
                </p>
                <p className="text-xs text-primary/80 mb-6">
                  Join customers switching away from price rises
                </p>

                {/* Category cues */}
                <div className="space-y-3 mb-6">
                  {[
                    { id: "essential", name: "Essential", tagline: "Everyday browsing" },
                    { id: "superfast", name: "Superfast", tagline: "Streaming & busy homes" },
                    { id: "gigabit", name: "Gigabit", tagline: "Serious speed" },
                  ].map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 border-2 border-foreground/10 bg-background">
                      <span className="font-display text-sm uppercase">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">— {cat.tagline}</span>
                    </div>
                  ))}
                </div>

                {/* Proof rows */}
                <div className="space-y-2 mb-6">
                  {[
                    "Full Fibre where available",
                    "Works on the Openreach network",
                    "UK-based support when you need it",
                  ].map(line => (
                    <p key={line} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {line}
                    </p>
                  ))}
                </div>

                <p className="text-xs text-primary/80 mb-4">
                  Free installation available for a limited time
                </p>

                {/* Bottom strip */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/70 pt-3 border-t border-foreground/10">
                  <span>14-day cooling-off period</span>
                  <span>Keep your number on home phone</span>
                  <span>No mid-contract price rises</span>
                </div>
              </motion.div>
            ) : (
              /* ── STATE B: After result ── */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                    Available at your address
                  </p>
                  {selectedAddress && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {getShortAddress(selectedAddress)}
                    </p>
                  )}
                </div>

                {/* Speed stat */}
                <div className="card-brutal bg-card p-4 flex items-center justify-between">
                  <p className="font-display text-lg uppercase">
                    Up to {getSpeedLabel(result.maxDownload)} available
                  </p>
                  <Wifi className="w-5 h-5 text-primary" />
                </div>

                {/* Eligible plan cards */}
                {getEligiblePlanCards().map(plan => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ x: 4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                    transition={{ duration: 0.12 }}
                    className={`relative card-brutal bg-card p-5 flex flex-col ${
                      plan.isRecommended
                        ? "border-primary border-[5px]"
                        : "border-4 border-foreground"
                    }`}
                  >
                    {plan.isRecommended && (
                      <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Most Popular
                      </div>
                    )}
                    {plan.isUpgrade && (
                      <div className="absolute -top-3 left-3 bg-accent text-accent-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                        Upgrade Option
                      </div>
                    )}

                    <div className={`flex items-start justify-between ${plan.isRecommended ? "pt-2" : ""}`}>
                      <div>
                        <h3 className="font-display text-xl uppercase">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.speedLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-3xl text-primary">£{plan.price}</p>
                        <p className="text-xs text-foreground/70">/month</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 mb-4">
                      {["Unlimited usage", "No contracts", "Free router"].map(f => (
                        <span key={f} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="w-3 h-3 text-primary" />
                          {f}
                        </span>
                      ))}
                    </div>

                    <Button
                      variant={plan.isRecommended ? "hero" : "outline"}
                      className="w-full font-display uppercase"
                      onClick={() => handleChoosePlan(plan.id)}
                    >
                      Choose Plan
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                ))}

                {/* Bottom line */}
                <p className="text-center text-xs text-muted-foreground pt-2">
                  No annual price hikes • Cancel anytime
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
