import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Check, PhoneCall, VoicemailIcon, Shield, ArrowRight, X } from "lucide-react";
import { landlinePlans } from "@/lib/plans";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema } from "@/components/seo";

const Landline = () => {
  const [isReady, setIsReady] = useState(false);
  
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
    { icon: Shield, text: "Fraud Protection" },
    { icon: VoicemailIcon, text: "Free Voicemail" },
    { icon: X, text: "No Contracts" },
  ];
  const LayoutComponent = isAppMode ? AppLayout : Layout;

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  const landlineServiceSchema = createServiceSchema({
    name: 'OCCTA Landline',
    description: 'Reliable UK landline phone service with fraud protection and free voicemail.',
    url: '/landline',
    price: '7.99',
  });

  return (
    <LayoutComponent>
      <SEO 
        title="Landline Plans"
        description="UK landline phone plans from £7.99/mo. Crystal clear digital voice, fraud protection, free voicemail. No contracts."
        canonical="/landline"
      />
      <StructuredData customSchema={landlineServiceSchema} type="localBusiness" />
      {/* Hero - Compact */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left - Content */}
            <motion.div
              className="text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="inline-block stamp text-primary border-primary mb-4">
                <PhoneCall className="w-4 h-4 inline mr-2" />
                Crystal clear digital voice
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                LANDLINES
                <br />
                <span className="text-gradient">STILL EXIST</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg mx-auto lg:mx-0">
                Reliable calls that don't drop when someone walks past the router. 
                From £7.99/month, no contracts.
              </p>
              
              {/* Benefits */}
              <div className="flex flex-wrap gap-2 mb-6 justify-center lg:justify-start">
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

              <Link to={`/pre-checkout?plans=${landlinePlans[1]?.id || landlinePlans[0].id}`}>
                <Button size="lg" variant="hero">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            {/* Right - Plans Preview */}
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                Landline Plans
              </p>
              {landlinePlans.slice(0, 3).map((plan) => (
                <motion.div
                  key={plan.id}
                  variants={cardVariants}
                  whileHover={{ x: 4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                  transition={{ duration: 0.12 }}
                >
                  <Link
                    to={`/pre-checkout?plans=${plan.id}`}
                    className={`block p-4 bg-card border-4 ${plan.popular ? 'border-primary' : 'border-foreground'} hover:bg-accent/10 transition-colors group`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {plan.popular && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-display uppercase">Popular</span>
                        )}
                        <div>
                          <h3 className="font-display text-lg uppercase">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">{plan.callRate}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-display text-2xl text-primary">£{plan.price}</p>
                          <p className="text-xs text-muted-foreground">/month</p>
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* All Plans */}
      <section id="plans" className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-display-md mb-2">ALL LANDLINE PLANS</h2>
            <p className="text-muted-foreground">No hidden charges. Straightforward calling.</p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {landlinePlans.map((plan) => (
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
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  
                  <div className="inline-block px-2 py-1 bg-warning border-2 border-foreground mb-3">
                    <span className="font-display text-xs">{plan.callRate}</span>
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
      {!isAppMode && <BundleBuilder currentService="landline" />}
    </LayoutComponent>
  );
};

export default Landline;
