import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, PhoneCall, VoicemailIcon, Shield, ArrowRight, Clock, Globe } from "lucide-react";

const plans = [
  {
    name: "Pay As You Go",
    price: "9.99",
    callRate: "10p/min",
    description: "For occasional callers",
    features: [
      "Line rental included",
      "10p per minute UK calls",
      "Caller display",
      "Voicemail",
      "Call waiting",
    ],
    popular: false,
  },
  {
    name: "Evening & Weekend",
    price: "14.99",
    callRate: "Free evenings",
    description: "Perfect for chatting after work",
    features: [
      "Line rental included",
      "Free UK calls 7pm-7am",
      "Free weekend calls",
      "Caller display",
      "Voicemail",
      "Call waiting",
      "Anonymous call reject",
    ],
    popular: false,
  },
  {
    name: "Anytime",
    price: "19.99",
    callRate: "Always free",
    description: "Unlimited calls, any time",
    features: [
      "Line rental included",
      "Unlimited UK calls 24/7",
      "Caller display",
      "Voicemail",
      "Call waiting",
      "Anonymous call reject",
      "International calls from 3p/min",
    ],
    popular: true,
  },
  {
    name: "International",
    price: "29.99",
    callRate: "Worldwide",
    description: "For family abroad",
    features: [
      "Line rental included",
      "Unlimited UK calls 24/7",
      "300 mins to 50+ countries",
      "Caller display",
      "Voicemail",
      "Call waiting",
      "Priority fault repair",
    ],
    popular: false,
  },
];

const Landline = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-0">
              <PhoneCall className="w-3 h-3 mr-1" />
              Crystal clear digital voice
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold mb-6">
              Yes, landlines still exist.
              <span className="text-gradient"> And they're brilliant.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Reliable calls that don't drop when someone walks past the router. Perfect for when you actually want to have a proper chat with your mum.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <span>Fraud protection</span>
              </div>
              <div className="flex items-center gap-2">
                <VoicemailIcon className="w-4 h-4 text-primary" />
                <span>Free voicemail</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                <span>24/7 support</span>
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
              Landline plans that make sense
            </h2>
            <p className="text-muted-foreground">
              No hidden charges. No surprise bills. Just straightforward calling.
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
                    <Badge variant="secondary">{plan.callRate}</Badge>
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
                      Choose {plan.name}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All plans require OCCTA broadband. Bundle and save up to 20%.
            <Link to="/bundles" className="underline hover:text-primary ml-1">
              View bundles
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
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Scam Call Blocking</h3>
              <p className="text-muted-foreground text-sm">
                We block known scam numbers before they even reach you. Take that, fraudsters.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <VoicemailIcon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Visual Voicemail</h3>
              <p className="text-muted-foreground text-sm">
                See your voicemails in our app. Play, delete, or save them without calling in.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-warning" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Call Anywhere</h3>
              <p className="text-muted-foreground text-sm">
                Use our app to make landline calls from your mobile. Same number, no extra cost.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-navy-foreground mb-4">
            Bundle with broadband and save
          </h2>
          <p className="text-navy-foreground/70 mb-8">
            Add a landline to your broadband for as little as £5/month extra.
          </p>
          <Link to="/bundles">
            <Button variant="hero" size="lg">
              View Bundle Deals
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default Landline;
