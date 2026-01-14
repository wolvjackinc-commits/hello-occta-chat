import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Users, Award, Heart, ArrowRight, Phone, X } from "lucide-react";
import { SEO } from "@/components/seo";

const About = () => {
  const stats = [
    { icon: MapPin, label: "Based in Yorkshire", value: "Huddersfield" },
    { icon: Users, label: "Happy Customers", value: "5,000+" },
    { icon: Award, label: "Customer Rating", value: "4.8 Stars" },
    { icon: X, label: "Exit Fees", value: "None" },
  ];

  const values = [
    { emoji: "🎯", title: "Honesty first", description: "No hidden fees. No sneaky price rises. If something costs money, we tell you upfront." },
    { emoji: "👋", title: "Humans over bots", description: "When you call us, a real person answers. They're probably drinking tea and genuinely want to help." },
    { emoji: "⚡", title: "Keep it simple", description: "If your nan can't understand it, we haven't done our job. Simple plans, simple prices." },
    { emoji: "🌍", title: "Give a toss", description: "About our customers, our community, and the planet. We're carbon-neutral and sponsor local sports." },
  ];

  return (
    <Layout>
      <SEO 
        title="About Us"
        description="OCCTA is a Yorkshire-based telecom company providing honest, affordable broadband, SIM, and landline services. No hidden fees, real customer support."
        canonical="/about"
      />
      {/* Hero - Compact */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                WE'RE OCCTA.
                <br />
                <span className="text-gradient">NICE TO MEET YOU.</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-lg">
                A small team from Huddersfield who got fed up with rubbish telecoms. 
                So we started our own. Bold move? Maybe. Working out? Absolutely.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Link to="/broadband">
                  <Button size="lg" variant="hero">
                    View Our Services
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <a href="tel:08002606627">
                  <Button size="lg" variant="outline">
                    <Phone className="w-5 h-5" />
                    0800 260 6627
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Right - Stats */}
            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="p-6 bg-secondary rounded-xl border-4 border-foreground"
                  whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <stat.icon className="w-8 h-8 text-primary mb-3" />
                  <p className="font-display text-2xl">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values - Compact Grid */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <motion.h2 
            className="text-display-md text-center mb-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            WHAT WE BELIEVE IN
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                className="bg-card rounded-xl p-6 border-4 border-foreground"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
              >
                <span className="text-3xl mb-3 block">{value.emoji}</span>
                <h3 className="font-display text-lg mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal Info - Compact */}
      <section className="py-8 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">OCCTA LIMITED</strong> is registered in England and Wales (Company No. 13828933) 
              at 22 Pavilion View, Huddersfield, HD3 3WU. We comply with GDPR and all UK telecommunications regulations.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
