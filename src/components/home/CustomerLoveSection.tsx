import { motion } from "framer-motion";
import { Gamepad2, User, Users, Briefcase, PiggyBank } from "lucide-react";

const testimonials = [
  {
    icon: Gamepad2,
    name: "Neighbour's kid. Future entrepreneur. Wi-Fi critic.",
    heading: "Accidental power user",
    mainLine: "\"They didn't even ask for a contract. Weird.\"",
    body: `I don't pay the bills. My parents do.
But I know when the Wi-Fi is slow.

With OCCTA, my games load faster, my videos don't buffer, and nobody yells "WHO'S USING ALL THE INTERNET?" anymore.

I don't know what a telecom provider is, but this one didn't break anything. So… 10/10.`,
    caption: "Fast broadband. No contracts. Even kids notice.",
  },
  {
    icon: User,
    name: "Just a regular UK human",
    heading: "Non-techy person",
    mainLine: "\"I don't know what Mbps means and I'm not learning.\"",
    body: `I wanted cheaper internet.
OCCTA showed me the price, didn't hide anything, and didn't lock me into a contract longer than my mortgage.

It worked. That's the review.`,
    caption: "No jargon. No pressure. Just internet.",
  },
  {
    icon: Users,
    name: "Busy UK household",
    heading: "Wi-Fi peacekeeper",
    mainLine: "\"Our house is calmer now. That's suspicious.\"",
    body: `We stream. We work. We scroll. We argue.
Somehow the Wi-Fi just keeps going.

It's cheaper than our old provider and nobody's tried to upsell us since we joined.

We're uncomfortable with how smooth this has been.`,
    caption: "Stable broadband. Predictable bills. No drama.",
  },
  {
    icon: Briefcase,
    name: "Small business owner",
    heading: "Contract escapee",
    mainLine: "\"Finally, a telecom company that doesn't act like a gym membership.\"",
    body: `Other providers wanted contracts, bundles, reviews, and phone calls.

OCCTA wanted me to sign up online and leave me alone.

I respect that.`,
    caption: "Business-ready services without enterprise nonsense.",
  },
  {
    icon: PiggyBank,
    name: "Ex-big-provider customer",
    heading: "Formerly overcharged",
    mainLine: "\"I left out of spite. I stayed because it's cheaper.\"",
    body: `I compared prices.
OCCTA was cheaper than the big names.
No contract. No exit fees.

Somehow this is rare in telecom.`,
    caption: "Lower prices. Same essentials. Fewer headaches.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  },
};

const CustomerLoveSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-display-md mb-4">
            FACT: PEOPLE SWITCH TO US AND DON'T LOOK BACK
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Turns out people like cheaper internet and fewer lies.
          </p>
        </motion.div>

        {/* Testimonial Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ 
                y: -4, 
                boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                transition: { duration: 0.15 }
              }}
              className="bg-card border-4 border-foreground p-6 flex flex-col"
            >
              {/* Header with Icon */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center shrink-0">
                  <testimonial.icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
                    {testimonial.name}
                  </p>
                  <h3 className="font-display text-lg text-foreground">
                    {testimonial.heading}
                  </h3>
                </div>
              </div>

              {/* Main Quote */}
              <p className="text-lg font-bold text-foreground mb-3">
                {testimonial.mainLine}
              </p>

              {/* Body */}
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed flex-1 mb-4">
                {testimonial.body}
              </p>

              {/* Caption with yellow underline */}
              <div className="pt-4 border-t-2 border-foreground/20">
                <p className="text-sm font-medium text-foreground">
                  <span className="border-b-2 border-accent">{testimonial.caption}</span>
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 text-center"
        >
          <div className="inline-block bg-secondary border-4 border-foreground p-6">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-bold text-foreground">Are these people real?</span>{" "}
                Yes.
              </p>
              <p>
                <span className="font-bold text-foreground">Did we write this ourselves?</span>{" "}
                Also yes.
              </p>
              <p>
                <span className="font-bold text-foreground">Should telecom really be this complicated?</span>{" "}
                <span className="font-bold border-b-2 border-accent">Absolutely not.</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CustomerLoveSection;
