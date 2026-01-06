import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Wifi, Smartphone, PhoneCall, ArrowRight, Zap, Clock, Infinity } from "lucide-react";

const services = [
  {
    icon: Wifi,
    title: "Broadband",
    tagline: "Fast enough for everyone to stream at once",
    description: "From 'checking emails' to 'everyone in the house is on a video call' - we've got speeds that actually work.",
    features: ["Up to 900Mbps", "No speed throttling", "Free router included"],
    price: "From £24.99/mo",
    link: "/broadband",
    color: "primary",
  },
  {
    icon: Smartphone,
    title: "SIM Plans",
    tagline: "Data that doesn't disappear at 3pm",
    description: "Unlimited calls, texts, and enough data to doom-scroll to your heart's content. No nasty surprises.",
    features: ["5G ready", "EU roaming included", "No credit checks"],
    price: "From £8.99/mo",
    link: "/sim-plans",
    color: "accent",
  },
  {
    icon: PhoneCall,
    title: "Landline",
    tagline: "Yes, some people still use these",
    description: "Crystal clear calls for when you actually want to hear your mum properly. Includes all the features you'd expect.",
    features: ["Unlimited UK calls", "Voicemail included", "Call waiting & ID"],
    price: "From £9.99/mo",
    link: "/landline",
    color: "warning",
  },
];

const featureIcons: Record<string, React.ReactNode> = {
  "Up to 900Mbps": <Zap className="w-3 h-3" />,
  "No speed throttling": <Infinity className="w-3 h-3" />,
  "Free router included": <Wifi className="w-3 h-3" />,
  "5G ready": <Zap className="w-3 h-3" />,
  "EU roaming included": <span className="text-xs">🇪🇺</span>,
  "No credit checks": <span className="text-xs">✓</span>,
  "Unlimited UK calls": <Clock className="w-3 h-3" />,
  "Voicemail included": <span className="text-xs">📞</span>,
  "Call waiting & ID": <span className="text-xs">📱</span>,
};

const ServicesSection = () => {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            Everything you need, minus the headache
          </h2>
          <p className="text-lg text-muted-foreground">
            Three services, zero nonsense. Pick one, bundle them all, or just browse while pretending you're being productive.
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {services.map((service, index) => (
            <Card 
              key={service.title} 
              className="relative overflow-hidden card-hover bg-card border-0 shadow-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Color Accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-${service.color}`} />
              
              <CardHeader className="space-y-4">
                <div className={`w-14 h-14 rounded-xl bg-${service.color}/10 flex items-center justify-center`}>
                  <service.icon className={`w-7 h-7 text-${service.color}`} />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold">{service.title}</h3>
                  <p className="text-sm text-muted-foreground italic">{service.tagline}</p>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{service.description}</p>
                <ul className="space-y-2">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <span className="text-accent">{featureIcons[feature]}</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <span className="text-2xl font-display font-bold">{service.price}</span>
                </div>
                <Link to={service.link}>
                  <Button variant="ghost" className="group">
                    Learn more
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Bundle CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Want the lot? 
            <span className="font-semibold text-foreground"> Bundle and save up to 20%</span>
          </p>
          <Link to="/bundles">
            <Button variant="hero" size="lg">
              View Bundle Deals
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
