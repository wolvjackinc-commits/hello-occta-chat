import { Phone, Clock, PiggyBank, Users, Award, Heart } from "lucide-react";

const reasons = [
  {
    icon: Phone,
    title: "Actual Humans Answer",
    description: "No robots, no 45-minute hold music, no 'press 1 for more options'. Just friendly people who speak your language.",
  },
  {
    icon: Clock,
    title: "No Sneaky Price Hikes",
    description: "The price you sign up for is the price you pay. We're not going to 'review' it in 6 months and add a tenner.",
  },
  {
    icon: PiggyBank,
    title: "Transparent Pricing",
    description: "All costs upfront, no hidden fees, no 'admin charges', no 'just discovered we need another £20' moments.",
  },
  {
    icon: Users,
    title: "UK-Based Support",
    description: "Our support team works from Yorkshire. They understand that 'it's not working' is a perfectly valid tech description.",
  },
  {
    icon: Award,
    title: "Ofcom Regulated",
    description: "We play by the rules, treat you fairly, and make sure your data stays where it should - with you.",
  },
  {
    icon: Heart,
    title: "We Actually Care",
    description: "Revolutionary concept: a telecom company that wants you to be happy. We know, we're as surprised as you are.",
  },
];

const WhyUsSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            Why we're different
            <br />
            <span className="text-gradient">(in a good way)</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            We started OCCTA because we were fed up with the same telecom rubbish everyone else was dealing with. So we fixed it.
          </p>
        </div>

        {/* Reasons Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {reasons.map((reason, index) => (
            <div 
              key={reason.title}
              className="relative p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-soft transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <reason.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-display font-bold mb-2">{reason.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{reason.description}</p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="mt-20 text-center max-w-3xl mx-auto">
          <blockquote className="relative">
            <div className="text-6xl text-primary/20 absolute -top-4 left-0">"</div>
            <p className="text-xl italic text-muted-foreground pl-8 pr-8">
              Finally, a broadband company that doesn't make me want to move to a remote island with no internet at all.
            </p>
            <footer className="mt-4 text-sm">
              <span className="font-medium">Sarah T.</span>
              <span className="text-muted-foreground"> — Leeds customer since 2023</span>
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
};

export default WhyUsSection;
