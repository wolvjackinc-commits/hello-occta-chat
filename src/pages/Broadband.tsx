import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { Check, Wifi, Zap, Shield, Clock, ArrowRight, HelpCircle } from "lucide-react";

const plans = [
  {
    name: "Essential",
    speed: "36",
    price: "24.99",
    description: "Perfect for light browsing and streaming",
    features: [
      "Up to 36Mbps download",
      "10Mbps upload",
      "Unlimited usage",
      "Free router included",
      "24/7 support",
    ],
    popular: false,
    cta: "Choose Essential",
  },
  {
    name: "Superfast",
    speed: "150",
    price: "32.99",
    description: "Great for busy households and HD streaming",
    features: [
      "Up to 150Mbps download",
      "25Mbps upload",
      "Unlimited usage",
      "Premium router included",
      "Priority support",
      "Static IP available",
    ],
    popular: true,
    cta: "Choose Superfast",
  },
  {
    name: "Ultrafast",
    speed: "500",
    price: "44.99",
    description: "Blazing speeds for power users and gamers",
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
    cta: "Choose Ultrafast",
  },
  {
    name: "Gigabit",
    speed: "900",
    price: "59.99",
    description: "The fastest internet money can buy",
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
    cta: "Choose Gigabit",
  },
];

const Broadband = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-0">
              <Zap className="w-3 h-3 mr-1" />
              Free installation until March
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold mb-6">
              Broadband that actually
              <span className="text-gradient"> works</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Fast, reliable internet without the corporate nonsense. From streaming Netflix to hosting video calls for the entire office – we've got you covered.
            </p>
            <PostcodeChecker />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">
              Pick your speed, skip the hassle
            </h2>
            <p className="text-muted-foreground">
              All plans include unlimited data and no price rises mid-contract. Novel concept, we know.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative overflow-hidden card-hover ${
                  plan.popular ? "border-primary shadow-glow" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-xs font-semibold">
                    Most Popular
                  </div>
                )}
                <CardHeader className={plan.popular ? "pt-10" : ""}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-bold">£{plan.price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wifi className="w-4 h-4 text-accent" />
                      Up to {plan.speed}Mbps
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link to="/auth?mode=signup" className="w-full">
                    <Button 
                      variant={plan.popular ? "hero" : "outline"} 
                      className="w-full"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All prices exclude line rental. 30-day rolling contracts available. 
            <Link to="/terms" className="underline hover:text-primary ml-1">
              Full terms apply
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">No Speed Throttling</h3>
              <p className="text-muted-foreground text-sm">
                Unlimited means unlimited. Stream, download, game – all at full speed, all the time.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Free Security Suite</h3>
              <p className="text-muted-foreground text-sm">
                Protect your devices with our included antivirus and parental controls.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-warning" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Yorkshire Support</h3>
              <p className="text-muted-foreground text-sm">
                Real humans in Huddersfield who actually understand broadband. Fancy that!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-navy-foreground mb-4">
            Ready to make the switch?
          </h2>
          <p className="text-navy-foreground/70 mb-8">
            We handle everything – even cancelling your old provider. No faff, no fuss.
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="hero" size="lg">
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
