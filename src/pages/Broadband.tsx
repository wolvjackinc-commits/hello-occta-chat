import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Check, Wifi, Zap, Shield, Clock, ArrowRight, X } from "lucide-react";
import { broadbandPlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema } from "@/components/seo";

const Broadband = () => {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Short delay to allow initial render and improve perceived performance
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
    { icon: X, text: "No Contracts" },
    { icon: Shield, text: "No Hidden Fees" },
    { icon: Clock, text: "7-Day Setup" },
  ];

  const LayoutComponent = isAppMode ? AppLayout : Layout;

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
    price: '22.99',
  });

  return (
    <LayoutComponent>
      <SEO 
        title="Cheap Broadband UK - No Contract Fibre"
        description="Cheap broadband UK from £22.99/mo. No contract fibre broadband with 900Mbps speeds. No price rises, no hidden fees, cancel anytime. Best budget broadband 2025."
        canonical="/broadband"
        keywords="cheap broadband UK, no contract broadband, cancel anytime broadband, fibre broadband no contract, budget broadband, cheap fibre UK, unlimited broadband UK, 900Mbps broadband, affordable internet UK"
        price="22.99"
      />
      <StructuredData customSchema={broadbandServiceSchema} type="localBusiness" />
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
                From £22.99/month with no price rises mid-contract — cheap broadband UK
                that stays no contract broadband and cancel anytime broadband.
              </p>
              
              {/* Benefits */}
              <div className="flex flex-wrap gap-2 mb-6">
                {features.map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 border-foreground/20 bg-background"
                  >
                    <feature.icon className="w-3.5 h-3.5" />
                    {feature.text}
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
                  <Link
                    to={`/pre-checkout?plans=${plan.id}`}
                    className={`block p-4 bg-card border-4 ${plan.popular ? 'border-primary' : 'border-foreground'} hover:bg-secondary transition-colors group`}
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
                  </Link>
                </motion.div>
              ))}
              <Link to="#plans" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                View all plans ↓
              </Link>
            </motion.div>
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
            <p className="text-muted-foreground">Unlimited data, no price rises. Novel concept.</p>
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
                  
                  <Link to={`/pre-checkout?plans=${plan.id}`} className="block">
                    <Button variant={plan.popular ? "hero" : "outline"} className="w-full" size="sm">
                      Choose Plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Bundle Builder */}
      {!isAppMode && <BundleBuilder currentService="broadband" />}
    </LayoutComponent>
  );
};

export default Broadband;
