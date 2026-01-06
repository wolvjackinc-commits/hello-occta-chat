import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Smartphone, Signal, Globe, ArrowRight, Phone, MessageSquare } from "lucide-react";

const plans = [
  {
    name: "Starter",
    data: "5GB",
    price: "8.99",
    description: "For light users and second phones",
    features: [
      "5GB data",
      "Unlimited UK calls",
      "Unlimited texts",
      "5G ready",
      "EU roaming",
    ],
    popular: false,
  },
  {
    name: "Essential",
    data: "15GB",
    price: "12.99",
    description: "Perfect for everyday use",
    features: [
      "15GB data",
      "Unlimited UK calls",
      "Unlimited texts",
      "5G ready",
      "EU roaming",
      "Data rollover",
    ],
    popular: false,
  },
  {
    name: "Plus",
    data: "50GB",
    price: "19.99",
    description: "For the social media enthusiasts",
    features: [
      "50GB data",
      "Unlimited UK calls",
      "Unlimited texts",
      "5G ready",
      "EU roaming (30GB)",
      "Data rollover",
      "Free data pass add-ons",
    ],
    popular: true,
  },
  {
    name: "Unlimited",
    data: "∞",
    price: "29.99",
    description: "Never worry about data again",
    features: [
      "Unlimited data",
      "Unlimited UK calls",
      "Unlimited texts",
      "5G priority access",
      "EU roaming (50GB)",
      "Free international calls (50 countries)",
      "Multi-SIM support",
    ],
    popular: false,
  },
];

const SimPlans = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-0">
              <Signal className="w-3 h-3 mr-1" />
              5G now available in 500+ UK towns
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold mb-6">
              SIM plans that
              <span className="text-gradient"> don't take the mick</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              No credit checks. No long contracts. No "fair usage" policies that aren't actually fair. Just great mobile service at honest prices.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-accent" />
                <span>Full 5G network</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>EU roaming included</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-warning" />
                <span>Keep your number</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">
              Choose your data, not your battles
            </h2>
            <p className="text-muted-foreground">
              All plans are 30-day rolling. Switch up, switch down, or switch off whenever you like.
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
                    Best Value
                  </div>
                )}
                <CardHeader className={plan.popular ? "pt-10" : ""}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-bold">£{plan.price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-lg">
                        {plan.data}
                      </Badge>
                      <span className="text-sm text-muted-foreground">data</span>
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
                      Get {plan.name}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All SIM plans require a compatible unlocked phone. 
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
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Keep Your Number</h3>
              <p className="text-muted-foreground text-sm">
                Text 'PAC' to 65075 to get your code. We'll do the rest. Takes about 24 hours.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Signal className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Real 5G Coverage</h3>
              <p className="text-muted-foreground text-sm">
                Not the "technically 5G but actually just fast 4G" nonsense. Proper 5G, where it's available.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-warning" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">WiFi Calling</h3>
              <p className="text-muted-foreground text-sm">
                Bad signal at home? No problem. Make calls over your WiFi. It's like magic, but real.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-navy-foreground mb-4">
            Ready to ditch your current provider?
          </h2>
          <p className="text-navy-foreground/70 mb-8">
            Free SIM delivery. Free activation. Free from contracts that trap you.
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="hero" size="lg">
              Order Your SIM
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default SimPlans;
