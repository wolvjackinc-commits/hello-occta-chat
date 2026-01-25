import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wifi, Smartphone, PhoneCall, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Wifi,
    title: "BROADBAND",
    subtitle: "Internet that actually works",
    description: "From 36Mbps for the casual browser to 900Mbps for the household of gamers, streamers, and people who video call too much.",
    price: "From £22.99/mo",
    link: "/broadband",
    color: "bg-primary",
    accent: "border-primary",
  },
  {
    icon: Smartphone,
    title: "SIM PLANS",
    subtitle: "Mobile without the mobile drama",
    description: "Unlimited texts, plenty of data, and calls that don't drop mid-sentence. Revolutionary concept, we know.",
    price: "From £7.99/mo",
    link: "/sim-plans",
    color: "bg-accent",
    accent: "border-accent",
  },
  {
    icon: PhoneCall,
    title: "LANDLINE",
    subtitle: "For the traditionalists",
    description: "Crystal clear calls, no line rental games, and actual voicemail that works. Your nan will be chuffed.",
    price: "From £7.99/mo",
    link: "/landline",
    color: "bg-warning",
    accent: "border-warning",
  },
];

const ServicesSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, x: -40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 60, rotate: -2 },
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
    <section className="py-24 bg-secondary stripes">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="max-w-3xl mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={headerVariants}
        >
          <h2 className="text-display-md mb-4">
            WHAT WE
            <motion.span 
              className="text-gradient ml-4 inline-block"
              whileHover={{ scale: 1.05 }}
            >
              ACTUALLY DO
            </motion.span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Three services. Zero nonsense. UK-wide coverage with straightforward,
            contract-free pricing. Looking for cheap broadband UK, no contract broadband,
            or SIM only deals UK? You're in the right place.
          </p>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          className="grid lg:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={containerVariants}
        >
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              className="group card-brutal bg-card p-8 flex flex-col"
              variants={cardVariants}
              whileHover={{
                y: -12,
                x: -6,
                boxShadow: "14px 14px 0px 0px hsl(var(--foreground))",
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon */}
              <motion.div
                className={`w-16 h-16 ${service.color} border-4 border-foreground flex items-center justify-center mb-6`}
                whileHover={{ rotate: 5, scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <service.icon className="w-8 h-8 text-foreground" />
              </motion.div>

              {/* Content */}
              <h3 className="text-display-md mb-2">{service.title}</h3>
              <p className="font-display text-lg text-muted-foreground uppercase tracking-wide mb-4">
                {service.subtitle}
              </p>
              <p className="text-muted-foreground flex-grow mb-6">
                {service.description}
              </p>

              {/* Price */}
              <motion.div
                className={`inline-block self-start px-4 py-2 ${service.color} border-4 border-foreground mb-6`}
                whileHover={{ scale: 1.05 }}
              >
                <span className="font-display text-lg text-foreground">{service.price}</span>
              </motion.div>

              {/* CTA */}
              <Link to={service.link}>
                <Button variant="outline" className="w-full group-hover:bg-foreground group-hover:text-background transition-colors">
                  View Plans
                  <motion.span
                    className="inline-block"
                    whileHover={{ x: 5 }}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </Button>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesSection;
