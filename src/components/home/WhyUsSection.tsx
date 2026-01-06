import { motion } from "framer-motion";
import { Phone, Clock, PoundSterling, Users, Zap, ThumbsUp } from "lucide-react";

const reasons = [
  {
    icon: Phone,
    title: "HUMANS ANSWER",
    description: "Ring us and a real person picks up. In Huddersfield. Speaking English. Mental, right?",
  },
  {
    icon: Clock,
    title: "30-DAY CONTRACTS",
    description: "Because locking you in for 24 months is what scared companies do.",
  },
  {
    icon: PoundSterling,
    title: "NO PRICE HIKES",
    description: "The price you sign up for is the price you pay. Groundbreaking stuff.",
  },
  {
    icon: Users,
    title: "SMALL BUSINESS, BIG CARE",
    description: "We're not a faceless corporation. We're 22 people who actually give a toss.",
  },
  {
    icon: Zap,
    title: "QUICK SETUP",
    description: "Most installs happen within 7 days. Life's too short to wait for internet.",
  },
  {
    icon: ThumbsUp,
    title: "98% RECOMMEND US",
    description: "The other 2% probably just forgot to tick the box.",
  },
];

const stats = [
  { value: "5K+", label: "Happy Customers" },
  { value: "98%", label: "Recommend Us" },
  { value: "<30s", label: "Avg. Call Answer" },
  { value: "0", label: "Robot Menus" },
];

const WhyUsSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, rotate: -1 },
    visible: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const statsVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  return (
    <section className="py-24 grid-pattern">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={headerVariants}
        >
          <motion.div
            className="inline-block stamp text-primary border-primary mb-6"
            initial={{ rotate: 0, scale: 0 }}
            whileInView={{ rotate: -2, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ rotate: 2, scale: 1.05 }}
          >
            No BS Guarantee
          </motion.div>
          <h2 className="text-display-md mb-4">
            WHY PEOPLE ACTUALLY
            <br />
            <motion.span 
              className="text-gradient inline-block"
              whileHover={{ scale: 1.02 }}
            >
              LIKE US
            </motion.span>
          </h2>
          <p className="text-xl text-muted-foreground">
            We're not reinventing the wheel. We're just doing the obvious things 
            that big telecoms somehow forgot about.
          </p>
        </motion.div>

        {/* Reasons Grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={containerVariants}
        >
          {reasons.map((reason) => (
            <motion.div
              key={reason.title}
              className="group p-6 border-4 border-transparent hover:border-foreground hover:bg-card transition-colors duration-150"
              variants={itemVariants}
              whileHover={{
                y: -6,
                x: -4,
                boxShadow: "10px 10px 0px 0px hsl(var(--foreground))",
                transition: { duration: 0.15, ease: "easeOut" },
              }}
            >
              <div className="flex items-start gap-4">
                <motion.div
                  className="w-12 h-12 bg-foreground text-background flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  whileHover={{ rotate: 5, scale: 1.1 }}
                >
                  <reason.icon className="w-6 h-6" />
                </motion.div>
                <div>
                  <h3 className="font-display text-xl mb-2">{reason.title}</h3>
                  <p className="text-muted-foreground">{reason.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          className="mt-20 border-4 border-foreground bg-foreground text-background overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={statsVariants}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-4 divide-background">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * index, duration: 0.4 }}
                whileHover={{ 
                  backgroundColor: "hsl(var(--primary))",
                  transition: { duration: 0.2 }
                }}
              >
                <motion.div
                  className="font-display text-display-md text-primary"
                  whileHover={{ scale: 1.1 }}
                >
                  {stat.value}
                </motion.div>
                <div className="font-display uppercase tracking-wider text-sm">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WhyUsSection;
