import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, Sparkles } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-primary/20" />
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Limited Time: Free Installation Worth £60</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-navy-foreground leading-tight">
            Ready to switch to internet
            <br />
            that actually works?
          </h2>

          {/* Subtext */}
          <p className="text-lg text-navy-foreground/70 max-w-xl mx-auto">
            Join the growing number of sensible people who've had enough of the big providers. 
            We'll even handle the switch for you - no hassle, no downtime, no drama.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="xl" className="w-full sm:w-auto">
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:08002606627">
              <Button 
                variant="outline" 
                size="xl" 
                className="w-full sm:w-auto border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                <Phone className="w-5 h-5" />
                Call 0800 260 6627
              </Button>
            </a>
          </div>

          {/* Trust Note */}
          <p className="text-sm text-navy-foreground/50">
            No contracts longer than 30 days. Cancel anytime. We're confident, not desperate.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
