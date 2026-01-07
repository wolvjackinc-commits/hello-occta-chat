import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wifi, Smartphone, PhoneCall, ArrowRight, Package, HelpCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Wifi,
    title: "Broadband",
    price: "From £22.99/mo",
    link: "/broadband",
    color: "bg-primary",
  },
  {
    icon: Smartphone,
    title: "SIM Plans",
    price: "From £7.99/mo",
    link: "/sim-plans",
    color: "bg-accent",
  },
  {
    icon: PhoneCall,
    title: "Landline",
    price: "From £7.99/mo",
    link: "/landline",
    color: "bg-warning",
  },
];

const quickActions = [
  { icon: Package, label: "My Orders", link: "/dashboard" },
  { icon: HelpCircle, label: "Get Help", link: "/support" },
  { icon: User, label: "Account", link: "/dashboard" },
];

const AppHome = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      className="px-4 py-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="mb-6">
        <h1 className="text-2xl font-display font-bold mb-1">
          Hello! 👋
        </h1>
        <p className="text-muted-foreground text-sm">
          What service are you looking for today?
        </p>
      </motion.div>

      {/* Services Grid */}
      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Our Services
        </h2>
        <div className="space-y-3">
          {services.map((service) => (
            <motion.div
              key={service.title}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to={service.link}
                className="flex items-center gap-4 p-4 bg-card border-4 border-foreground active:bg-secondary transition-colors"
              >
                <div className={`w-12 h-12 ${service.color} border-2 border-foreground flex items-center justify-center`}>
                  <service.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg uppercase">{service.title}</h3>
                  <p className="text-sm text-muted-foreground">{service.price}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <motion.div key={action.label} whileTap={{ scale: 0.95 }}>
              <Link
                to={action.link}
                className="flex flex-col items-center gap-2 p-4 bg-secondary border-4 border-foreground text-center"
              >
                <action.icon className="w-6 h-6" />
                <span className="text-xs font-display uppercase">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Banner */}
      <motion.div variants={itemVariants}>
        <div className="p-4 bg-primary border-4 border-foreground">
          <h3 className="font-display text-lg uppercase mb-2">No Contracts</h3>
          <p className="text-sm mb-3">Cancel anytime. No hidden fees. Real UK support.</p>
          <Link to="/broadband">
            <Button variant="outline" size="sm" className="bg-background border-2 border-foreground">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AppHome;
