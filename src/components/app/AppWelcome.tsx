import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  Shield, 
  Zap, 
  Clock, 
  ArrowRight,
  Headphones,
  CheckCircle2,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  { icon: Shield, title: "No Contract", desc: "Cancel anytime, no hidden fees" },
  { icon: Zap, title: "Super Fast", desc: "Ultra-fast broadband speeds" },
  { icon: Clock, title: "24/7 Support", desc: "Always here to help you" },
  { icon: Headphones, title: "UK Based", desc: "Local customer support team" },
];

const services = [
  { icon: Wifi, label: "Broadband", desc: "From £24.99/mo", link: "/broadband", color: "bg-accent" },
  { icon: Smartphone, label: "SIM Plans", desc: "From £5.99/mo", link: "/sim-plans", color: "bg-primary" },
  { icon: PhoneCall, label: "Landline", desc: "From £9.99/mo", link: "/landline", color: "bg-warning" },
];

const AppWelcome = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-accent px-6 pt-12 pb-16 rounded-b-[40px] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-accent-foreground blur-3xl" />
          <div className="absolute bottom-10 right-10 w-24 h-24 rounded-full bg-accent-foreground blur-2xl" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
              <span className="font-bold text-accent text-lg">O</span>
            </div>
            <span className="font-bold text-accent-foreground text-xl">OCCTA</span>
          </div>
          
          <h1 className="text-3xl font-bold text-accent-foreground mb-3">
            Switch to Better<br />Broadband Today
          </h1>
          <p className="text-accent-foreground/80 text-sm mb-8">
            No contracts, no hassle. Fast, reliable internet for your home.
          </p>

          <div className="flex gap-3">
            <Link to="/auth" className="flex-1">
              <Button className="w-full h-12 rounded-xl bg-background text-accent hover:bg-background/90 font-semibold">
                Sign In
              </Button>
            </Link>
            <Link to="/broadband" className="flex-1">
              <Button variant="outline" className="w-full h-12 rounded-xl border-2 border-accent-foreground/30 text-accent-foreground hover:bg-accent-foreground/10 font-semibold">
                Browse Plans
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="px-4 -mt-8">
        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 shadow-sm mb-4"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-warning" />
            Why Choose OCCTA?
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <benefit.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Services */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3 mb-4"
        >
          <h3 className="font-semibold px-1">Our Services</h3>
          {services.map((service) => (
            <Link
              key={service.label}
              to={service.link}
              className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-sm"
            >
              <div className={`w-14 h-14 rounded-2xl ${service.color} flex items-center justify-center`}>
                <service.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{service.label}</p>
                <p className="text-sm text-muted-foreground">{service.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          ))}
        </motion.div>

        {/* Features List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted/50 rounded-2xl p-4 mb-4"
        >
          <h3 className="font-semibold mb-3">What You Get</h3>
          <div className="space-y-2">
            {[
              "Unlimited data on all broadband plans",
              "Free router included",
              "No activation fees",
              "Switch from any provider easily",
              "Easy online account management"
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-accent rounded-2xl p-5 text-center mb-8"
        >
          <h3 className="font-bold text-accent-foreground text-lg mb-2">Ready to Switch?</h3>
          <p className="text-accent-foreground/80 text-sm mb-4">
            Join thousands of happy customers
          </p>
          <Link to="/broadband">
            <Button className="w-full h-12 rounded-xl bg-background text-accent hover:bg-background/90 font-semibold">
              Get Started Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>

        {/* Already have account */}
        <div className="text-center pb-8">
          <p className="text-sm text-muted-foreground mb-2">Already a customer?</p>
          <Link to="/auth" className="text-accent font-semibold text-sm">
            Sign in to your account →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AppWelcome;
