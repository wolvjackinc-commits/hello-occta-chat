import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, PhoneCall, ArrowRight, AlertTriangle, Wifi, Router, Phone, Zap } from "lucide-react";
import { landlinePlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema } from "@/components/seo";
import { getFromPrices } from "@/lib/pricing/engine";

const Landline = () => {
  const [isReady, setIsReady] = useState(false);
  const [selectedCallPlans, setSelectedCallPlans] = useState<string[]>([]);
  const [showBroadbandDialog, setShowBroadbandDialog] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const { isAppMode } = useAppMode();
  const LayoutComponent = isAppMode ? AppLayout : Layout;
  const plan = landlinePlans[0];

  const callPlans = [
    { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", price: "+£3/mo", priceNum: 3, description: "Unlimited calls to UK landlines & mobiles" },
    { id: "addon-intl-calls-pack", name: "International Calls", price: "+£5/mo", priceNum: 5, description: "300 mins to 50+ countries" },
  ];

  const toggleCallPlan = (id: string) => {
    setSelectedCallPlans(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalPrice = plan.priceNum + callPlans.filter(cp => selectedCallPlans.includes(cp.id)).reduce((s, cp) => s + cp.priceNum, 0);

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  const landlineServiceSchema = createServiceSchema({
    name: 'OCCTA Digital Home Phone',
    description: `Digital home phone service that works through your OCCTA broadband. Crystal clear HD calls from £${getFromPrices().landline}/month.`,
    url: '/landline',
    price: getFromPrices().landline,
  });

  const planOfferSchema = createOfferSchema({
    name: 'OCCTA Digital Voice Line',
    description: 'Digital home phone with HD calls, caller display, free voicemail. Requires OCCTA broadband.',
    price: '4.99',
    url: `/pre-checkout?plans=${plan.id}`,
    sku: plan.id,
    category: 'Digital Home Phone',
  });

  const combinedSchemas = {
    '@context': 'https://schema.org',
    '@graph': [landlineServiceSchema, planOfferSchema],
  };

  return (
    <LayoutComponent>
      <SEO 
        title="Digital Home Phone UK - Add to Broadband"
        description="Add Digital Home Phone from £4.99/mo to your OCCTA broadband. Crystal clear digital voice, keep your number. No contracts."
        canonical="/landline"
        keywords="digital home phone, digital voice UK, VoIP home phone, home phone broadband, cheap home phone UK, no contract home phone"
        price="4.99"
      />
      <StructuredData customSchema={combinedSchemas} />

      {/* Broadband Required Dialog */}
      <Dialog open={showBroadbandDialog} onOpenChange={setShowBroadbandDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display uppercase flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              Broadband Required
            </DialogTitle>
            <DialogDescription className="text-base">
              Digital Home Phone works through your broadband connection and cannot be purchased separately. You'll need an OCCTA broadband plan first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowBroadbandDialog(false)}>
              Go Back
            </Button>
            <Button variant="hero" onClick={() => navigate("/broadband")}>
              View Broadband Plans
              <ArrowRight className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          {/* Broadband Requirement Notice */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-3xl"
          >
            <Alert className="border-4 border-warning bg-warning/10">
              <Wifi className="h-5 w-5" />
              <AlertTitle className="font-display uppercase tracking-wide">Broadband Required</AlertTitle>
              <AlertDescription>
                OCCTA Digital Home Phone requires an active OCCTA broadband connection.{" "}
                <Link to="/broadband" className="font-bold underline hover:text-primary transition-colors">
                  View broadband plans →
                </Link>
              </AlertDescription>
            </Alert>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left - Content */}
            <motion.div
              className="text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="inline-block stamp text-primary border-primary mb-4">
                <PhoneCall className="w-4 h-4 inline mr-2" />
                Digital Voice over Broadband
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                DIGITAL
                <br />
                <span className="text-gradient">HOME PHONE</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg mx-auto lg:mx-0">
                Crystal clear calls through your broadband connection. Keep your existing number, 
                use your standard home phone. From £4.99/month, no contracts.
              </p>
              
              {/* Benefits */}
              <div className="flex flex-wrap gap-2 mb-6 justify-center lg:justify-start">
                {[
                  { icon: Phone, text: "HD Voice" },
                  { icon: Router, text: "Plug into Router" },
                  { icon: Zap, text: "No Contracts" },
                ].map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-background"
                  >
                    <feature.icon className="w-3.5 h-3.5" />
                    {feature.text}
                  </div>
                ))}
              </div>

              <Button size="lg" variant="hero" onClick={() => setShowBroadbandDialog(true)}>
                Get Digital Home Phone
                <ArrowRight className="w-5 h-5" />
              </Button>
            </motion.div>

            {/* Right - Plan Card + Call Plan Selector */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Main Plan Card */}
              <div className="card-brutal bg-card p-6 border-primary">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-display uppercase">Add-on</span>
                  <span className="text-xs text-muted-foreground">Requires broadband</span>
                </div>
                <h2 className="font-display text-3xl mb-1">{plan.name}</h2>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-5xl text-primary">£{totalPrice.toFixed(2)}</span>
                  <span className="text-foreground/70 text-sm font-medium">/month</span>
                </div>
                {selectedCallPlans.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Base £{plan.price} + {callPlans.filter(cp => selectedCallPlans.includes(cp.id)).map(cp => cp.name).join(" + ")}
                  </p>
                )}
                {selectedCallPlans.length === 0 && (
                  <p className="text-xs text-muted-foreground mb-4">Pay-as-you-go calls (8p/min UK)</p>
                )}

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button variant="hero" className="w-full" onClick={() => setShowBroadbandDialog(true)}>
                  Add to Broadband
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Call Plan Selector - Multi-select */}
              <div className="card-brutal bg-card p-6">
                <h3 className="font-display text-xl mb-2">ADD CALL PLANS</h3>
                <p className="text-sm text-muted-foreground mb-4">Select any combination or leave blank for pay-as-you-go (8p/min UK calls)</p>
                <div className="space-y-2">
                  {callPlans.map((cp) => (
                    <motion.button
                      key={cp.id}
                      className={`w-full p-4 text-left border-4 transition-colors ${
                        selectedCallPlans.includes(cp.id)
                          ? 'border-primary bg-primary/5' 
                          : 'border-foreground/10 hover:border-foreground/30 bg-background'
                      }`}
                      onClick={() => toggleCallPlan(cp.id)}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.12 }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedCallPlans.includes(cp.id)}
                            onCheckedChange={() => toggleCallPlan(cp.id)}
                            className="pointer-events-none"
                          />
                          <div>
                            <p className="font-display text-lg">{cp.name}</p>
                            <p className="text-sm text-muted-foreground">{cp.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg text-primary">{cp.price}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Equipment Needed */}
      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-display-md mb-8">EQUIPMENT NEEDED</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Wifi,
                  title: "OCCTA Broadband",
                  description: "An active OCCTA broadband connection is required for Digital Home Phone.",
                },
                {
                  icon: Router,
                  title: "OCCTA Router",
                  description: "Your broadband plan includes a Wi-Fi router with a phone port built in.",
                },
                {
                  icon: Phone,
                  title: "Standard Home Phone",
                  description: "Any standard home phone handset. Most existing phones work by plugging directly into the router.",
                },
              ].map((item) => (
                <div key={item.title} className="card-brutal bg-card p-6">
                  <div className="w-12 h-12 bg-warning border-4 border-foreground flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Optional Handset Upsell */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-display uppercase mb-2">
                Need a Handset?
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                Don't have a home phone? Add a cordless DECT handset to your order for just <span className="font-bold text-foreground">£29</span> (one-time purchase). 
                Delivered to your door, ready to plug in.
              </p>
            </div>
            <div className="inline-block px-4 py-2 bg-warning border-4 border-foreground">
              <span className="font-display text-lg">£29 one-time</span>
            </div>
          </div>
        </div>
      </section>

      {/* Power Cut Legal Notice */}
      <section className="py-8 bg-secondary">
        <div className="container mx-auto px-4">
          <Alert className="border-4 border-foreground/20 bg-background">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="font-display uppercase tracking-wide">Important: Power Cuts</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Digital Voice requires electricity and broadband to work. During a power cut your home phone will not work. 
              You may wish to keep a mobile phone for emergencies.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Bundle Builder */}
      {!isAppMode && <BundleBuilder currentService="landline" />}

      {/* Related Guides */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-display uppercase mb-4">Home Phone Guides</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Digital Voice UK", desc: "How Digital Voice works and what you need to know.", path: "/guides/digital-voice-uk" },
              { title: "PSTN Switch-Off UK", desc: "The copper line shutdown and what it means for your landline.", path: "/guides/pstn-switch-off-uk" },
            ].map((g) => (
              <Link key={g.path} to={g.path} className="card-brutal bg-card p-4 hover:bg-secondary transition-colors group">
                <h3 className="font-display text-base mb-1 group-hover:text-primary transition-colors">{g.title}</h3>
                <p className="text-sm text-muted-foreground">{g.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </LayoutComponent>
  );
};

export default Landline;
