import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Wifi, Star, ChevronRight, Lock, Info, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getFromPrices, getRetailBroadbandCards } from "@/lib/pricing/engine";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import { useAvailability, getShortAddress, getAddressLabel } from "@/contexts/AvailabilityContext";
import { prewarmAssignedJourney } from "@/lib/journey2/route";
import { setPreferredSpeedBucket } from "@/lib/journey2/prefill";
import OcctaLoader from "@/components/loading/OcctaLoader";
import SignalField from "@/components/brand/SignalField";

const HeroSection = () => {
  const prices = getFromPrices();
  const navigate = useNavigate();
  const { status, result, postcode, selectedAddress, addresses, errorType, errorMessage, reset, selectAddress, triggerFallback } = useAvailability();
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

  const proofPoints = [
    { value: "24", suffix: "mo", label: "Fixed monthly price on Price Lock 24 for the agreed term" },
    { value: "30", suffix: "day", label: "Rolling Flex 30 plans, where eligible" },
    { value: "£0", suffix: "", label: "In confusing mid-contract rises on Price Lock" },
    { value: "14", suffix: "day", label: "Cooling-off period, plus an estimated price before you order" },
  ];

  const getSpeedLabel = (speed: number) => speed >= 1000 ? "1Gbps" : `${speed}Mbps`;

  useEffect(() => {
    if (!hasResult || !selectedAddress) return;
    // Start the secure order-session request while the customer is reading the
    // plan cards, and preload the small /order entry chunk. The later button
    // click can therefore change route immediately.
    prewarmAssignedJourney();
    void import("@/pages/order/OrderStart");
  }, [hasResult, selectedAddress]);

  const handleChoosePlan = (planId: string) => {
    setPreferredSpeedBucket(planId);
    prewarmAssignedJourney();
    navigate("/order");
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
    // Show all OCCTA bands returned by the plan-list service. Final address and
    // supplier availability is explicitly validated later in the order flow.
    return cards;
  };

  const inlineConfirmation = hasResult && selectedAddress
    ? "Address selected — choose the OCCTA plan you're interested in"
    : null;

  // Determine right panel state — addresses now render in the right panel
  // so customers don't need to scroll under the hero on small viewports.
  const isAddressSelect = status === "addresses" && addresses.length > 0;
  const isLoadingPostcode = status === "loading-postcode";
  const isCheckingAddress = status === "checking-address";
  const isLoadingState = isLoadingPostcode || isCheckingAddress;
  const showAddressRecovery = status === "error" && !selectedAddress &&
    (errorType === "no-addresses" || errorType === "backend-unavailable");

  return (
    // `dark` flips the design tokens for everything inside the hero (checker,
    // address list, loader, plan cards) so the stage reads as one black poster.
    <section className="dark hero-stage occ-grain relative overflow-clip bg-background text-foreground border-b-4 border-primary">
      <SignalField />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-0 hidden lg:block font-display text-[34rem] leading-[0.8] text-white/[0.025] select-none">
        24
      </div>

      <div className="container mx-auto px-4 sm:px-6 md:px-12 pt-8 pb-0 lg:pt-10 relative z-10" style={{ maxWidth: 1440 }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px] gap-12 xl:gap-20 items-start">
          {/* ─── LEFT COLUMN ─── */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.p
              variants={itemVariants}
              className="inline-flex items-center gap-2.5 border border-white/20 bg-white/[0.04] px-3 py-1.5 font-sans text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.2em] text-white/80 whitespace-nowrap"
            >
              <span className="relative flex h-2 w-2">
                <span className="hero-pulse absolute inline-flex h-full w-full animate-ping bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 bg-primary" />
              </span>
              Price Lock 24 · Flex 30 · UK-based support
            </motion.p>

            {/* H1 renders without motion opacity fade so it paints immediately as the LCP element */}
            <h1 className="mt-5 font-display uppercase text-white leading-[0.86] tracking-[-0.01em] text-[3.25rem] sm:text-[4.5rem] lg:text-[3.6rem] xl:text-[5rem] min-[1400px]:text-[5.75rem]">
              <span className="block text-[hsl(var(--primary))]">Finally.</span>
              {/* Lines are fixed from sm up; on phones the words reflow so "the" never strands */}
              <span className="sm:block">Broadband without the</span>{" "}
              <span className="sm:block">
                <span className="hero-strike text-white/55">price-rise</span> nonsense.
              </span>
            </h1>

            <motion.p variants={itemVariants} className="mt-5 text-lg leading-relaxed text-white/70 max-w-[560px]">
              Price Lock 24 fixes your monthly price for the agreed term. Prefer freedom? Flex 30 rolls monthly where available.{" "}
              <span className="text-white font-medium">Either way, you see your first bill before you order.</span>
            </motion.p>

            {/* Checker — always visible */}
            <motion.div variants={itemVariants} className="mt-7">
              <PostcodeChecker variant="hero" externalAddressSelect />
            </motion.div>

            <motion.div variants={itemVariants} className="mt-5">
              <Link
                to="/order"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[hsl(var(--primary))] transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="underline decoration-white/30 underline-offset-4 group-hover:decoration-[hsl(var(--primary))]">
                  Start your order — review everything before confirming
                </span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Compact inline confirmation */}
            {hasResult && inlineConfirmation && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-sm font-medium text-[hsl(145_70%_55%)]"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                {inlineConfirmation}
              </motion.p>
            )}

            {status === "error" && errorType === "invalid-postcode" && (
              <p className="mt-4 text-sm font-medium text-[hsl(0_90%_68%)]">That doesn't look like a proper postcode — please check and try again.</p>
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
                className="card-brutal bg-card min-h-[320px]"
              >
                <OcctaLoader
                  context={isLoadingPostcode ? "address" : "availability"}
                  className="w-full"
                />
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
                  Select the exact property first — OCCTA plan options will appear here in this same panel.
                </p>
              </motion.div>
            )}

            {/* If the postcode provider is slow/incomplete, keep the customer in the
                same panel and fall back to the already-live full-address search. */}
            {showAddressRecovery && (
              <motion.div
                key="address-recovery-right"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-display text-sm uppercase tracking-wider text-foreground">Find your full address</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {errorMessage || "We couldn't load a complete property list for that postcode."}
                    </p>
                  </div>
                  <button onClick={reset} className="text-[11px] text-primary hover:underline font-medium whitespace-nowrap">
                    Change postcode
                  </button>
                </div>

                <AddressAutocomplete
                  expectedPostcode={postcode}
                  autoFocus
                  label="Search house number or street"
                  helperText={`Start typing house number and street, e.g. 22 Pavilion View. We'll only show addresses in ${postcode}.`}
                  onSelect={(addr) => {
                    if (!addr.line1.trim()) {
                      triggerFallback(postcode);
                      navigate("/order");
                      return;
                    }
                    selectAddress({
                      premises_name: addr.line1,
                      sub_premises: addr.line2,
                      post_town: addr.city,
                      postcode: addr.postcode || postcode,
                      formatted_address: [addr.line1, addr.line2, addr.city, addr.postcode || postcode].filter(Boolean).join(", "),
                    });
                  }}
                />

                <div className="mt-4 pt-3 border-t-2 border-foreground/10 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <p className="text-xs text-muted-foreground">Still can't find it? You can enter the address during the order.</p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerFallback(postcode);
                      navigate("/order");
                    }}
                    className="text-xs text-primary hover:underline font-medium text-left sm:text-right"
                  >
                    Enter manually
                  </button>
                </div>
              </motion.div>
            )}

            {/* RESULT STATE — personalised plan list stays in the same right-hand frame */}
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
                      {result.pendingNetworkValidation ? "Current OCCTA plans" : "OCCTA plans for your address"}
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
                    {result.pendingNetworkValidation ? "Current OCCTA speed bands" : <>Speed bands shown up to {getSpeedLabel(result.maxDownload)}</>}
                  </p>
                  <Wifi className="w-4 h-4 text-primary" />
                </div>
                {result.pendingNetworkValidation && (
                  <p className="text-xs text-muted-foreground mb-3">
                    You can continue your order now. Speeds shown are OCCTA plan estimates. Final network technology, availability and actual line performance are confirmed during provisioning.
                  </p>
                )}

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

                <p className="text-center text-[10px] leading-relaxed text-muted-foreground pt-3">
                  Prices shown are OCCTA plan prices. Final network/supplier availability, speed and technology are validated before provisioning. We won't substitute a different plan or price without your agreement.
                </p>
              </motion.div>
            )}

            {/* ERROR / FALLBACK STATE — right panel */}
            {status === "error" && errorType !== "invalid-postcode" && !showAddressRecovery && (
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
                      We couldn't confirm live availability online right now, but you can still choose the plan you're interested in. Final network/supplier availability is validated before provisioning and any different option requires your agreement.
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
              <motion.div key="idle" variants={itemVariants} className="relative">
                {/* Offset yellow slab — the card sits on it like a printed ticket */}
                <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 bg-primary" />

                <div className="relative border-[3px] border-white bg-[hsl(0_0%_8%)]">
                  {/* Ticket top: the price, and proof it doesn't move */}
                  <div className="bg-primary text-black px-5 pt-5 pb-6 sm:px-7 sm:pt-6 border-b-[3px] border-white">
                    <div className="flex items-center justify-between gap-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em]">
                      <span>Price Lock 24</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Fixed for the term
                      </span>
                    </div>

                    <div className="mt-4 flex items-end gap-2">
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.18em] pb-3 sm:pb-4">From</span>
                      <span className="font-display text-[5.5rem] sm:text-[6.5rem] leading-[0.78]">£{prices.broadband}</span>
                      <span className="font-display text-2xl pb-1.5 sm:pb-2">/mo</span>
                    </div>

                    <div className="mt-6">
                      <div className="flex h-12 items-end gap-[3px] border-t-2 border-dashed border-black/60 pt-0" aria-hidden>
                        {Array.from({ length: 24 }, (_, i) => (
                          <span
                            key={i}
                            className="hero-bar flex-1 h-full bg-black"
                            style={{ animationDelay: `${450 + i * 28}ms` }}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 whitespace-nowrap font-sans text-[10px] font-bold uppercase tracking-[0.06em] sm:tracking-[0.16em]">
                        <span>Month 1</span>
                        <span className="text-black/70">Same price, every month</span>
                        <span>Month 24</span>
                      </div>
                    </div>
                  </div>

                  {/* Speed bands */}
                  <div className="px-5 py-5 sm:px-7 sm:py-6">
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55 mb-3">
                      Choose your OCCTA speed band
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: "Essential", speed: 80 },
                        { name: "Superfast", speed: 330 },
                        { name: "Ultrafast", speed: 550 },
                        { name: "Gigabit", speed: 1000 },
                      ].map(band => (
                        <div key={band.name} className="border border-white/15 bg-white/[0.03] px-3 py-3">
                          <p className="font-display text-xl leading-none text-white tracking-wide">{band.name}</p>
                          <p className="mt-1 text-xs text-white/60">Up to {band.speed}Mbps</p>
                          <div className="mt-2.5 h-1 bg-white/10" aria-hidden>
                            <div className="h-full bg-primary" style={{ width: `${Math.max(band.speed / 10, 6)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {[
                        "Full Fibre where available",
                        "Installation costs (if any) shown in your Contract Summary",
                        "Keep your number with Digital Voice where porting is available",
                      ].map(line => (
                        <p key={line} className="flex items-start gap-2 text-[13px] font-medium text-white/85">
                          <Check className="w-4 h-4 mt-0.5 text-[hsl(var(--primary))] flex-shrink-0" />
                          {line}
                        </p>
                      ))}
                    </div>

                    <p className="mt-4 pt-3 border-t border-white/10 text-[11px] leading-relaxed text-white/45">
                      *Plan and service availability varies by address. Network and technology depend on your address. Price Lock 24 or Flex 30 — contractual price shown before acceptance.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ─── PROOF BAND — the promise in four numbers ─── */}
        <motion.dl
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-14 lg:mt-20 grid grid-cols-2 lg:grid-cols-4 border-t border-white/15"
        >
          {proofPoints.map((p, i) => (
            <motion.div
              key={p.label}
              variants={itemVariants}
              className={`py-6 lg:py-8 pr-4 ${i % 2 === 1 ? "pl-4 border-l border-white/15" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-white/15" : ""} ${i === 2 ? "lg:pl-4 lg:border-l" : ""} ${i > 0 ? "lg:pl-6" : ""}`}
            >
              <dt className="font-display text-5xl lg:text-6xl leading-none text-white">
                {p.value}
                <span className="ml-1 text-2xl lg:text-3xl text-[hsl(var(--primary))]">{p.suffix}</span>
              </dt>
              <dd className="mt-2 text-sm text-white/60 max-w-[220px]">{p.label}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
};

export default HeroSection;