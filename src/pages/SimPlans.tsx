import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ResponsiveLayout from "@/components/layout/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import { Check, Smartphone, Signal, Globe, ArrowRight, X } from "lucide-react";
import { simPlans } from "@/lib/plans";

const SimPlans = () => {
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
    { icon: Signal, text: "Full 5G Network" },
    { icon: Globe, text: "EU Roaming" },
    { icon: X, text: "No Contracts" },
  ];

  return (
    <ResponsiveLayout>
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
              <div className="inline-block stamp text-accent border-accent mb-4">
                <Signal className="w-4 h-4 inline mr-2" />
                5G in 500+ UK towns
              </div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4">
                SIM PLANS
                <br />
                <span className="text-gradient">THAT DON'T</span>
                <br />
                <span className="text-gradient">TAKE THE MICK</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg mx-auto lg:mx-0">
                No credit checks. No long contracts. Great mobile service at honest prices. From £7.99/month.
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

              <Link to={`/pre-checkout?plans=${simPlans[1]?.id || simPlans[0].id}`}>
                <Button size="lg" variant="hero">
                  Get Your SIM
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
                Choose Your Data
              </p>
              {simPlans.slice(0, 3).map((plan) => (
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
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-display uppercase">Best Value</span>
                        )}
                        <div>
                          <h3 className="font-display text-lg uppercase">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">{plan.data} data</p>
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
            <h2 className="text-display-md mb-2">ALL SIM PLANS</h2>
            <p className="text-muted-foreground">30-day rolling. Switch up, down, or off whenever.</p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {simPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className={`relative card-brutal bg-card p-5 flex flex-col ${plan.popular ? "border-primary" : ""}`}
                variants={cardVariants}
                whileHover={{ y: -6, x: -3, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-3 bg-primary text-primary-foreground px-3 py-0.5 font-display uppercase tracking-wider text-xs border-2 border-foreground">
                    Best Value
                  </div>
                )}
                
                <div className={plan.popular ? "pt-2" : ""}>
                  <h3 className="font-display text-2xl mb-1">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-4xl">£{plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  
                  <div className="inline-block px-2 py-1 bg-accent border-2 border-foreground mb-3">
                    <span className="font-display text-lg">{plan.data}</span>
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
                      Get SIM
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
      <BundleBuilder currentService="sim" />
    </ResponsiveLayout>
  );
};

export default SimPlans;
