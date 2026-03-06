import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, PhoneCall, ArrowRight, AlertTriangle, Wifi, Router, Phone, Zap } from "lucide-react";
import { landlinePlans } from "@/lib/plans";
import { landlineAddons } from "@/lib/addons";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema } from "@/components/seo";

const Landline = () => {
  const [isReady, setIsReady] = useState(false);
  const [selectedCallPlan, setSelectedCallPlan] = useState<string | null>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const { isAppMode } = useAppMode();
  const LayoutComponent = isAppMode ? AppLayout : Layout;
  const plan = landlinePlans[0];

  const callPlans = [
    { id: null, name: "Pay-as-you-go", price: "Included", priceNum: 0, description: "8p/min UK calls" },
    { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", price: "+£3/mo", priceNum: 3, description: "Unlimited calls to UK landlines & mobiles" },
    { id: "addon-intl-calls-pack", name: "International Calls", price: "+£5/mo", priceNum: 5, description: "300 mins to 50+ countries" },
  ];

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  const landlineServiceSchema = createServiceSchema({
    name: 'OCCTA Digital Home Phone',
    description: 'Digital home phone service that works through your OCCTA broadband. Crystal clear HD calls from £4.99/month.',
    url: '/landline',
    price: '4.99',
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

  const checkoutUrl = selectedCallPlan 
    ? `/pre-checkout?plans=${plan.id}&addons=${selectedCallPlan}` 
    : `/pre-checkout?plans=${plan.id}`;

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

              <Link to={checkoutUrl}>
                <Button size="lg" variant="hero">
                  Get Digital Home Phone
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
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
                
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-display text-5xl text-primary">£{plan.price}</span>
                  <span className="text-foreground/70 text-sm font-medium">/month</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to={checkoutUrl} className="block">
                  <Button variant="hero" className="w-full">
                    Add to Broadband
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Call Plan Selector */}
              <div className="card-brutal bg-card p-6">
                <h3 className="font-display text-xl mb-4">CHOOSE YOUR CALL PLAN</h3>
                <div className="space-y-2">
                  {callPlans.map((cp) => (
                    <motion.button
                      key={cp.name}
                      className={`w-full p-4 text-left border-4 transition-colors ${
                        selectedCallPlan === cp.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-foreground/10 hover:border-foreground/30 bg-background'
                      }`}
                      onClick={() => setSelectedCallPlan(cp.id)}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.12 }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-display text-lg">{cp.name}</p>
                          <p className="text-sm text-muted-foreground">{cp.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg text-primary">{cp.price}</p>
                        </div>
                      </div>
                      {selectedCallPlan === cp.id && (
                        <Check className="w-4 h-4 text-primary mt-1" />
                      )}
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
    </LayoutComponent>
  );
};

export default Landline;