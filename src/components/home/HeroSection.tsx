import { ArrowDown, Zap, Shield, HeartHandshake } from "lucide-react";
import PostcodeChecker from "./PostcodeChecker";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center grid-pattern overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-32 h-32 border-4 border-foreground bg-primary rotate-12 hidden lg:block" />
      <div className="absolute bottom-32 left-10 w-24 h-24 border-4 border-foreground bg-accent -rotate-6 hidden lg:block" />
      <div className="absolute top-1/3 left-20 w-16 h-16 border-4 border-foreground bg-warning rotate-45 hidden xl:block" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-block animate-slide-up">
            <div className="stamp text-accent border-accent text-sm">
              <Zap className="w-4 h-4 inline mr-2" />
              Now in Yorkshire!
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-display-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
            INTERNET
            <br />
            THAT DOESN'T
            <br />
            <span className="text-gradient">MAKE YOU SCREAM</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="text-xl md:text-2xl max-w-2xl font-medium leading-relaxed animate-slide-up" 
            style={{ animationDelay: "0.2s" }}
          >
            Broadband, mobile & landline from{" "}
            <span className="cutout">actual humans</span>{" "}
            who know that "have you tried turning it off and on again" 
            isn't always the answer.
          </p>

          {/* Postcode Checker */}
          <div className="pt-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <p className="font-display text-lg mb-4 uppercase tracking-wider">
              Check what's available at your gaff:
            </p>
            <PostcodeChecker />
          </div>

          {/* Trust Badges */}
          <div 
            className="flex flex-wrap gap-6 pt-8 animate-slide-up" 
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex items-center gap-3 px-4 py-2 border-4 border-foreground bg-background">
              <Shield className="w-5 h-5" />
              <span className="font-display uppercase tracking-wide">Ofcom Regulated</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 border-4 border-foreground bg-background">
              <HeartHandshake className="w-5 h-5" />
              <span className="font-display uppercase tracking-wide">UK Support</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 border-4 border-foreground bg-primary">
              <span className="text-lg">🇬🇧</span>
              <span className="font-display uppercase tracking-wide text-primary-foreground">100% British</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
          <div className="p-3 border-4 border-foreground bg-background">
            <ArrowDown className="w-6 h-6" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
