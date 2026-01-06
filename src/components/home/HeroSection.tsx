import { ArrowDown, Zap, Shield, HeartHandshake } from "lucide-react";
import PostcodeChecker from "./PostcodeChecker";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center hero-pattern overflow-hidden">
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-float" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-accent/10 rounded-full blur-xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-40 left-1/4 w-24 h-24 bg-warning/10 rounded-full blur-xl animate-float" style={{ animationDelay: "4s" }} />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>New: Ultrafast Fibre now available in Yorkshire!</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-tight animate-slide-up">
            Internet that doesn't
            <br />
            <span className="text-gradient">make you want to scream</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Broadband, mobile, and landline services from actual humans who understand that "have you tried turning it off and on again" isn't always the answer.
          </p>

          {/* Postcode Checker */}
          <div className="pt-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <p className="text-sm text-muted-foreground mb-4">Check what's available at your gaff:</p>
            <PostcodeChecker />
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 pt-8 animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-5 h-5 text-accent" />
              <span>Ofcom Regulated</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HeartHandshake className="w-5 h-5 text-primary" />
              <span>UK-Based Support</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-lg">🇬🇧</span>
              <span>Proudly British</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <ArrowDown className="w-6 h-6 text-muted-foreground" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
