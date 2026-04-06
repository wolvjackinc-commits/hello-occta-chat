import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Wifi, Phone, X, RefreshCcw, Star, ChevronRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getFromPrices, getRetailBroadbandCards } from "@/lib/pricing/engine";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { useAvailability, getShortAddress, getAddressLabel } from "@/contexts/AvailabilityContext";

const HeroSection = () => {
  const prices = getFromPrices();
  const navigate = useNavigate();
  const { status, result, postcode, selectedAddress, addresses, reset, selectAddress } = useAvailability();
  const retailCards = getRetailBroadbandCards();

  const hasResult = status === "success" && result;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
  };

  const benefits = [
    { icon: X, text: "No Contracts" },
    { icon: Shield, text: "No Price Hikes" },
    { icon: Phone, text: "UK Support" },
    { icon: Wifi, text: "Openreach" },
    { icon: RefreshCcw, text: "Cancel Anytime" },
  ];

  const getSpeedLabel = (speed: number) => speed >= 1000 ? "1Gbps" : `${speed}Mbps`;

  const handleChoosePlan = (planId: string) => {
    navigate(`/broadband?plan=${planId}`);
  };

  const getHeroPlanCards = () => {
    if (!result) return [];
    const cards = result.eligibleOcctaPlans
      .map(planId => {
        const card = retailCards.find(c => c.id === planId);
        if (!card) return null;
        return {
          id: planId,
          name: card.publicTitle,
          speed: card.maxSpeed,
          speedLabel: card.speedLabel,
          price: card.fromPrice,
          isRecommended: planId === result.recommendedPlan,
          isUpgrade: planId === result.upgradePlan,
        };
      })
      .filter(Boolean) as {
        id: string; name: string; speed: number; speedLabel: string;
        price: string | number; isRecommended: boolean; isUpgrade: boolean;
      }[];

    const recommended = cards.find(c => c.isRecommended);
    const upgrade = cards.find(c => c.isUpgrade);
    const out: typeof cards = [];
    if (recommended) out.push(recommended);
    if (upgrade) out.push(upgrade);
    if (out.length === 0 && cards.length > 0) out.push(cards[0]);
    return out;
  };

  const inlineConfirmation = hasResult ? (
    result.primaryTechnology === "FTTP"
      ? "Full Fibre available at your address"
      : result.available
        ? "Fibre available at your address"
        : null
  ) : null;

  // Determine right panel state
  const isAddressSelect = status === "addresses" && addresses.length > 0;
  const isLoadingPostcode = status === "loading-postcode";
  const isCheckingAddress = status === "checking-address";
  const isLoadingState = isLoadingPostcode || isCheckingAddress;

  return (
    <section className="relative flex items-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/20 -skew-x-12 translate-x-20 hidden lg:block" />

      <div className="container mx-auto px-6 md:px-12 py-8 lg:pt-8 lg:pb-10 relative z-10" style={{ maxWidth: 1440 }}>
        <div className="grid lg:grid-cols-[52fr_48fr] gap-8 lg:gap-10 items-start">
          {/* ─── LEFT COLUMN ─── */}
          <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
            <motion.p variants={itemVariants} className="font-display text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              No Contracts • No Annual Price Hikes • UK-based Support
            </motion.p>

            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] xl:text-[88px] font-display uppercase leading-[0.9] tracking-tight text-foreground">
              Finally.
              <br />
              Broadband that
              <br />
              <span className="text-gradient">doesn't lock you in.</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-base text-muted-foreground max-w-[580px]">
              No contracts. No annual price hikes. No nonsense. Just fast, reliable broadband from £{prices.broadband}/month.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5">
              {benefits.map((b, i) => (
                <div
                  key={b.text}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium border-2 ${
                    i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 bg-background"
                  }`}
                >
                  <b.icon className="w-3 h-3" />
                  {b.text}
                </div>
              ))}
            </motion.div>

            {/* Checker — always visible */}
            <motion.div variants={itemVariants}>
              <PostcodeChecker variant="hero" />
            </motion.div>

            {/* Compact inline confirmation */}
            {hasResult && inlineConfirmation && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm font-medium text-success"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                {inlineConfirmation}
              </motion.p>
            )}

            {/* Error state */}
            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border-4 border-destructive bg-destructive/10 max-w-[600px]"
              >
                <p className="font-display text-sm uppercase mb-1">
                  We couldn't confirm availability online.
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Call 0800 260 6626 — we'll check instantly and get you connected.
                </p>
                <a href="tel:08002606626">
                  <Button variant="outline" size="sm" className="font-display uppercase text-xs">
                    Call 0800 260 6626
                  </Button>
                </a>
              </motion.div>
            )}
          </motion.div>

          {/* ─── RIGHT COLUMN — state-driven panel replacement ─── */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible">

            {/* LOADING STATE — replaces right panel while checking */}
            {isLoadingState && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-6 md:p-8 flex flex-col items-center justify-center min-h-[320px]"
              >
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="font-display text-sm uppercase tracking-wider text-foreground">
                  {isLoadingPostcode ? "Checking your address…" : "Finding the fastest available speeds…"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">This only takes a moment</p>
              </motion.div>
            )}

            {/* ADDRESS SELECT STATE — replaces right panel with address list */}
            {isAddressSelect && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-5 md:p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-display text-sm uppercase tracking-wider text-foreground">
                      Select your address
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {addresses.length} addresses found for {postcode}
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    className="text-[11px] text-primary hover:underline font-medium whitespace-nowrap"
                  >
                    Change postcode
                  </button>
                </div>

                <div className="border-2 border-foreground/10 overflow-hidden">
                  <div className="max-h-[340px] overflow-y-auto">
                    {addresses.map((addr, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectAddress(addr)}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-foreground/5 last:border-b-0 flex items-center justify-between gap-2 group"
                      >
                        <span className="text-sm font-medium">{getAddressLabel(addr)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  We'll only show plans actually available at your address.
                </p>
              </motion.div>
            )}

            {/* RESULT STATE — personalised plans */}
            {hasResult && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="card-brutal bg-card p-5 md:p-6"
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                      Available at your address
                    </p>
                    {selectedAddress && (
                      <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                        {getShortAddress(selectedAddress)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={reset}
                    className="text-[11px] text-primary hover:underline font-medium whitespace-nowrap mt-0.5"
                  >
                    Change postcode
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 px-3 border-2 border-foreground/10 bg-background mb-3">
                  <p className="font-display text-sm uppercase">
                    Up to {getSpeedLabel(result.maxDownload)} available
                  </p>
                  <Wifi className="w-4 h-4 text-primary" />
                </div>

                <div className="space-y-3">
                  {getHeroPlanCards().map(plan => (
                    <div
                      key={plan.id}
                      className={`relative p-4 ${
                        plan.isRecommended
                          ? "border-[4px] border-primary"
                          : "border-2 border-foreground/20"
                      }`}
                    >
                      {plan.isRecommended && (
                        <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground px-2 py-0.5 font-display uppercase tracking-wider text-[10px] border border-foreground flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" />
                          Most Popular
                        </div>
                      )}
                      {plan.isUpgrade && !plan.isRecommended && (
                        <div className="absolute -top-2.5 left-3 bg-accent text-accent-foreground px-2 py-0.5 font-display uppercase tracking-wider text-[10px] border border-foreground">
                          Upgrade Option
                        </div>
                      )}

                      <div className={`flex items-start justify-between ${plan.isRecommended ? "pt-1" : ""}`}>
                        <div>
                          <h3 className="font-display text-lg uppercase leading-tight">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">{plan.speedLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl text-primary leading-none">£{plan.price}</p>
                          <p className="text-[10px] text-foreground/70">/month</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 mb-3">
                        {["Unlimited usage", "No contracts", "Free router"].map(f => (
                          <span key={f} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Check className="w-2.5 h-2.5 text-primary" />
                            {f}
                          </span>
                        ))}
                      </div>

                      <Button
                        variant={plan.isRecommended ? "hero" : "outline"}
                        size="sm"
                        className="w-full font-display uppercase text-xs"
                        onClick={() => handleChoosePlan(plan.id)}
                      >
                        Choose Plan
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-3">
                  <Link
                    to="/broadband"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View all available plans →
                  </Link>
                </div>

                <p className="text-center text-[10px] text-muted-foreground pt-2">
                  No annual price hikes • Cancel anytime
                </p>
              </motion.div>
            )}

            {/* IDLE / DEFAULT STATE — price anchor card */}
            {!hasResult && !isAddressSelect && !isLoadingState && status !== "error" && (
              <motion.div
                key="idle"
                variants={itemVariants}
                className="card-brutal bg-card p-5 md:p-6"
              >
                <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  FROM
                </p>
                <p className="font-display text-5xl md:text-6xl text-primary leading-none">
                  £{prices.broadband}
                </p>
                <p className="font-display text-base font-semibold text-foreground mt-1">
                  /month
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1.5 mb-1">
                  *Subject to availability at your address
                </p>
                <p className="text-sm font-semibold text-foreground mb-1">
                  No contracts • No annual price hikes
                </p>
                <p className="text-xs text-primary font-medium mb-4">
                  Join customers switching away from price rises
                </p>

                <div className="space-y-2 mb-4">
                  {[
                    { name: "Essential", tagline: "Everyday browsing" },
                    { name: "Superfast", tagline: "Streaming & busy homes" },
                    { name: "Gigabit", tagline: "Serious speed" },
                  ].map(cat => (
                    <div key={cat.name} className="flex items-center gap-3 px-3 py-2 border-2 border-foreground/10 bg-background">
                      <span className="font-display text-xs uppercase font-bold">{cat.name}</span>
                      <span className="text-[11px] text-foreground/70 font-medium">— {cat.tagline}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 mb-4">
                  {[
                    "Full Fibre where available",
                    "Works on the Openreach network",
                    "UK-based support when you need it",
                    "Free installation (limited time)",
                  ].map(line => (
                    <p key={line} className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
                      <Check className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                      {line}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground/70 pt-2 border-t border-foreground/10">
                  <span>14-day cooling-off period</span>
                  <span>Keep your number on home phone</span>
                  <span>No mid-contract price rises</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
