import { motion } from "framer-motion";
import { Gamepad2, User, Users, Briefcase, PiggyBank } from "lucide-react";

const reasons = [
  {
    icon: Gamepad2,
    eyebrow: "Gaming & streaming",
    heading: "Choose the speed your home actually needs",
    body: "Check the line available at your address, then choose a public speed band that fits the household instead of buying the biggest number by default.",
    caption: "Address-specific speed information before acceptance.",
  },
  {
    icon: User,
    eyebrow: "Simple buying journey",
    heading: "Clear terms before you commit",
    body: "The order journey shows the selected term, monthly price, setup, router choices and applicable charges before you are asked to accept the agreement.",
    caption: "Contract Summary and Contract Information before acceptance.",
  },
  {
    icon: Users,
    eyebrow: "Household flexibility",
    heading: "Flex 30 when flexibility matters",
    body: "Flex 30 is a 30-day rolling broadband option with no fixed minimum term where eligible. Normal notice is 30 days and there is no remaining-month Early Termination Charge.",
    caption: "Separately valid network charges may still apply where disclosed.",
  },
  {
    icon: Briefcase,
    eyebrow: "Price certainty",
    heading: "Price Lock 24 when certainty matters",
    body: "Price Lock 24 has a 24-month minimum term. Under residential contract version 2026.10.1 there is no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring broadband subscription during that minimum term.",
    caption: "Check the customer-specific terms before accepting.",
  },
  {
    icon: PiggyBank,
    eyebrow: "Total cost",
    heading: "Compare more than the headline price",
    body: "Look at setup, equipment, scheduled price changes, minimum term and termination-related charges as well as the monthly price. OCCTA shows the applicable order details before acceptance.",
    caption: "Clearer comparison. Fewer surprises.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const CustomerLoveSection = () => (
  <section className="py-20 md:py-28 bg-background">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-display-md mb-4">WHY PEOPLE CONSIDER OCCTA</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Different households value different things. These are product-fit examples, not customer reviews.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
      >
        {reasons.map((reason, index) => (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))", transition: { duration: 0.15 } }}
            className="bg-card border-4 border-foreground p-6 flex flex-col"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center shrink-0">
                <reason.icon className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{reason.eyebrow}</p>
                <h3 className="font-display text-lg text-foreground">{reason.heading}</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">{reason.body}</p>
            <div className="pt-4 border-t-2 border-foreground/20">
              <p className="text-sm font-medium text-foreground">
                <span className="border-b-2 border-accent">{reason.caption}</span>
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-12 text-center"
      >
        <div className="inline-block bg-secondary border-4 border-foreground p-6">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Genuine customer reviews should be displayed only when they are sourced and verifiable. Product examples above explain who each option may suit.
          </p>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CustomerLoveSection;
