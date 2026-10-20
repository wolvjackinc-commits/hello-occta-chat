import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import OcctaLoader from "@/components/loading/OcctaLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Wifi, Shield, Clock, ArrowRight, X, PhoneCall, Phone, Star, ChevronRight } from "lucide-react";
import { broadbandPlans, landlinePlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema, createBreadcrumbSchema, createFAQSchema } from "@/components/seo";
import { EmergencyCallNote } from "@/components/legal/EmergencyCallNote";
import { getFromPrices } from "@/lib/pricing/engine";
import { AvailabilityProvider, useAvailability, getAddressLabel, getShortAddress } from "@/contexts/AvailabilityContext";
import { startAssignedJourney } from "@/lib/journey2/route";
import { setPreferredSpeedBucket } from "@/lib/journey2/prefill";
import { BrandSection, HeroKicker, HeroTitle, NumberedLinkList, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { revealItem, revealParent } from "@/components/brand/motion";
import { RouterArt, VoiceArt } from "@/components/brand/illustrations";

const BroadbandInner = () => {
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [selectedBroadbandPlanId, setSelectedBroadbandPlanId] = useState<string | null>(null);
  const [selectedCallPlans, setSelectedCallPlans] = useState<string[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, result, postcode, reset, addresses, selectedAddress, selectAddress } = useAvailability();
  
  // Auto-trigger voice dialog if coming from homepage with plan param
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam) {
      const matchingPlan = broadbandPlans.find(p => p.id === `broadband-${planParam}` || p.id === planParam);
      if (matchingPlan) {
        setSelectedBroadbandPlanId(matchingPlan.id);
        setSelectedCallPlans([]);
        setShowVoiceDialog(true);
      }
    }
  }, [searchParams]);

  const { isAppMode } = useAppMode();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
  };

  const features = [
    { icon: X, text: "30-Day Rolling Where Eligible" },
    { icon: Shield, text: "Clear Contract Terms" },
    { icon: Clock, text: "Setup Shown Before Acceptance" },
  ];

  const LayoutComponent = isAppMode ? AppLayout : Layout;

  const voicePlan = landlinePlans[0];
  const callPlanOptions = [
    { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", price: 3, label: "+£3/mo", description: "Unlimited calls to UK landlines & mobiles" },
    { id: "addon-intl-calls-pack", name: "International Calls", price: 5, label: "+£5/mo", description: "300 mins to 50+ countries" },
  ];

  const handleChoosePlan = (planId: string) => {
    const speedBucket = planId.replace("broadband-", "");
    setPreferredSpeedBucket(speedBucket);
    startAssignedJourney((path) => navigate(path));
  };

  const toggleCallPlan = (id: string) => {
    setSelectedCallPlans(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddVoice = () => {
    const addons = selectedCallPlans.length > 0 ? `&addons=${selectedCallPlans.join(",")}` : "";
    navigate(`/pre-checkout?plans=${selectedBroadbandPlanId},${voicePlan.id}${addons}`);
    setShowVoiceDialog(false);
  };

  const handleSkipVoice = () => {
    navigate(`/pre-checkout?plans=${selectedBroadbandPlanId}`);
    setShowVoiceDialog(false);
  };

  const voiceTotal = voicePlan.priceNum + callPlanOptions.filter(cp => selectedCallPlans.includes(cp.id)).reduce((s, cp) => s + cp.price, 0);

  // The public page intentionally shows every current OCCTA speed band. The
  // address check can suggest a band, but final network/supplier availability
  // is validated before provisioning and never used to silently substitute a
  // different product or price.
  const hasPersonalisedResult = status === "success" && !!result;
  const displayedPlans = broadbandPlans;

  const broadbandServiceSchema = createServiceSchema({
    name: 'OCCTA Broadband',
    description: 'OCCTA broadband speed bands up to 1000Mbps. Price Lock 24 or Flex 30 where offered, subject to final service availability at the installation address.',
    url: '/broadband',
    price: getFromPrices().broadband,
  });

  const planOfferSchemas = broadbandPlans.map(plan => createOfferSchema({
    name: `OCCTA ${plan.name}`,
    description: `Broadband speed band up to ${plan.speed}Mbps. Price Lock 24 or Flex 30 where offered. Final network and supplier availability is validated before provisioning. ${plan.features.slice(0, 3).join(', ')}.`,
    price: plan.price.toString(),
    url: `/broadband`,
    sku: plan.id,
    category: 'Broadband',
  }));

  const combinedSchemas = {
    '@context': 'https://schema.org',
    '@graph': [
      broadbandServiceSchema,
      ...planOfferSchemas,
      createBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Broadband', url: '/broadband' },
      ]),
      createFAQSchema([
        { question: 'How fast is OCCTA broadband?', answer: 'OCCTA displays speed bands up to 1000Mbps. The service, technology and achievable speed depend on the installation address and are validated before provisioning.' },
        { question: 'Is there a contract?', answer: 'OCCTA supports Flex 30 and Price Lock 24 options where offered. The Contract Summary and Contract Information you review before acceptance are the binding source of truth for your order.' },
        { question: 'When does billing start?', answer: 'Billing starts only after your service is confirmed active. The first invoice can include agreed setup, activation, router or pro-rata charges shown in your order documents.' },
        { question: 'Do I need a phone line?', answer: 'No separate traditional phone line is required for full-fibre broadband. If you want a home phone, OCCTA Digital Voice is an optional broadband-based service where available.' },
      ]),
    ],
  };

  return (
    <LayoutComponent>
      <SEO 
        title="Affordable Broadband UK - Flexible Fibre & Price Lock"
        description={`OCCTA broadband from £${getFromPrices().broadband}/mo with Essential, Superfast, Ultrafast and Gigabit speed bands. Price Lock 24 or Flex 30 where offered. Final service availability validated before provisioning.`}
        canonical="/broadband"
        keywords="affordable broadband UK, flexible monthly broadband, fibre broadband, gigabit broadband, 1000Mbps broadband, price lock broadband, rolling broadband UK"
        price={getFromPrices().broadband}
      />
      <StructuredData customSchema={combinedSchemas} />

      {/* Digital Voice Upsell Dialog */}
      <Dialog open={showVoiceDialog} onOpenChange={setShowVoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Add Digital Voice (Home Phone over broadband)?
            </DialogTitle>
            <DialogDescription className="text-base">
              Stay connected with crystal-clear calls — Digital Voice works over your OCCTA broadband. It's an add-on to broadband, not a standalone phone line.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 border-4 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-1">
                <PhoneCall className="w-4 h-4 text-primary" />
                <span className="font-display text-lg">{voicePlan.name}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="font-display text-3xl text-primary">£{voiceTotal.toFixed(2)}</span>
                <span className="text-foreground/70 text-sm">/mo</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-primary flex-shrink-0" /> Works through your broadband</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-primary flex-shrink-0" /> Keep your existing number where porting is available</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-primary flex-shrink-0" /> Plug into your router</li>
              </ul>
              {selectedCallPlans.length === 0 && (
                <p className="text-xs text-muted-foreground">Pay-as-you-go calls (8p/min UK)</p>
              )}
              {selectedCallPlans.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Base £{voicePlan.price} + {callPlanOptions.filter(cp => selectedCallPlans.includes(cp.id)).map(cp => cp.name).join(" + ")}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Optional call plans:</p>
              <div className="space-y-2">
                {callPlanOptions.map((cp) => (
                  <button
                    key={cp.id}
                    className={`w-full p-3 text-left border-2 transition-colors flex items-center gap-3 ${
                      selectedCallPlans.includes(cp.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-foreground/10 hover:border-foreground/30 bg-background'
                    }`}
                    onClick={() => toggleCallPlan(cp.id)}
                  >
                    <Checkbox
                      checked={selectedCallPlans.includes(cp.id)}
                      onCheckedChange={() => toggleCallPlan(cp.id)}
                      className="pointer-events-none"
                    />
                    <div className="flex-1">
                      <p className="font-display text-sm">{cp.name}{cp.id === 'addon-unlimited-uk-calls' && <span className="text-xs text-primary ml-1">(Most Popular)</span>}</p>
                      <p className="text-xs text-muted-foreground">{cp.description}</p>
                    </div>
                    <span className="font-display text-sm text-primary">{cp.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Most customers add Unlimited UK Calls for peace of mind</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={handleSkipVoice} className="w-full sm:w-auto">
              Continue without phone
            </Button>
            <Button variant="hero" onClick={handleAddVoice} className="w-full sm:w-auto">
              Add Digital Voice
              <ArrowRight className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MotionConfig reducedMotion="user">
      {/* Hero — dark poster stage, as on the homepage */}
      <PosterStage ghost="Mbps">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-20">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <HeroKicker>Setup from £0 where available for a limited time</HeroKicker>
            <HeroTitle>
              Broadband
              {" "}<span className="block text-primary">that works</span>
            </HeroTitle>
            <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-white/70">
              Fast, reliable internet without the corporate nonsense. From £{getFromPrices().broadband}/month,
              with no mid-contract broadband price rises on Price Lock. Flex 30 is available on eligible combinations.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Want flexible terms?{" "}
              <Link to="/no-contract-broadband-uk" className="font-medium text-white underline decoration-primary underline-offset-4 hover:text-primary transition-colors">
                Explore rolling broadband options
              </Link>
              .
            </p>

            {/* Benefits */}
            <ul className="mt-6 mb-7 flex flex-wrap gap-2">
              {features.map((feature) => (
                <li
                  key={feature.text}
                  className="flex items-center gap-1.5 border border-white/20 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/85"
                >
                  <feature.icon className="w-3.5 h-3.5 text-primary" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <PostcodeChecker variant="hero" externalAddressSelect />

            {/* Inline confirmation */}
            {hasPersonalisedResult && selectedAddress && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex max-w-[640px] items-center gap-2 text-sm font-medium text-white mt-4"
              >
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                Address selected — {getShortAddress(selectedAddress)}
                <button onClick={reset} className="text-xs text-primary hover:underline ml-auto font-medium">Change</button>
              </motion.p>
            )}
          </motion.div>

          {/* Right - Panel Replacement (like homepage) */}
          <motion.div
            className="space-y-3 lg:sticky lg:top-24 lg:self-start"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* LOADING STATE */}
            {(status === "loading-postcode" || status === "checking-address") && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card min-h-[200px] sm:min-h-[320px]"
              >
                <OcctaLoader
                  context={status === "loading-postcode" ? "address" : "availability"}
                  className="w-full"
                />
              </motion.div>
            )}

            {/* ADDRESS SELECT STATE */}
            {status === "addresses" && addresses.length > 0 && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-brutal bg-card p-4 sm:p-5 md:p-6"
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

                <div className="border-[3px] border-foreground bg-background overflow-hidden">
                  <div className="max-h-[240px] sm:max-h-[340px] overflow-y-auto">
                    {addresses.map((addr, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectAddress(addr)}
                        className="w-full text-left px-4 py-3 hover:bg-primary/10 transition-colors border-b-2 border-foreground/10 last:border-b-0 flex items-center justify-between gap-2 group"
                      >
                        <span className="text-sm font-medium">{getAddressLabel(addr)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Select the exact property to continue. We show the current OCCTA plan range; final network, supplier, speed and technology availability is validated before provisioning.
                </p>
              </motion.div>
            )}

            {/* DEFAULT: Plans Preview (idle, error, or success) */}
            {status !== "loading-postcode" && status !== "checking-address" && !(status === "addresses" && addresses.length > 0) && (
              <>
                {status === "error" && postcode && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-[3px] border-primary bg-primary/10 p-4 flex items-center gap-3 mb-1"
                  >
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-display text-sm uppercase tracking-wider text-foreground">
                        Browse OCCTA broadband for {postcode}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Live availability could not be confirmed here. You can still select an OCCTA speed band; final service availability is validated before provisioning.
                      </p>
                    </div>
                  </motion.div>
                )}

                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  {hasPersonalisedResult ? "OCCTA Plans for Your Address" : "Choose Your Speed"}
                </p>
                {displayedPlans.map((plan) => {
                  const planKey = plan.id.replace("broadband-", "");
                  const isSuggested = hasPersonalisedResult && planKey === result?.recommendedPlan;
                  const isHighlighted = isSuggested || (plan.popular && !hasPersonalisedResult);

                  return (
                    <motion.div key={plan.id} variants={cardVariants}>
                      <button
                        onClick={() => handleChoosePlan(plan.id)}
                        className={`relative block w-full text-left p-4 border-[3px] ${
                          isHighlighted ? 'border-primary bg-primary/[0.06]' : 'border-white/20 bg-white/[0.03]'
                        } hover:border-primary hover:bg-white/[0.06] transition-colors group`}
                      >
                        {isSuggested && (
                          <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground px-2 py-0.5 font-display uppercase tracking-wider text-[10px] border border-black flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" />
                            Suggested speed band
                          </div>
                        )}
                        {!hasPersonalisedResult && plan.popular && (
                          <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-display uppercase border border-black">
                            Popular
                          </span>
                        )}
                        <div className={`flex items-center justify-between gap-3 ${isHighlighted ? "pt-1" : ""}`}>
                          <div className="min-w-0">
                            <h2 className="font-display text-2xl uppercase leading-none text-white">{plan.name}</h2>
                            <p className="mt-1 text-xs text-white/60">Up to {plan.speed}Mbps speed band</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="font-display text-3xl leading-none text-primary">£{plan.price}</p>
                              <p className="mt-1 text-[10px] text-white font-semibold">/mo · Price Lock 24 headline</p>
                              {plan.flex30Price && (
                                <p className="text-[10px] text-white/55">Flex 30 headline £{plan.flex30Price}</p>
                              )}
                            </div>
                            <ArrowRight className="hidden w-5 h-5 text-primary transition-transform group-hover:translate-x-1 sm:block" />
                          </div>
                        </div>
                        <div className="mt-3 h-1 bg-white/10" aria-hidden>
                          <div className="h-full bg-primary" style={{ width: `${Math.min(Math.max(Number(plan.speed) / 10, 6), 100)}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {plan.features.slice(0, 6).map((feature) => (
                            <span key={feature} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-white/80 border border-white/15">
                              <Check className="w-3.5 h-3.5 text-primary" />
                              {feature}
                            </span>
                          ))}
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
                <p className="text-[11px] leading-relaxed text-white/55 border border-white/15 p-3">
                  <strong className="text-white/80">Availability note:</strong> These are current OCCTA plan options and may not all be available at every address. Final availability, speed and network technology are subject to network and supplier validation for your installation address. If your selected plan cannot be supplied, we’ll email you with available options before provisioning. We won’t move you to a different plan or price without your agreement. If your selection is confirmed, your order continues as submitted.
                </p>
                <Link to="#plans" className="block text-center text-sm text-white/60 hover:text-primary transition-colors">
                  Compare plan details ↓
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </PosterStage>

      {/* All Plans */}
      <BrandSection id="plans" tone="paper">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-end">
          <div>
            <SectionEyebrow index="01" label="Speed bands" />
            <SectionTitle className="mt-5">
              {hasPersonalisedResult ? "OCCTA plans for your address" : "All OCCTA plans"}
            </SectionTitle>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-foreground/70">
              {hasPersonalisedResult
                ? `Current OCCTA plan options shown for ${postcode}. Final service availability is validated before provisioning.`
                : "Choose your speed band — final service availability is validated before provisioning."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              If the exact plan you select cannot be supplied at the installation address, we’ll contact you with the available options before provisioning. We will not substitute a different plan or price without your agreement.
            </p>
            {hasPersonalisedResult && (
              <button
                onClick={reset}
                className="text-sm font-medium underline decoration-primary decoration-2 underline-offset-4 mt-2"
              >
                Clear address selection
              </button>
            )}
          </div>
        </Reveal>

        <motion.div
          className={`mt-12 grid md:grid-cols-2 ${displayedPlans.length >= 4 ? "lg:grid-cols-4" : displayedPlans.length === 3 ? "lg:grid-cols-3" : displayedPlans.length === 2 ? "lg:grid-cols-2" : ""} gap-5`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={revealParent}
        >
          {displayedPlans.map((plan) => {
            const planKey = plan.id.replace("broadband-", "");
            const isSuggested = hasPersonalisedResult && planKey === result?.recommendedPlan;
            const isUpgrade = hasPersonalisedResult && planKey === result?.upgradePlan;
            const isHighlighted = isSuggested || (!hasPersonalisedResult && plan.popular);

            return (
              <motion.article
                key={plan.id}
                className="relative flex flex-col border-[3px] border-foreground bg-card transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))]"
                variants={revealItem}
              >
                {isSuggested && (
                  <div className="absolute -top-3 left-3 z-10 bg-black text-primary px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-black flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Suggested speed band
                  </div>
                )}
                {isUpgrade && !isSuggested && (
                  <div className="absolute -top-3 left-3 z-10 bg-accent text-accent-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                    Higher speed option
                  </div>
                )}
                {!hasPersonalisedResult && plan.popular && (
                  <div className="absolute -top-3 left-3 z-10 bg-black text-primary px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-black">
                    Most Popular
                  </div>
                )}

                {/* Ticket head: name and speed band */}
                <div className={`border-b-[3px] border-foreground px-5 pt-6 pb-4 ${isHighlighted ? "bg-primary text-black" : "bg-secondary"}`}>
                  <h2 className="font-display text-3xl uppercase leading-none">{plan.name}</h2>
                  <div className="mt-3 flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    <span className="font-display text-lg leading-none">Up to {plan.speed}Mbps</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-black/10" aria-hidden>
                    <div className="h-full bg-black" style={{ width: `${Math.min(Math.max(Number(plan.speed) / 10, 6), 100)}%` }} />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-5xl leading-none">£{plan.price}</span>
                    <span className="text-foreground/70 text-sm font-medium">/mo</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 text-[11px] font-medium">
                    <span className="px-2 py-0.5 bg-primary/20 border border-foreground/30 text-foreground">Price Lock 24 headline</span>
                    {plan.flex30Price && (
                      <span className="px-2 py-0.5 bg-secondary border border-foreground/15 text-muted-foreground">Flex 30 headline £{plan.flex30Price}/mo</span>
                    )}
                  </div>

                  <ul className="mt-4 mb-5 flex-grow space-y-1.5 border-t-2 border-foreground/10 pt-4">
                    {plan.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isHighlighted ? "hero" : "outline"}
                    className="w-full"
                    size="sm"
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    Choose Plan
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Setup method, activation timing and switching steps depend on the service selected and network requirements.
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Price Lock 24 or Flex 30 where offered. Your exact contractual charges are shown before you accept the agreement.
        </p>
      </BrandSection>

      {/* Flex 30 */}
      <BrandSection tone="yellow" className="border-y-[3px] border-black" containerClassName="!py-14 md:!py-20">
        <Reveal className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <SectionEyebrow index="02" label="Rolling option" tone="yellow" />
            <SectionTitle className="mt-5">Flex 30 where offered / no fixed minimum term</SectionTitle>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-black/75">
              Need broadband without a long tie-in? See the rolling option and its notice terms, where Flex 30 is offered for your selected plan.
            </p>
            <Link
              to="/no-contract-broadband-uk"
              className="group mt-6 inline-flex items-center gap-2 border-[3px] border-black bg-black px-5 py-3 font-display text-lg uppercase tracking-wider text-primary transition-colors hover:bg-white hover:text-black"
            >
              Learn about rolling broadband
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="flex flex-col items-start gap-2" aria-hidden>
            <span className="border-[3px] border-black bg-white px-4 py-3 font-display text-3xl leading-none text-black">Flex 30</span>
            <span className="ml-6 border-[3px] border-black bg-black px-4 py-3 font-display text-3xl leading-none text-primary">Price Lock 24</span>
          </div>
        </Reveal>
      </BrandSection>

      {/* Add Digital Voice (Home Phone over broadband) */}
      <BrandSection tone="dark">
        <div className="grid gap-12 md:grid-cols-2 md:items-center lg:gap-20">
          <Reveal>
            <SectionEyebrow index="03" label="Home phone" tone="dark" />
            <SectionTitle className="mt-5">Add Digital Voice (optional add-on)</SectionTitle>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Home Phone over broadband — keep your number where porting is available and plug into a compatible router. Add-on to your broadband, from <span className="font-bold text-white">£{getFromPrices().landline}/month</span>.
            </p>
            <ul className="mt-6 mb-7 space-y-3">
              {[
                "Works with your broadband connection",
                "Keep your existing phone number where porting is available",
                "Use most standard home phones with compatible equipment",
                "Optional call plans available",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/85">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/landline">
              <Button variant="outline" size="lg">
                View Digital Home Phone
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <EmergencyCallNote className="mt-6 text-white" />
          </Reveal>
          <Reveal>
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-[hsl(0_0%_8%)]">
                <div className="border-b-[3px] border-white bg-primary p-6">
                  <VoiceArt className="mx-auto h-auto w-full max-w-[280px]" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-3xl uppercase leading-none text-white">Digital Voice Add-on</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-5xl leading-none text-primary">£4.99</span>
                    <span className="text-white/70 text-sm font-medium">/mo</span>
                  </div>
                  <p className="mt-4 text-sm text-white/65">Digital calling through your broadband connection. Equipment compatibility and number porting are confirmed as part of setup.</p>
                </div>
              </div>
            </TicketSlab>
          </Reveal>
        </div>
      </BrandSection>

      {/* Router Choice */}
      <BrandSection tone="paper">
        <Reveal className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-20">
          <div>
            <SectionEyebrow index="04" label="Equipment" />
            <SectionTitle className="mt-5">Router Choice</SectionTitle>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">
              Bring your own compatible router for £0, or choose an available router option during your order. Digital Voice requires compatible equipment; the order journey shows the applicable options and charges before acceptance.
            </p>
          </div>
          <div className="border-[3px] border-foreground bg-white p-8">
            <RouterArt className="mx-auto h-auto w-full max-w-[300px]" />
          </div>
        </Reveal>
      </BrandSection>

      {/* Bundle Builder */}
      {!isAppMode && <BundleBuilder currentService="broadband" />}

      {/* Related Guides and cities */}
      <BrandSection tone="light">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
          <div>
            <Reveal>
              <SectionEyebrow index="05" label="Keep reading" />
              <SectionTitle className="mt-5">Broadband Guides</SectionTitle>
            </Reveal>
            <div className="mt-10">
              <NumberedLinkList
                items={[
                  { title: "Flexible Broadband UK", desc: "How rolling monthly broadband works and who it suits.", path: "/guides/no-contract-broadband-uk" },
                  { title: "Affordable Broadband UK", desc: "How to compare broadband costs and contract terms.", path: "/guides/cheap-broadband-uk" },
                  { title: "How to Switch Broadband", desc: "Step-by-step guide to switching provider.", path: "/guides/how-to-switch-broadband" },
                ]}
              />
            </div>
          </div>
          <Reveal>
            <h2 className="font-display text-3xl uppercase leading-none">Broadband by City</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { name: "London", path: "/broadband-london" },
                { name: "Manchester", path: "/broadband-manchester" },
                { name: "Birmingham", path: "/broadband-birmingham" },
                { name: "Leeds", path: "/broadband-leeds" },
                { name: "Glasgow", path: "/broadband-glasgow" },
                { name: "Liverpool", path: "/broadband-liverpool" },
                { name: "Sheffield", path: "/broadband-sheffield" },
                { name: "Bristol", path: "/broadband-bristol" },
                { name: "Leicester", path: "/broadband-leicester" },
                { name: "Nottingham", path: "/broadband-nottingham" },
              ].map((city) => (
                <Link
                  key={city.path}
                  to={city.path}
                  className="border-[3px] border-foreground bg-card px-3 py-2 font-display text-lg uppercase leading-none transition-colors hover:bg-primary hover:text-black"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </BrandSection>
      </MotionConfig>
    </LayoutComponent>
  );
};

const Broadband = () => (
  <AvailabilityProvider>
    <BroadbandInner />
  </AvailabilityProvider>
);

export default Broadband;
