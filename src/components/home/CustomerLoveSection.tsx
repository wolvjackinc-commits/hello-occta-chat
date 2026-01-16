import { motion } from "framer-motion";
import { Baby, User, Users, Briefcase, PiggyBank } from "lucide-react";

const testimonials = [
  {
    icon: Baby,
    name: "Neighbour's kid. Future entrepreneur. Wi-Fi critic.",
    heading: "Accidental power user",
    mainLine: "\"They didn't even ask for a contract. Weird.\"",
    body: `I don't pay the bills. My parents do.
But I know when the Wi-Fi is slow.

With OCCTA, my games load faster, my videos don't buffer, and nobody yells "WHO'S USING ALL THE INTERNET?" anymore.

I don't know what a telecom provider is, but this one didn't break anything. So… 10/10.`,
    caption: "Fast broadband. No contracts. Even kids notice.",
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
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
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
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
    color: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500",
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
    color: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-500",
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
    color: "from-rose-500/20 to-red-500/20",
    iconColor: "text-rose-500",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
};

const CustomerLoveSection = () => {
  return (
    <section className="py-20 md:py-28 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Fact: People switch to us and don't look back
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Turns out people like cheaper internet and fewer lies.
          </p>
        </motion.div>

        {/* Testimonial Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`relative bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border/50 overflow-hidden ${
                index === 0 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${testimonial.color} opacity-50`} />
              
              <div className="relative z-10">
                {/* Icon & Name */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-background/80 shadow-sm ${testimonial.iconColor}`}>
                    <testimonial.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      {testimonial.name}
                    </p>
                    <h3 className="text-xl font-bold text-foreground">
                      {testimonial.heading}
                    </h3>
                  </div>
                </div>

                {/* Main Quote */}
                <p className="text-lg md:text-xl font-semibold text-foreground mb-4">
                  {testimonial.mainLine}
                </p>

                {/* Body */}
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed mb-6">
                  {testimonial.body}
                </p>

                {/* Caption */}
                <p className="text-sm font-medium text-primary border-t border-border/50 pt-4">
                  {testimonial.caption}
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
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-block bg-card rounded-2xl p-8 shadow-lg border border-border/50">
            <div className="space-y-4 text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Are these people real?</span>{" "}
                Yes.
              </p>
              <p>
                <span className="font-semibold text-foreground">Did we write this ourselves?</span>{" "}
                Also yes.
              </p>
              <p>
                <span className="font-semibold text-foreground">Should telecom really be this complicated?</span>{" "}
                <span className="text-primary font-medium">Absolutely not.</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CustomerLoveSection;
