import { motion } from "framer-motion";
import { ArrowDown, Zap, Shield, HeartHandshake } from "lucide-react";
import PostcodeChecker from "./PostcodeChecker";

const HeroSection = () => {
  // Brutalist stagger animation
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

  const decorativeVariants = {
    hidden: { opacity: 0, scale: 0, rotate: 0 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      rotate: i,
      transition: {
        duration: 0.6,
        delay: 0.3 + Math.random() * 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    }),
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center grid-pattern overflow-hidden">
      {/* Animated Decorative Elements */}
      <motion.div
        custom={12}
        variants={decorativeVariants}
        initial="hidden"
        animate="visible"
        className="absolute top-20 right-10 w-32 h-32 border-4 border-foreground bg-primary hidden lg:block"
      />
      <motion.div
        custom={-6}
        variants={decorativeVariants}
        initial="hidden"
        animate="visible"
        className="absolute bottom-32 left-10 w-24 h-24 border-4 border-foreground bg-accent hidden lg:block"
      />
      <motion.div
        custom={45}
        variants={decorativeVariants}
        initial="hidden"
        animate="visible"
        className="absolute top-1/3 left-20 w-16 h-16 border-4 border-foreground bg-warning hidden xl:block"
      />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          className="max-w-5xl mx-auto space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-block">
            <motion.div 
              className="stamp text-accent border-accent text-sm"
              whileHover={{ scale: 1.05, rotate: -2 }}
              transition={{ duration: 0.2 }}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Now in Yorkshire!
            </motion.div>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={itemVariants} className="text-display-xl">
            INTERNET
            <br />
            THAT DOESN'T
            <br />
            <motion.span 
              className="text-gradient inline-block"
              whileHover={{ x: 10 }}
              transition={{ duration: 0.2 }}
            >
              MAKE YOU SCREAM
            </motion.span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p variants={itemVariants} className="text-xl md:text-2xl max-w-2xl font-medium leading-relaxed">
            Broadband, mobile & landline from{" "}
            <span className="cutout">actual humans</span>{" "}
            who know that "have you tried turning it off and on again" 
            isn't always the answer.
          </motion.p>

          {/* Postcode Checker */}
          <motion.div variants={itemVariants} className="pt-4">
            <p className="font-display text-lg mb-4 uppercase tracking-wider">
              Check what's available at your gaff:
            </p>
            <PostcodeChecker />
          </motion.div>

          {/* Trust Badges */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-6 pt-8">
            {[
              { icon: Shield, text: "Ofcom Regulated", bg: "bg-background" },
              { icon: HeartHandshake, text: "UK Support", bg: "bg-background" },
              { icon: null, text: "100% British", emoji: "🇬🇧", bg: "bg-primary text-primary-foreground" },
            ].map((badge, i) => (
              <motion.div
                key={badge.text}
                className={`flex items-center gap-3 px-4 py-2 border-4 border-foreground ${badge.bg}`}
                whileHover={{ 
                  y: -4, 
                  x: -4,
                  boxShadow: "8px 8px 0px 0px hsl(var(--foreground))",
                }}
                transition={{ duration: 0.15 }}
              >
                {badge.icon ? (
                  <badge.icon className="w-5 h-5" />
                ) : (
                  <span className="text-lg">{badge.emoji}</span>
                )}
                <span className="font-display uppercase tracking-wide">{badge.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <motion.div
            className="p-3 border-4 border-foreground bg-background cursor-pointer"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.1 }}
          >
            <ArrowDown className="w-6 h-6" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
