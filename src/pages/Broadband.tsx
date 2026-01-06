import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { Check, Wifi, Zap, Shield, Clock, ArrowRight, HelpCircle } from "lucide-react";

const plans = [
  {
    name: "ESSENTIAL",
    speed: "36",
    price: "24.99",
    description: "Perfect for light browsing and the occasional Netflix binge",
    features: [
      "Up to 36Mbps download",
      "10Mbps upload",
      "Unlimited usage",
      "Free router included",
      "24/7 support",
    ],
    popular: false,
  },
  {
    name: "SUPERFAST",
    speed: "150",
    price: "32.99",
    description: "For households that actually use the internet properly",
    features: [
      "Up to 150Mbps download",
      "25Mbps upload",
      "Unlimited usage",
      "Premium router included",
      "Priority support",
      "Static IP available",
    ],
    popular: true,
  },
  {
    name: "ULTRAFAST",
    speed: "500",
    price: "44.99",
    description: "For gamers, streamers, and people who work from home",
    features: [
      "Up to 500Mbps download",
      "100Mbps upload",
      "Unlimited usage",
      "WiFi 6 router included",
      "Priority support",
      "Free static IP",
      "Guest network setup",
    ],
    popular: false,
  },
  {
    name: "GIGABIT",
    speed: "900",
    price: "59.99",
    description: "The fastest internet money can buy. Period.",
    features: [
      "Up to 900Mbps download",
      "200Mbps upload",
      "Unlimited usage",
      "WiFi 6E mesh system",
      "Dedicated support line",
      "Free static IP",
      "Smart home setup",
      "1TB cloud backup",
    ],
    popular: false,
  },
];

const Broadband = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <div className="inline-block stamp text-accent border-accent mb-6 rotate-[-2deg]">
              <Zap className="w-4 h-4 inline mr-2" />
              Free installation until March
            </div>
            <h1 className="text-display-lg mb-6">
              BROADBAND THAT
              <br />
              <span className="text-gradient">ACTUALLY WORKS</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              Fast, reliable internet without the corporate nonsense. 
              From streaming Netflix to hosting video calls for the entire office — we've got you sorted.
            </p>
            <PostcodeChecker />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <h2 className="text-display-md mb-4">
              PICK YOUR SPEED
            </h2>
            <p className="text-xl text-muted-foreground">
              All plans include unlimited data and no price rises mid-contract. Novel concept, we know.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div 
                key={plan.name} 
                className={`relative card-brutal bg-card p-6 flex flex-col animate-slide-up ${
                  plan.popular ? "border-primary" : ""
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-4 bg-primary text-primary-foreground px-4 py-1 font-display uppercase tracking-wider text-sm border-4 border-foreground">
                    Most Popular
                  </div>
                )}
                
                <div className={plan.popular ? "pt-4" : ""}>
                  <h3 className="font-display text-3xl mb-2">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-5xl">£{plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-accent/10 border-2 border-accent inline-block">
                    <Wifi className="w-4 h-4 text-accent" />
                    <span className="font-display text-accent">Up to {plan.speed}Mbps</span>
                  </div>
                  
                  <p className="text-muted-foreground mb-6">{plan.description}</p>
                  
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <Check className="w-5 h-5 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to="/auth?mode=signup" className="block">
                    <Button 
                      variant={plan.popular ? "default" : "outline"} 
                      className="w-full"
                    >
                      Choose {plan.name}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All prices exclude line rental. 30-day rolling contracts available.{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Full terms apply
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-6 border-4 border-foreground bg-card text-center">
              <div className="w-16 h-16 bg-primary border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">NO THROTTLING</h3>
              <p className="text-muted-foreground">
                Unlimited means unlimited. Stream, download, game — all at full speed, all the time.
              </p>
            </div>
            
            <div className="p-6 border-4 border-foreground bg-card text-center">
              <div className="w-16 h-16 bg-accent border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-accent-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">FREE SECURITY</h3>
              <p className="text-muted-foreground">
                Protect your devices with our included antivirus and parental controls.
              </p>
            </div>
            
            <div className="p-6 border-4 border-foreground bg-card text-center">
              <div className="w-16 h-16 bg-warning border-4 border-foreground flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-warning-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">YORKSHIRE SUPPORT</h3>
              <p className="text-muted-foreground">
                Real humans in Huddersfield who actually understand broadband. Fancy that!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-foreground text-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-display-md mb-4">
            READY TO SWITCH?
          </h2>
          <p className="text-background/70 mb-8 text-lg">
            We handle everything — even cancelling your old provider. No faff, no fuss.
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="hero" size="lg" className="border-background">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Broadband;
