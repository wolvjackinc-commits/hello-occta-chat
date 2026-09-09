import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import OcctaLoader from "@/components/loading/OcctaLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Wifi, Zap, Shield, Clock, ArrowRight, X, PhoneCall, Phone, Star, ChevronRight } from "lucide-react";
import { broadbandPlans, landlinePlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema, createBreadcrumbSchema, createFAQSchema } from "@/components/seo";
import { EmergencyCallNote } from "@/components/legal/EmergencyCallNote";
import { getFromPrices } from "@/lib/pricing/engine";
import { AvailabilityProvider, useAvailability, getAddressLabel, getShortAddress } from "@/contexts/AvailabilityContext";
import { startAssignedJourney } from "@/lib/journey2/route";
import { setPreferredSpeedBucket } from "@/lib/journey2/prefill";

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

      {/* Hero - Compact */}
      <section className="flex items-center py-6 sm:py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8 items-start">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                Setup from £0 where available for a limited time
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-display uppercase leading-[0.9] mb-3 sm:mb-4 text-foreground">
                BROADBAND
                <br />
                <span className="text-gradient">THAT WORKS</span>
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground mb-4 sm:mb-6 max-w-lg">
                Fast, reliable internet without the corporate nonsense. From £{getFromPrices().broadband}/month,
                with no mid-contract broadband price rises on Price Lock. Flex 30 is available on eligible combinations.
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                Want flexible terms?{" "}
                <Link to="/no-contract-broadband-uk" className="font-medium text-accent hover:text-accent/80 transition-colors">
                  Explore rolling broadband options
                </Link>
                .
              </p>
              
              {/* Benefits */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                {features.map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-background"
                  >
                    <feature.icon className="w-3.5 h-3.5" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
              
              <PostcodeChecker externalAddressSelect />

              {/* Inline confirmation */}
              {hasPersonalisedResult && selectedAddress && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm font-medium text-foreground mt-3"
                >
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  Address selected — {getShortAddress(selectedAddress)}
                  <button onClick={reset} className="text-xs text-primary hover:underline ml-auto font-medium">Change</button>
                </motion.p>
              )}
            </motion.div>

            {/* Right - Panel Replacement (like homepage) */}
            <motion.div
              className="space-y-3"
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

                  <div className="border-2 border-foreground/10 overflow-hidden">
                    <div className="max-h-[240px] sm:max-h-[340px] overflow-y-auto">
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
                      className="card-brutal bg-primary/10 border-primary p-4 flex items-center gap-3 mb-1"
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

                  <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                    {hasPersonalisedResult ? "OCCTA Plans for Your Address" : "Choose Your Speed"}
                  </p>
                  {displayedPlans.map((plan) => {
                    const planKey = plan.id.replace("broadband-", "");
                    const isSuggested = hasPersonalisedResult && planKey === result?.recommendedPlan;
                    
                    return (
                      <motion.div
                        key={plan.id}
                        variants={cardVariants}
                        whileHover={{ x: 4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                        transition={{ duration: 0.12 }}
                      >
                        <button
                          onClick={() => handleChoosePlan(plan.id)}
                          className={`block w-full text-left p-4 bg-card border-4 ${
                            isSuggested ? 'border-primary' : plan.popular && !hasPersonalisedResult ? 'border-primary' : 'border-foreground'
                          } hover:bg-secondary transition-colors group relative`}
                        >
                          {isSuggested && (
                            <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground px-2 py-0.5 font-display uppercase tracking-wider text-[10px] border border-foreground flex items-center gap-1">
                              <Star className="w-2.5 h-2.5" />
                              Suggested speed band
                            </div>
                          )}
                          {!hasPersonalisedResult && plan.popular && (
                            <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-display uppercase border border-foreground">
                              Popular
                            </span>
                          )}
                          <div className={`flex items-center justify-between mb-3 ${isSuggested || (!hasPersonalisedResult && plan.popular) ? "pt-1" : ""}`}>
                            <div>
                              <h2 className="font-display text-lg uppercase text-foreground">{plan.name}</h2>
                              <p className="text-xs text-muted-foreground">Up to {plan.speed}Mbps speed band</p>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <div>
                                <p className="font-display text-2xl text-primary">£{plan.price}</p>
                                <p className="text-[10px] text-foreground font-semibold">/mo · Price Lock 24 headline</p>
                                {plan.flex30Price && (
                                  <p className="text-[10px] text-muted-foreground">Flex 30 headline £{plan.flex30Price}</p>
                                )}
                              </div>
                              <ArrowRight className="w-5 h-5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {plan.features.slice(0, 6).map((feature) => (
                              <span key={feature} className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-xs text-foreground border border-foreground/10">
                                <Check className="w-3.5 h-3.5 text-primary" />
                                {feature}
                              </span>
                            ))}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                  <p className="text-[11px] leading-relaxed text-muted-foreground border-2 border-foreground/15 p-3">
                    <strong>Availability note:</strong> These are current OCCTA plan options and may not all be available at every address. Final availability, speed and network technology are subject to network and supplier validation for your installation address. If your selected plan cannot be supplied, we’ll email you with available options before provisioning. We won’t move you to a different plan or price without your agreement. If your selection is confirmed, your order continues as submitted.
                  </p>
                  <Link to="#plans" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Compare plan details ↓
                  </Link>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-display uppercase mb-2">
                Flex 30 where offered / no fixed minimum term
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                Need broadband without a long tie-in? See the rolling option and its notice terms, where Flex 30 is offered for your selected plan.
              </p>
            </div>
            <Link to="/no-contract-broadband-uk" className="font-display uppercase tracking-wider text-accent hover:text-accent/80 transition-colors">
              Learn about rolling broadband →
            </Link>
          </div>
        </div>
      </section>

      {/* All Plans */}
      <section id="plans" className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-display-md mb-2">
              {hasPersonalisedResult ? "OCCTA PLANS FOR YOUR ADDRESS" : "ALL OCCTA PLANS"}
            </h2>
            <p className="text-muted-foreground">
              {hasPersonalisedResult
                ? `Current OCCTA plan options shown for ${postcode}. Final service availability is validated before provisioning.`
                : "Choose your speed band — final service availability is validated before provisioning."}
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-4xl">
              If the exact plan you select cannot be supplied at the installation address, we’ll contact you with the available options before provisioning. We will not substitute a different plan or price without your agreement.
            </p>
            {hasPersonalisedResult && (
              <button
                onClick={reset}
                className="text-sm text-primary hover:underline mt-2 font-medium"
              >
                Clear address selection
              </button>
            )}
          </motion.div>

          <motion.div
            className={`grid md:grid-cols-2 ${displayedPlans.length >= 4 ? "lg:grid-cols-4" : displayedPlans.length === 3 ? "lg:grid-cols-3" : displayedPlans.length === 2 ? "lg:grid-cols-2" : ""} gap-4`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {displayedPlans.map((plan) => {
              const planKey = plan.id.replace("broadband-", "");
              const isSuggested = hasPersonalisedResult && planKey === result?.recommendedPlan;
              const isUpgrade = hasPersonalisedResult && planKey === result?.upgradePlan;
              
              return (
                <motion.div
                  key={plan.id}
                  className={`relative card-brutal bg-card p-5 flex flex-col ${
                    isSuggested ? "border-primary" : plan.popular && !hasPersonalisedResult ? "border-primary" : ""
                  }`}
                  variants={cardVariants}
                  whileHover={{ y: -6, x: -3, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
                >
                  {isSuggested && (
                    <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Suggested speed band
                    </div>
                  )}
                  {isUpgrade && !isSuggested && (
                    <div className="absolute -top-3 left-3 bg-accent text-accent-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                      Higher speed option
                    </div>
                  )}
                  {!hasPersonalisedResult && plan.popular && (
                    <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                      Most Popular
                    </div>
                  )}
                  
                  <div className={(isSuggested || isUpgrade || (!hasPersonalisedResult && plan.popular)) ? "pt-2" : ""}>
                    <h2 className="font-display text-2xl mb-1">{plan.name}</h2>
                    
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="font-display text-4xl">£{plan.price}</span>
                      <span className="text-foreground/70 text-sm font-medium">/mo</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3 text-[11px] font-medium">
                      <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 text-foreground">Price Lock 24 headline</span>
                      {plan.flex30Price && (
                        <span className="px-2 py-0.5 bg-secondary border border-foreground/15 text-muted-foreground">Flex 30 headline £{plan.flex30Price}/mo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-accent border-2 border-foreground inline-block">
                      <Wifi className="w-3 h-3 text-accent-foreground" />
                      <span className="font-display text-accent-foreground text-sm">Up to {plan.speed}Mbps</span>
                    </div>
                    
                    <ul className="space-y-1.5 mb-4 flex-grow">
                      {plan.features.slice(0, 6).map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-xs">
                          <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      variant={isSuggested || (!hasPersonalisedResult && plan.popular) ? "hero" : "outline"}
                      className="w-full"
                      size="sm"
                      onClick={() => handleChoosePlan(plan.id)}
                    >
                      Choose Plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Setup method, activation timing and switching steps depend on the service selected and network requirements.
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Price Lock 24 or Flex 30 where offered. Your exact contractual charges are shown before you accept the agreement.
          </p>
        </div>
      </section>

      {/* Add Digital Voice (Home Phone over broadband) */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-display-md mb-4">ADD DIGITAL VOICE (OPTIONAL ADD-ON)</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Home Phone over broadband — keep your number where porting is available and plug into a compatible router. Add-on to your broadband, from <span className="font-bold text-foreground">£{getFromPrices().landline}/month</span>.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Works with your broadband connection",
                  "Keep your existing phone number where porting is available",
                  "Use most standard home phones with compatible equipment",
                  "Optional call plans available",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
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
              <EmergencyCallNote className="mt-4" />
            </motion.div>
            <motion.div
              className="card-brutal bg-card p-6"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 bg-warning border-4 border-foreground flex items-center justify-center mb-4">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl mb-2">Digital Voice Add-on</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="font-display text-4xl text-primary">£4.99</span>
                <span className="text-foreground/70 text-sm font-medium">/mo</span>
              </div>
              <p className="text-muted-foreground text-sm">Digital calling through your broadband connection. Equipment compatibility and number porting are confirmed as part of setup.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Router Choice */}
      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent border-4 border-foreground flex items-center justify-center flex-shrink-0">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display uppercase mb-2">
                  Router Choice
                </h2>
                <p className="text-muted-foreground max-w-2xl">
                  Bring your own compatible router for £0, or choose an available router option during your order. Digital Voice requires compatible equipment; the order journey shows the applicable options and charges before acceptance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bundle Builder */}
      {!isAppMode && <BundleBuilder currentService="broadband" />}

      {/* Related Guides */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-display uppercase mb-4">Broadband Guides</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "Flexible Broadband UK", desc: "How rolling monthly broadband works and who it suits.", path: "/guides/no-contract-broadband-uk" },
              { title: "Affordable Broadband UK", desc: "How to compare broadband costs and contract terms.", path: "/guides/cheap-broadband-uk" },
              { title: "How to Switch Broadband", desc: "Step-by-step guide to switching provider.", path: "/guides/how-to-switch-broadband" },
            ].map((g) => (
              <Link key={g.path} to={g.path} className="card-brutal bg-card p-4 hover:bg-secondary transition-colors group">
                <h3 className="font-display text-base mb-1 group-hover:text-primary transition-colors">{g.title}</h3>
                <p className="text-sm text-muted-foreground">{g.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Broadband by City */}
      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-display uppercase mb-4">Broadband by City</h2>
          <div className="flex flex-wrap gap-2">
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
                className="px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </LayoutComponent>
  );
};

const Broadband = () => (
  <AvailabilityProvider>
    <BroadbandInner />
  </AvailabilityProvider>
);

export default Broadband;