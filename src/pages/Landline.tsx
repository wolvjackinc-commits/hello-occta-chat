import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Check, PhoneCall, VoicemailIcon, Shield, ArrowRight, Globe } from "lucide-react";
import { landlinePlans } from "@/lib/plans";

const Landline = () => {
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
            <div className="inline-block stamp text-primary border-primary mb-6">
              <PhoneCall className="w-4 h-4 inline mr-2" />
              Crystal clear digital voice
            </div>
            <h1 className="text-display-lg mb-6">
              YES, LANDLINES
              <br />
              <span className="text-gradient">STILL EXIST</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Reliable calls that don't drop when someone walks past the router. Perfect for when you actually want to have a proper chat with your mum.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {[
                { icon: Shield, text: "Fraud protection" },
                { icon: VoicemailIcon, text: "Free voicemail" },
                { icon: PhoneCall, text: "24/7 support" },
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
              LANDLINE PLANS THAT MAKE SENSE
            </h2>
            <p className="text-xl text-muted-foreground">
              No hidden charges. No surprise bills. Just straightforward calling.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            {landlinePlans.map((plan) => (
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
                    Most Popular
                  </div>
                )}
                
                <div className={plan.popular ? "pt-4" : ""}>
                  <h3 className="font-display text-3xl mb-2">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-5xl">£{plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  
                  <div className="inline-block px-4 py-2 bg-warning border-4 border-foreground mb-4">
                    <span className="font-display text-sm">{plan.callRate}</span>
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
                      Choose {plan.name}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All plans require OCCTA broadband. Bundle and save up to 20%.{" "}
            <Link to="/broadband" className="underline hover:text-foreground">
              View broadband plans
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
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">SCAM CALL BLOCKING</h3>
              <p className="text-muted-foreground">
                We block known scam numbers before they even reach you. Take that, fraudsters.
              </p>
            </motion.div>
            
            <motion.div
              className="p-6 border-4 border-foreground bg-card text-center"
              whileHover={{ y: -6, x: -4, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
            >
              <div className="w-16 h-16 bg-accent border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <VoicemailIcon className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl mb-2">VISUAL VOICEMAIL</h3>
              <p className="text-muted-foreground">
                See your voicemails in our app. Play, delete, or save them without calling in.
              </p>
            </motion.div>
            
            <motion.div
              className="p-6 border-4 border-foreground bg-card text-center"
              whileHover={{ y: -6, x: -4, boxShadow: "10px 10px 0px 0px hsl(var(--foreground))" }}
            >
              <div className="w-16 h-16 bg-warning border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl mb-2">CALL ANYWHERE</h3>
              <p className="text-muted-foreground">
                Use our app to make landline calls from your mobile. Same number, no extra cost.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-foreground text-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-display-md mb-4">
            BUNDLE WITH BROADBAND & SAVE
          </h2>
          <p className="text-background/70 mb-8 text-lg">
            Add a landline to your broadband for as little as £5/month extra.
          </p>
          <Link to="/broadband">
            <Button variant="hero" size="lg" className="border-background">
              View Bundle Deals
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Landline;
