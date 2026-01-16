import { motion } from "framer-motion";
import { ArrowRight, X, Shield, Phone, Wifi, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  const benefits = [
    { icon: X, text: "No Contracts" },
    { icon: Shield, text: "No Hidden Fees" },
    { icon: Phone, text: "UK-based Support" },
    { icon: Wifi, text: "UK-wide Coverage" },
    { icon: RefreshCcw, text: "Cancel Anytime" },
  ];

  const services = [
    { name: "Broadband", price: "£22.99", link: "/broadband" },
    { name: "Mobile SIM", price: "£7.99", link: "/sim-plans" },
    { name: "Landline", price: "£7.99", link: "/landline" },
  ];

  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 -skew-x-12 translate-x-20 hidden lg:block" />
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <motion.div
            className="space-y-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Headline - Large and Prominent */}
            <motion.h1 
              variants={itemVariants} 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display uppercase leading-[0.9] tracking-tight text-foreground"
            >
              UK Broadband
              <br />
              &amp; SIM Plans
              <br />
              <span className="text-gradient">Without Contracts</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p 
              variants={itemVariants} 
              className="text-lg text-muted-foreground max-w-lg"
            >
              Affordable telecom UK-wide without contracts, hidden fees, or lock-ins. Same UK networks,
              lower prices, and available across the UK.
            </motion.p>

            {/* Benefits Row */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-wrap gap-2"
            >
              {benefits.map((benefit, i) => (
                <div
                  key={benefit.text}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-2 ${
                    i === 0 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-foreground/20 bg-background"
                  }`}
                >
                  <benefit.icon className="w-3.5 h-3.5" />
                  {benefit.text}
                </div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" variant="hero">
                <Link to="/broadband">
                  Check Your Postcode
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/about">Learn More</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right - Service Cards */}
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.p 
              variants={itemVariants}
              className="font-display text-sm uppercase tracking-wider text-muted-foreground"
            >
              Starting From
            </motion.p>
            
            {services.map((service) => (
              <motion.div
                key={service.name}
                variants={itemVariants}
                whileHover={{ x: 6, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                transition={{ duration: 0.12 }}
              >
                <Link
                  to={service.link}
                  className="flex items-center justify-between p-4 bg-card border-4 border-foreground hover:bg-accent/10 transition-colors group"
                >
                  <div>
                    <h3 className="font-display text-lg uppercase">{service.name}</h3>
                    <p className="text-xs text-muted-foreground">No contract required</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-display text-2xl text-primary">{service.price}</p>
                      <p className="text-xs text-muted-foreground">/month</p>
                    </div>
                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </motion.div>
            ))}

            {/* Trust Badge */}
            <motion.div 
              variants={itemVariants}
              className="flex items-center justify-center gap-6 pt-2 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">🇬🇧</span> 100% British
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> 98% Recommend Us
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
