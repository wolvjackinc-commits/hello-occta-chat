import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MapPin, Users, Award, Heart, ArrowRight, Phone, Shield } from "lucide-react";

const About = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-display font-bold mb-6">
              We're OCCTA.
              <span className="text-gradient"> Nice to meet you.</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              We're a small team from Huddersfield who got fed up with rubbish telecoms. 
              So we started our own. Bold move? Maybe. Working out so far? Absolutely.
            </p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-display font-bold mb-6">
                  Our story
                  <br />
                  <span className="text-muted-foreground text-xl font-normal">
                    (spoiler: it involves a lot of tea)
                  </span>
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    It started in 2022 when our founder tried to cancel a broadband contract. 
                    After 3 hours on hold, 4 different departments, and one very strong cup of tea, 
                    they decided there had to be a better way.
                  </p>
                  <p>
                    OCCTA was born from that frustration. We figured: what if a telecom company 
                    actually treated customers like humans? What if prices were transparent, 
                    support was helpful, and you could understand your bill without a PhD in accounting?
                  </p>
                  <p>
                    Revolutionary stuff, we know. But here we are – growing every month, 
                    winning customers who've had enough of the big providers, and 
                    occasionally getting nice reviews that make us genuinely happy.
                  </p>
                </div>
              </div>
              <div className="bg-secondary rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">Based in Yorkshire</h3>
                    <p className="text-sm text-muted-foreground">Huddersfield, to be precise</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">5,000+ customers</h3>
                    <p className="text-sm text-muted-foreground">And counting</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Award className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">Ofcom Regulated</h3>
                    <p className="text-sm text-muted-foreground">Playing by the rules</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">4.8 stars on Trustpilot</h3>
                    <p className="text-sm text-muted-foreground">From verified customers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-bold text-center mb-12">
              What we believe in
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-card rounded-2xl p-8 border border-border/50">
                <h3 className="text-xl font-display font-bold mb-4">🎯 Honesty first</h3>
                <p className="text-muted-foreground">
                  No hidden fees. No sneaky price rises. No "terms and conditions apply" in tiny print. 
                  If something costs money, we tell you upfront. Revolutionary, apparently.
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 border border-border/50">
                <h3 className="text-xl font-display font-bold mb-4">👋 Humans over bots</h3>
                <p className="text-muted-foreground">
                  When you call us, a real person answers. They're probably drinking tea and 
                  genuinely want to help. No AI chatbots, no "your call is important to us" lies.
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 border border-border/50">
                <h3 className="text-xl font-display font-bold mb-4">⚡ Keep it simple</h3>
                <p className="text-muted-foreground">
                  Telecoms are confusing enough. We make our plans, prices, and policies as 
                  simple as possible. If your nan can't understand it, we haven't done our job.
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 border border-border/50">
                <h3 className="text-xl font-display font-bold mb-4">🌍 Give a toss</h3>
                <p className="text-muted-foreground">
                  About our customers, our community, and the planet. We're carbon-neutral, 
                  we sponsor local sports teams, and we genuinely care if your broadband works.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-display font-bold mb-4">
              Fancy joining the revolution?
            </h2>
            <p className="text-muted-foreground mb-8">
              Whether you're after broadband, mobile, or just someone who'll answer the phone when you call – we're here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/broadband">
                <Button variant="hero" size="lg">
                  View Our Services
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:08002606627">
                <Button variant="outline" size="lg">
                  <Phone className="w-5 h-5" />
                  0800 260 6627
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Legal Info */}
      <section className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border/50">
              <Shield className="w-6 h-6 text-accent mt-1" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Company Information</p>
                <p>
                  OCCTA LIMITED is a company registered in England and Wales (Company No. XXXXXXXX) 
                  at 22 Pavilion View, Huddersfield, HD3 3WU. We are authorised by Ofcom to provide 
                  electronic communications services in the UK. We comply with GDPR, the Data Protection 
                  Act 2018, and all applicable UK telecommunications regulations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
