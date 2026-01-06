import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, Sparkles } from "lucide-react";

const CTASection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const decorativeVariants = {
    hidden: { opacity: 0, scale: 0, rotate: 0 },
    visible: (i: number) => ({
      opacity: 0.2,
      scale: 1,
      rotate: i,
      transition: {
        duration: 0.6,
        delay: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    }),
  };

  return (
    <section className="py-24 bg-foreground text-background relative overflow-hidden">
      {/* Animated Decorative Elements */}
      <motion.div
        custom={12}
        variants={decorativeVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="absolute top-10 right-20 w-32 h-32 border-4 border-primary hidden lg:block"
      />
      <motion.div
        custom={-6}
        variants={decorativeVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="absolute bottom-10 left-20 w-24 h-24 border-4 border-accent hidden lg:block"
      />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-block mb-8">
            <motion.div
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 border-4 border-primary"
              whileHover={{ scale: 1.05, rotate: -1 }}
              transition={{ duration: 0.2 }}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-display uppercase tracking-wider">Limited Time: Free Installation Worth £60</span>
            </motion.div>
          </motion.div>

          {/* Headline */}
          <motion.h2 variants={itemVariants} className="text-display-lg mb-6">
            READY TO SWITCH TO
            <br />
            INTERNET THAT
            <br />
            <motion.span 
              className="text-primary inline-block"
              whileHover={{ x: 10, scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              ACTUALLY WORKS?
            </motion.span>
          </motion.h2>

          {/* Subtext */}
          <motion.p
            variants={itemVariants}
            className="text-xl text-background/70 max-w-xl mb-10"
          >
            Join the growing number of sensible people who've had enough of the big providers. 
            We'll even handle the switch for you — no hassle, no downtime, no drama.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link to="/auth?mode=signup">
              <motion.div
                whileHover={{ 
                  y: -6, 
                  x: -4,
                  boxShadow: "10px 10px 0px 0px hsl(var(--background))",
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <Button variant="hero" size="xl" className="w-full sm:w-auto border-background">
                  Get Started Now
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <a href="tel:08002606627">
              <motion.div
                whileHover={{ 
                  y: -6, 
                  x: -4,
                  boxShadow: "10px 10px 0px 0px hsl(var(--background) / 0.3)",
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <Button 
                  variant="outline" 
                  size="xl" 
                  className="w-full sm:w-auto bg-transparent border-background text-background hover:bg-background hover:text-foreground"
                >
                  <Phone className="w-5 h-5" />
                  Call 0800 260 6627
                </Button>
              </motion.div>
            </a>
          </motion.div>

          {/* Trust Note */}
          <motion.p
            variants={itemVariants}
            className="mt-8 text-sm text-background/50 font-display uppercase tracking-wider"
          >
            No contracts longer than 30 days • Cancel anytime • We're confident, not desperate
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
