import { Phone, Clock, PoundSterling, Users, Zap, ThumbsUp } from "lucide-react";

const reasons = [
  {
    icon: Phone,
    title: "HUMANS ANSWER",
    description: "Ring us and a real person picks up. In Huddersfield. Speaking English. Mental, right?",
  },
  {
    icon: Clock,
    title: "30-DAY CONTRACTS",
    description: "Because locking you in for 24 months is what scared companies do.",
  },
  {
    icon: PoundSterling,
    title: "NO PRICE HIKES",
    description: "The price you sign up for is the price you pay. Groundbreaking stuff.",
  },
  {
    icon: Users,
    title: "SMALL BUSINESS, BIG CARE",
    description: "We're not a faceless corporation. We're 22 people who actually give a toss.",
  },
  {
    icon: Zap,
    title: "QUICK SETUP",
    description: "Most installs happen within 7 days. Life's too short to wait for internet.",
  },
  {
    icon: ThumbsUp,
    title: "98% RECOMMEND US",
    description: "The other 2% probably just forgot to tick the box.",
  },
];

const WhyUsSection = () => {
  return (
    <section className="py-24 grid-pattern">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block stamp text-primary border-primary mb-6 rotate-[-2deg]">
            No BS Guarantee
          </div>
          <h2 className="text-display-md mb-4">
            WHY PEOPLE ACTUALLY
            <br />
            <span className="text-gradient">LIKE US</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            We're not reinventing the wheel. We're just doing the obvious things 
            that big telecoms somehow forgot about.
          </p>
        </div>

        {/* Reasons Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reasons.map((reason, index) => (
            <div
              key={reason.title}
              className="group p-6 border-4 border-transparent hover:border-foreground hover:bg-card transition-all duration-150 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <reason.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl mb-2">{reason.title}</h3>
                  <p className="text-muted-foreground">{reason.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="mt-20 border-4 border-foreground bg-foreground text-background">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-4 divide-background">
            <div className="p-6 text-center">
              <div className="font-display text-display-md text-primary">5K+</div>
              <div className="font-display uppercase tracking-wider text-sm">Happy Customers</div>
            </div>
            <div className="p-6 text-center">
              <div className="font-display text-display-md text-primary">98%</div>
              <div className="font-display uppercase tracking-wider text-sm">Recommend Us</div>
            </div>
            <div className="p-6 text-center">
              <div className="font-display text-display-md text-primary">{"<"}30s</div>
              <div className="font-display uppercase tracking-wider text-sm">Avg. Call Answer</div>
            </div>
            <div className="p-6 text-center">
              <div className="font-display text-display-md text-primary">0</div>
              <div className="font-display uppercase tracking-wider text-sm">Robot Menus</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUsSection;
