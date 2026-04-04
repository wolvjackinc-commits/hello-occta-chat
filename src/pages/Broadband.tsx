import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Wifi, Zap, Shield, Clock, ArrowRight, X, PhoneCall, Phone } from "lucide-react";
import { broadbandPlans, landlinePlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema } from "@/components/seo";
import { getFromPrices } from "@/lib/pricing/engine";

const Broadband = () => {
  const [isReady, setIsReady] = useState(false);
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [selectedBroadbandPlanId, setSelectedBroadbandPlanId] = useState<string | null>(null);
  const [selectedCallPlans, setSelectedCallPlans] = useState<string[]>([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const { isAppMode } = useAppMode();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const features = [
    { icon: X, text: "Cancel Anytime" },
    { icon: Shield, text: "No Hidden Fees" },
    { icon: Clock, text: "7-Day Setup" },
  ];

  const LayoutComponent = isAppMode ? AppLayout : Layout;

  const voicePlan = landlinePlans[0];
  const callPlanOptions = [
    { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", price: 3, label: "+£3/mo", description: "Unlimited calls to UK landlines & mobiles" },
    { id: "addon-intl-calls-pack", name: "International Calls", price: 5, label: "+£5/mo", description: "300 mins to 50+ countries" },
  ];

  const handleChoosePlan = (planId: string) => {
    setSelectedBroadbandPlanId(planId);
    setSelectedCallPlans([]);
    setShowVoiceDialog(true);
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

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  const broadbandServiceSchema = createServiceSchema({
    name: 'OCCTA Broadband',
    description: 'Fast, reliable fibre broadband with speeds up to 900Mbps. No contracts, no price rises.',
    url: '/broadband',
    price: getFromPrices().broadband,
  });

  const planOfferSchemas = broadbandPlans.map(plan => createOfferSchema({
    name: `OCCTA ${plan.name}`,
    description: `Fibre broadband up to ${plan.speed}Mbps. No contract, cancel anytime. ${plan.features.slice(0, 3).join(', ')}.`,
    price: plan.price.toString(),
    url: `/pre-checkout?plans=${plan.id}`,
    sku: plan.id,
    category: 'Broadband',
  }));

  const combinedSchemas = {
    '@context': 'https://schema.org',
    '@graph': [
      broadbandServiceSchema,
      ...planOfferSchemas,
    ],
  };

  return (
    <LayoutComponent>
      <SEO 
        title="Cheap Broadband UK - No Contract Fibre"
        description={`Cheap broadband UK from £${getFromPrices().broadband}/mo. No contract fibre broadband with 900Mbps speeds. No price rises, no hidden fees, cancel anytime. Best budget broadband 2025.`}
        canonical="/broadband"
        keywords="cheap broadband UK, no contract broadband, cancel anytime broadband, fibre broadband no contract, budget broadband, cheap fibre UK, unlimited broadband UK, 900Mbps broadband, affordable internet UK"
        price={getFromPrices().broadband}
      />
      <StructuredData customSchema={combinedSchemas} />

      {/* Digital Voice Upsell Dialog */}
      <Dialog open={showVoiceDialog} onOpenChange={setShowVoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Add Digital Home Phone?
            </DialogTitle>
            <DialogDescription className="text-base">
              Add a home phone to your broadband for crystal clear HD calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Voice plan summary */}
            <div className="p-4 border-4 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-1">
                <PhoneCall className="w-4 h-4 text-primary" />
                <span className="font-display text-lg">{voicePlan.name}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="font-display text-3xl text-primary">£{voiceTotal.toFixed(2)}</span>
                <span className="text-foreground/70 text-sm">/mo</span>
              </div>
              {selectedCallPlans.length === 0 && (
                <p className="text-xs text-muted-foreground">Pay-as-you-go calls included (8p/min UK)</p>
              )}
              {selectedCallPlans.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Base £{voicePlan.price} + {callPlanOptions.filter(cp => selectedCallPlans.includes(cp.id)).map(cp => cp.name).join(" + ")}
                </p>
              )}
            </div>

            {/* Call plan options */}
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
                      <p className="font-display text-sm">{cp.name}</p>
                      <p className="text-xs text-muted-foreground">{cp.description}</p>
                    </div>
                    <span className="font-display text-sm text-primary">{cp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={handleSkipVoice} className="w-full sm:w-auto">
              No thanks, continue
            </Button>
            <Button variant="hero" onClick={handleAddVoice} className="w-full sm:w-auto">
              Yes, add Home Phone
              <ArrowRight className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero - Compact */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                Free installation until March
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                BROADBAND
                <br />
                <span className="text-gradient">THAT WORKS</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg">
                Fast, reliable internet without the corporate nonsense. 
                From £{getFromPrices().broadband}/month with no price rises mid-contract — cheap broadband UK
                that stays no contract broadband and cancel anytime broadband.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Want flexible terms?{" "}
                <Link to="/no-contract-broadband-uk" className="font-medium text-accent hover:text-accent/80 transition-colors">
                  Explore no-contract broadband options
                </Link>
                .
              </p>
              
              {/* Benefits */}
              <div className="flex flex-wrap gap-2 mb-6">
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
              
              <PostcodeChecker />
            </motion.div>

            {/* Right - Plans Preview */}
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                Choose Your Speed
              </p>
              {broadbandPlans.slice(0, 3).map((plan) => (
                <motion.div
                  key={plan.id}
                  variants={cardVariants}
                  whileHover={{ x: 4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                  transition={{ duration: 0.12 }}
                >
                  <button
                    onClick={() => handleChoosePlan(plan.id)}
                    className={`block w-full text-left p-4 bg-card border-4 ${plan.popular ? 'border-primary' : 'border-foreground'} hover:bg-secondary transition-colors group`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {plan.popular && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-display uppercase">Popular</span>
                        )}
                        <div>
                          <h3 className="font-display text-lg uppercase">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">Up to {plan.speed}Mbps</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-display text-2xl text-primary">£{plan.price}</p>
                          <p className="text-xs text-foreground/70">/month</p>
                        </div>
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.features.slice(0, 6).map((feature) => (
                        <span key={feature} className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-xs border border-foreground/10">
                          <Check className="w-3 h-3 text-primary" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </button>
                </motion.div>
              ))}
              <Link to="#plans" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                View all plans ↓
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-display uppercase mb-2">
                Cancel anytime / No fixed term
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                Need broadband without a long tie-in? See how our rolling plans keep you flexible with no fixed term commitments.
              </p>
            </div>
            <Link to="/no-contract-broadband-uk" className="font-display uppercase tracking-wider text-accent hover:text-accent/80 transition-colors">
              Learn about no-contract broadband →
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
            <h2 className="text-display-md mb-2">ALL PLANS</h2>
            <p className="text-muted-foreground">Choose your speed — we'll handle the rest</p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {broadbandPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className={`relative card-brutal bg-card p-5 flex flex-col ${plan.popular ? "border-primary" : ""}`}
                variants={cardVariants}
                whileHover={{ y: -6, x: -3, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                    Most Popular
                  </div>
                )}
                
                <div className={plan.popular ? "pt-2" : ""}>
                  <h3 className="font-display text-2xl mb-1">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-4xl">£{plan.price}</span>
                    <span className="text-foreground/70 text-sm font-medium">/mo</span>
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
                    variant={plan.popular ? "hero" : "outline"}
                    className="w-full"
                    size="sm"
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    Choose Plan
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            ✔ Setup usually within 7 days · ✔ We notify your current provider · ✔ No downtime during switch
          </p>
          <p className="text-center text-xs text-muted-foreground/70 mt-2">
            No contracts. No pressure. Just better broadband.
          </p>
        </div>
      </section>

      {/* Add a Home Phone */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-display-md mb-4">ADD A HOME PHONE (OPTIONAL)</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Keep your number. Plug into your router. No copper line needed. From <span className="font-bold text-foreground">£{getFromPrices().landline}/month</span>.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Works with your broadband connection",
                  "Keep your existing phone number",
                  "Use most standard home phones",
                  "Optional unlimited call plans available",
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
              <h3 className="font-display text-2xl mb-2">Digital Voice Line</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="font-display text-4xl text-primary">£4.99</span>
                <span className="text-foreground/70 text-sm font-medium">/mo</span>
              </div>
              <p className="text-muted-foreground text-sm">Crystal clear HD calls through your broadband router. No separate line needed.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Router Included */}
      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent border-4 border-foreground flex items-center justify-center flex-shrink-0">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display uppercase mb-2">
                  Router Included
                </h2>
                <p className="text-muted-foreground max-w-2xl">
                  Your broadband plan includes a Wi-Fi router. If you add Digital Home Phone, 
                  simply plug your phone into the router. Most standard home phones are supported.
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
              { title: "No Contract Broadband UK", desc: "How rolling monthly broadband works and who it suits.", path: "/guides/no-contract-broadband-uk" },
              { title: "Cheap Broadband UK", desc: "How to find affordable internet and avoid hidden costs.", path: "/guides/cheap-broadband-uk" },
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

export default Broadband;
