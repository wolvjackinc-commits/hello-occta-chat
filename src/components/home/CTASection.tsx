import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, Sparkles } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 bg-foreground text-background relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-10 right-20 w-32 h-32 border-4 border-primary rotate-12 opacity-20 hidden lg:block" />
      <div className="absolute bottom-10 left-20 w-24 h-24 border-4 border-accent -rotate-6 opacity-20 hidden lg:block" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-block mb-8 animate-slide-up">
            <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 border-4 border-primary">
              <Sparkles className="w-5 h-5" />
              <span className="font-display uppercase tracking-wider">Limited Time: Free Installation Worth £60</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-display-lg mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            READY TO SWITCH TO
            <br />
            INTERNET THAT
            <br />
            <span className="text-primary">ACTUALLY WORKS?</span>
          </h2>

          {/* Subtext */}
          <p className="text-xl text-background/70 max-w-xl mb-10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            Join the growing number of sensible people who've had enough of the big providers. 
            We'll even handle the switch for you — no hassle, no downtime, no drama.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="xl" className="w-full sm:w-auto border-background">
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:08002606627">
              <Button 
                variant="outline" 
                size="xl" 
                className="w-full sm:w-auto bg-transparent border-background text-background hover:bg-background hover:text-foreground"
              >
                <Phone className="w-5 h-5" />
                Call 0800 260 6627
              </Button>
            </a>
          </div>

          {/* Trust Note */}
          <p className="mt-8 text-sm text-background/50 font-display uppercase tracking-wider animate-slide-up" style={{ animationDelay: "0.4s" }}>
            No contracts longer than 30 days • Cancel anytime • We're confident, not desperate
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
