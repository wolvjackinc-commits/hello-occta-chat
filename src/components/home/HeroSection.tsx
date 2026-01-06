import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Phone, Wifi, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  const benefits = [
    { icon: X, text: "No Contracts", highlight: true },
    { icon: Shield, text: "No Hidden Fees" },
    { icon: Phone, text: "UK Support" },
    { icon: Wifi, text: "Ofcom Regulated" },
  ];

  const services = [
    { name: "Broadband", from: "£22.99", link: "/broadband" },
    { name: "Mobile SIM", from: "£7.99", link: "/sim-plans" },
    { name: "Landline", from: "£7.99", link: "/landline" },
  ];

  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 -skew-x-12 translate-x-20 hidden lg:block" />
      
      <div className="container mx-auto px-4 py-12 md:py-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground font-display text-sm uppercase tracking-wider border-2 border-foreground">
                <Zap className="w-4 h-4" />
                Now Serving Yorkshire
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 
              variants={itemVariants} 
              className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.95] tracking-tight"
            >
              Internet That
              <br />
              <span className="text-gradient">Works For You</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p 
              variants={itemVariants} 
              className="text-lg md:text-xl text-muted-foreground max-w-lg"
            >
              Broadband, mobile & landline from <span className="text-foreground font-semibold">actual humans</span>. 
              Leave anytime—we earn your loyalty, not lock you in.
            </motion.p>

            {/* Benefits Row */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-wrap gap-3"
            >
              {benefits.map((benefit) => (
                <div
                  key={benefit.text}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-2 ${
                    benefit.highlight 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-foreground/20 bg-background"
                  }`}
                >
                  <benefit.icon className="w-4 h-4" />
                  {benefit.text}
                </div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-4 pt-2">
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
            className="grid gap-4"
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
            
            {services.map((service, i) => (
              <motion.div
                key={service.name}
                variants={itemVariants}
                whileHover={{ x: 8, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}
                transition={{ duration: 0.15 }}
              >
                <Link
                  to={service.link}
                  className="flex items-center justify-between p-5 bg-card border-4 border-foreground hover:bg-accent/10 transition-colors group"
                >
                  <div>
                    <h3 className="font-display text-xl uppercase">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">No contract required</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl text-primary">{service.from}</p>
                    <p className="text-sm text-muted-foreground">/month</p>
                  </div>
                  <ArrowRight className="w-6 h-6 ml-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </motion.div>
            ))}

            {/* Trust Badge */}
            <motion.div 
              variants={itemVariants}
              className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">🇬🇧</span> 100% British
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Ofcom Regulated
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
