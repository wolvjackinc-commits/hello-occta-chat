import { motion } from "framer-motion";
import { ArrowRight, Check, Shield, Wifi, Phone, RefreshCcw, Star, ChevronRight, Loader2, Lock, Receipt, Info, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getFromPrices, getRetailBroadbandCards } from "@/lib/pricing/engine";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { useAvailability, getShortAddress, getAddressLabel } from "@/contexts/AvailabilityContext";
import { startAssignedJourney } from "@/lib/journey2/route";

const HeroSection = () => {
  const prices = getFromPrices();
  const navigate = useNavigate();
  const { status, result, postcode, selectedAddress, addresses, errorType, reset, selectAddress, triggerFallback } = useAvailability();
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
    { icon: Lock, text: "Price Lock 24" },
    { icon: RefreshCcw, text: "Flex 30 where eligible" },
    { icon: Shield, text: "No confusing mid-contract rises on Price Lock" },
    { icon: Receipt, text: "Estimated price before order" },
    { icon: Phone, text: "UK-based support" },
  ];

  const getSpeedLabel = (speed: number) => speed >= 1000 ? "1Gbps" : `${speed}Mbps`;

  const handleChoosePlan = (planId: string) => {
    startAssignedJourney((path) => navigate(path));
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
    // Show ALL eligible plans (user can pick any to skip step 1 in /build-plan).
    return cards;
  };

  const inlineConfirmation = hasResult ? (
    result.primaryTechnology === "FTTP"
      ? "Full Fibre appears available at your address"
      : result.available
        ? "Broadband options found for your address"
        : null
  ) : null;

  // Determine right panel state — addresses now render in the right panel
  // so customers don't need to scroll under the hero on small viewports.
  const isAddressSelect = status === "addresses" && addresses.length > 0;
  const isLoadingPostcode = status === "loading-postcode";
  const isCheckingAddress = status === "checking-address";
  const isLoadingState = isLoadingPostcode || isCheckingAddress;

  return (
    <section className="relative flex items-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/20 -skew-x-12 translate-x-20 hidden lg:block" />

      <div className="container mx-auto px-4 sm:px-6 md:px-12 py-6 lg:pt-8 lg:pb-10 relative z-10" style={{ maxWidth: 1440 }}>
        <div className="grid lg:grid-cols-[52fr_48fr] gap-5 lg:gap-10 items-start">
          {/* ─── LEFT COLUMN ─── */}
          <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
            <motion.p variants={itemVariants} className="font-display text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Price Lock 24 • Flex 30 • Clear Estimated Price • UK-based Support
            </motion.p>

            {/* H1 renders without motion opacity fade so it paints immediately as the LCP element */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[72px] xl:text-[88px] font-display uppercase leading-[0.9] tracking-tight text-gradient">
              '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            CHECK THE FULL WEBSITE MAKE SURE EVERYTHING WORKING PROPERLY.
            </h1>

            <motion.p variants={itemVariants} className="text-base text-muted-foreground max-w-[580px]">
              Choose Price Lock 24 for a fixed monthly broadband price for the agreed term, or Flex 30 where available. See your first bill before you order.
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
              <PostcodeChecker variant="hero" externalAddressSelect />
            </motion.div>

            <motion.div variants={itemVariants} className="mt-2">
              <Link
                to="/order"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <FileText className="w-3.5 h-3.5" />
                Start your order — review everything before confirming
              </Link>
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

            {status === "error" && errorType === "invalid-postcode" && (
              <p className="text-sm text-destructive">That doesn't look like a proper postcode — please check and try again.</p>
            )}
          </motion.div>

          {/* ─── RIGHT COLUMN — state-driven panel replacement ─── */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="lg:sticky lg:top-24 self-start">

            {/* LOADING STATE — shown in right panel so left column stays put */}
            {isLoadingState && (
              <motion.div
                key="loading-right"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-6 flex flex-col items-center justify-center min-h-[320px]"
              >
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                <p className="font-display text-sm uppercase tracking-wider text-foreground">
                  {isLoadingPostcode ? "Checking your address…" : "Finding available speeds…"}
                </p>
              </motion.div>
            )}

            {/* ADDRESS SELECT — right panel so customers don't scroll down */}
            {isAddressSelect && (
              <motion.div
                key="addresses-right"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-5 max-h-[calc(100vh-7rem)] flex flex-col"
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
                  <button onClick={reset} className="text-[11px] text-primary hover:underline font-medium whitespace-nowrap">
                    Change postcode
                  </button>
                </div>
                <div className="border-4 border-foreground bg-background flex-1 min-h-[220px] max-h-[min(52vh,430px)] overflow-y-auto">
                  {addresses.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectAddress(addr)}
                      aria-label={`Select address ${getAddressLabel(addr)}`}
                      className="w-full text-left px-4 py-3.5 hover:bg-primary/10 transition-colors border-b-2 border-foreground/10 last:border-b-0 flex items-center justify-between gap-3 group"
                    >
                      <span className="text-sm sm:text-base font-medium leading-snug text-foreground">{getAddressLabel(addr)}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Select the exact property first — plans will appear here in this same panel.
                </p>
              </motion.div>
            )}

            {/* RESULT STATE — personalised plans stay in the same right-hand frame */}
            {hasResult && (
              <motion.div
                key="results-right"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="card-brutal bg-card p-4 sm:p-5 max-h-[calc(100vh-7rem)] overflow-y-auto"
              >
                <div className="flex items-start justify-between mb-2 gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-sm uppercase tracking-wider text-foreground">
                      Available at your address
                    </p>
                    {selectedAddress && (
                      <p className="text-xs text-muted-foreground truncate max-w-[360px]">
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

                <div className="flex items-center justify-between py-2 px-3 border-4 border-foreground bg-background mb-3">
                  <p className="font-display text-sm uppercase">
                    Up to {getSpeedLabel(result.maxDownload)} available
                  </p>
                  <Wifi className="w-4 h-4 text-primary" />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {getHeroPlanCards().map(plan => (
                    <div
                      key={plan.id}
                      className={`relative p-3.5 ${
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

                      <div className={`flex items-start justify-between gap-2 ${plan.isRecommended ? "pt-1" : ""}`}>
                        <div className="min-w-0">
                          <h2 className="font-sans text-sm sm:text-base font-bold tracking-tight leading-tight">{plan.name}</h2>
                          <p className="text-xs text-muted-foreground">{plan.speedLabel}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-display text-2xl text-primary leading-none">£{plan.price}</p>
                          <p className="text-[10px] text-foreground">/month</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 mb-3">
                        {["Unlimited usage", "Price Lock or Flex 30", "Bring your own router"].map(f => (
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

                <p className="text-center text-[10px] text-muted-foreground pt-3">
                  Estimated base prices shown now • addons update your estimate during the journey
                </p>
              </motion.div>
            )}

            {/* ERROR / FALLBACK STATE — right panel */}
            {status === "error" && errorType !== "invalid-postcode" && (
              <motion.div
                key="error-right"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-5"
              >
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display uppercase text-sm tracking-wider">Broadband options available to view</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We couldn't confirm live availability online right now, but you can still choose the plan you're interested in. We'll confirm the final availability, speed, setup and price before you order.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    triggerFallback(postcode);
                    navigate(`/order`);
                  }}
                  size="lg"
                  className="mt-4 w-full h-12 font-display uppercase tracking-wider"
                >
                  View plans <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Prefer to speak to us? <a href="tel:08002606626" className="underline font-medium">Call 0800 260 6626</a>.
                </p>
              </motion.div>
            )}

            {/* IDLE / DEFAULT STATE — price anchor card */}
            {!isAddressSelect && !isLoadingState && !hasResult && status !== "error" && (
              <motion.div
                key="idle"
                variants={itemVariants}
                className="card-brutal bg-card p-4 sm:p-5 md:p-6"
              >
                <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground mb-1 sm:mb-2">
                  FROM
                </p>
                <p className="font-display text-4xl sm:text-5xl md:text-6xl text-primary leading-none">
                  £{prices.broadband}
                </p>
                <p className="font-display text-sm sm:text-base font-semibold text-foreground mt-1">
                  /month
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 mb-1">
                  *Subject to availability at your address
                </p>
                <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">
                  Price Lock 24 or Flex 30 • Final price confirmed before order
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mb-3 sm:mb-4">
                  Join customers switching away from price rises
                </p>

                <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                  {[
                    { name: "Essential", tagline: "Everyday browsing" },
                    { name: "Superfast", tagline: "Streaming & busy homes" },
                    { name: "Ultrafast", tagline: "Serious speed" },
                  ].map(cat => (
                     <div key={cat.name} className="flex items-center gap-3 px-3 py-2 border-2 border-foreground/15 bg-background">
                       <span className="font-sans text-sm uppercase font-extrabold tracking-wide text-foreground min-w-[78px]">{cat.name}</span>
                       <span className="text-xs sm:text-sm text-foreground/75 font-medium">— {cat.tagline}</span>
                     </div>
                  ))}
                </div>

                <div className="space-y-1.5 sm:space-y-2.5 mb-3 sm:mb-4">
                  {[
                    "Full Fibre where available",
                    "Works on the Openreach network",
                    "UK-based support when you need it",
                    "Installation costs (if any) shown in your Contract Summary",
                  ].map(line => (
                    <p key={line} className="flex items-center gap-2 sm:gap-2.5 text-[13px] sm:text-[15px] font-semibold text-foreground">
                      <Check className="w-4 sm:w-[18px] h-4 sm:h-[18px] text-primary flex-shrink-0" />
                      {line}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs text-muted-foreground pt-2 border-t border-foreground/20">
                  <span>14-day cooling-off period</span>
                  <span>Keep your number with Digital Voice</span>
                  <span>No confusing mid-contract rises on Price Lock</span>
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
