import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Smartphone, Signal, Globe, ArrowRight, Phone, MessageSquare } from "lucide-react";
import { simPlans } from "@/lib/plans";

const SimPlans = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40, rotate: -1 },
    visible: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 grid-pattern">
        <div className="container mx-auto px-4">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block stamp text-accent border-accent mb-6">
              <Signal className="w-4 h-4 inline mr-2" />
              5G in 500+ UK towns
            </div>
            <h1 className="text-display-lg mb-6">
              SIM PLANS THAT
              <br />
              <span className="text-gradient">DON'T TAKE THE MICK</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              No credit checks. No long contracts. No "fair usage" policies that aren't actually fair. Just great mobile service at honest prices.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {[
                { icon: Signal, text: "Full 5G network", color: "bg-accent" },
                { icon: Globe, text: "EU roaming", color: "bg-primary" },
                { icon: Smartphone, text: "Keep your number", color: "bg-warning" },
              ].map((item) => (
                <motion.div
                  key={item.text}
                  className="flex items-center gap-2 px-4 py-2 border-4 border-foreground bg-background"
                  whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-display uppercase tracking-wider text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-display-md mb-4">
              CHOOSE YOUR DATA
            </h2>
            <p className="text-xl text-muted-foreground">
              All plans are 30-day rolling. Switch up, switch down, or switch off whenever you like.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {simPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className={`relative card-brutal bg-card p-6 flex flex-col ${
                  plan.popular ? "border-primary" : ""
                }`}
                variants={cardVariants}
                whileHover={{
                  y: -8,
                  x: -4,
                  boxShadow: "12px 12px 0px 0px hsl(var(--foreground))",
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-4 bg-primary text-primary-foreground px-4 py-1 font-display uppercase tracking-wider text-sm border-4 border-foreground">
                    Best Value
                  </div>
                )}
                
                <div className={plan.popular ? "pt-4" : ""}>
                  <h3 className="font-display text-3xl mb-2">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-5xl">£{plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  
                  <div className="inline-block px-4 py-2 bg-accent border-4 border-foreground mb-4">
                    <span className="font-display text-2xl">{plan.data}</span>
                    <span className="font-display text-sm ml-1">DATA</span>
                  </div>
                  
                  <p className="text-muted-foreground mb-6">{plan.description}</p>
                  
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to={`/checkout?plan=${plan.id}`} className="block">
                    <Button 
                      variant={plan.popular ? "hero" : "outline"} 
                      className="w-full"
                    >
                      Get {plan.name}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All SIM plans require a compatible unlocked phone.{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Full terms apply
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <motion.div
              className="p-6 border-4 border-foreground bg-card text-center"
              whileHover={{ y: -6, x: -4, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
            >
              <div className="w-16 h-16 bg-primary border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">KEEP YOUR NUMBER</h3>
              <p className="text-muted-foreground">
                Text 'PAC' to 65075 to get your code. We'll do the rest. Takes about 24 hours.
              </p>
            </motion.div>
            
            <motion.div
              className="p-6 border-4 border-foreground bg-card text-center"
              whileHover={{ y: -6, x: -4, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
            >
              <div className="w-16 h-16 bg-accent border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <Signal className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl mb-2">REAL 5G COVERAGE</h3>
              <p className="text-muted-foreground">
                Not the "technically 5G but actually just fast 4G" nonsense. Proper 5G, where it's available.
              </p>
            </motion.div>
            
            <motion.div
              className="p-6 border-4 border-foreground bg-card text-center"
              whileHover={{ y: -6, x: -4, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
            >
              <div className="w-16 h-16 bg-warning border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl mb-2">WIFI CALLING</h3>
              <p className="text-muted-foreground">
                Bad signal at home? No problem. Make calls over your WiFi. It's like magic, but real.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-foreground text-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-display-md mb-4">
            READY TO DITCH YOUR PROVIDER?
          </h2>
          <p className="text-background/70 mb-8 text-lg">
            Free SIM delivery. Free activation. Free from contracts that trap you.
          </p>
          <Link to="/checkout?plan=sim-plus">
            <Button variant="hero" size="lg" className="border-background">
              Order Your SIM
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default SimPlans;
