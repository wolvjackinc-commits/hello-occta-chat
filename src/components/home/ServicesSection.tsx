import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wifi, Smartphone, PhoneCall, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Wifi,
    title: "BROADBAND",
    subtitle: "Internet that actually works",
    description: "From 36Mbps for the casual browser to 900Mbps for the household of gamers, streamers, and people who video call too much.",
    price: "From £24.99/mo",
    link: "/broadband",
    color: "bg-primary",
    accent: "border-primary",
  },
  {
    icon: Smartphone,
    title: "SIM PLANS",
    subtitle: "Mobile without the mobile drama",
    description: "Unlimited texts, plenty of data, and calls that don't drop mid-sentence. Revolutionary concept, we know.",
    price: "From £8.99/mo",
    link: "/sim-plans",
    color: "bg-accent",
    accent: "border-accent",
  },
  {
    icon: PhoneCall,
    title: "LANDLINE",
    subtitle: "For the traditionalists",
    description: "Crystal clear calls, no line rental games, and actual voicemail that works. Your nan will be chuffed.",
    price: "From £11.99/mo",
    link: "/landline",
    color: "bg-warning",
    accent: "border-warning",
  },
];

const ServicesSection = () => {
  return (
    <section className="py-24 bg-secondary stripes">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <h2 className="text-display-md mb-4">
            WHAT WE
            <span className="text-gradient ml-4">ACTUALLY DO</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Three services. Zero nonsense. All with proper customer support 
            from people who speak your language.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group card-brutal bg-card p-8 flex flex-col animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`w-16 h-16 ${service.color} border-4 border-foreground flex items-center justify-center mb-6`}>
                <service.icon className="w-8 h-8 text-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-display-md mb-2">{service.title}</h3>
              <p className="font-display text-lg text-muted-foreground uppercase tracking-wide mb-4">
                {service.subtitle}
              </p>
              <p className="text-muted-foreground flex-grow mb-6">
                {service.description}
              </p>

              {/* Price */}
              <div className={`inline-block self-start px-4 py-2 ${service.color} border-4 border-foreground mb-6`}>
                <span className="font-display text-lg">{service.price}</span>
              </div>

              {/* CTA */}
              <Link to={service.link}>
                <Button variant="outline" className="w-full group-hover:bg-foreground group-hover:text-background transition-colors">
                  View Plans
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
