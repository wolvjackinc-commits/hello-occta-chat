import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Shield, Zap, Phone, MapPin, ArrowRight, MessageCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const trustBadges = [
  { icon: Shield, text: "No Contracts" },
  { icon: Check, text: "No Hidden Fees" },
  { icon: MapPin, text: "UK-Wide Coverage" },
  { icon: Phone, text: "UK-Based Support" },
];

const whySwitchReasons = [
  "No 12, 18, or 24-month contracts",
  "No CPI-linked annual price rises",
  "No 'intro price then shock bill'",
  "Cancel anytime without penalties",
  "Clear monthly pricing",
  "Human UK-based support",
];

const comparisonData = [
  { feature: "Contract length", occta: "None", others: "12-24 months" },
  { feature: "Price rises", occta: "None", others: "Annual CPI increases" },
  { feature: "Exit fees", occta: "None", others: "Up to £200+" },
  { feature: "Transparency", occta: "Clear pricing", others: "Complex bundles" },
  { feature: "Flexibility", occta: "Cancel anytime", others: "Locked in" },
];

const faqs = [
  {
    question: "Is there really no contract?",
    answer: "Yes, genuinely. You pay monthly and can cancel whenever you like. No minimum term, no exit fees, no catches. We believe if our service is good enough, you'll stay because you want to — not because you're trapped.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. Give us 30 days notice and you're free to go. No penalties, no hassle, no 'retention team' trying to convince you otherwise. We make leaving as easy as joining.",
  },
  {
    question: "Are there price increases later?",
    answer: "We don't do CPI-linked price rises or sneaky mid-term increases. The price you sign up for is the price you pay. If we ever need to change pricing, we'll give you proper notice and you can leave without penalty.",
  },
  {
    question: "Is OCCTA available UK-wide?",
    answer: "We cover most of the UK through the Openreach network. Use our postcode checker to confirm availability at your address. If we can't serve you, we'll tell you straight — no messing about.",
  },
  {
    question: "Who is OCCTA best for?",
    answer: "Anyone tired of telecom tricks. Renters who move frequently. People who hate being locked in. Anyone who's been stung by a 'great introductory offer' that tripled after 12 months. Basically, anyone who wants honest broadband.",
  },
  {
    question: "How does OCCTA compare to BT, Sky, or TalkTalk?",
    answer: "The big providers typically require 18-24 month contracts, include CPI-linked annual price rises, and charge hefty exit fees. We don't do any of that. Our speeds and reliability are comparable, but without the corporate nonsense.",
  },
];

const NoContractBroadband = () => {
  const { isAppMode } = useAppMode();
  const LayoutComponent = isAppMode ? AppLayout : Layout;
  const faqSchema = createFAQSchema(faqs);

  return (
    <LayoutComponent>
      <SEO
        title="No Contract Broadband UK | Cheap & Flexible Broadband"
        description="Looking for no-contract broadband in the UK? OCCTA offers simple, affordable broadband with no lock-ins, no hidden fees, and no surprise price rises."
        canonical="/no-contract-broadband-uk"
        keywords="no contract broadband UK, flexible broadband, cancel anytime broadband, no lock-in broadband, cheap broadband UK, OCCTA broadband, rolling monthly broadband, no exit fee broadband"
        price="22.99"
      />
      <StructuredData customSchema={faqSchema} type="localBusiness" />

      {/* Hero Section */}
      <section className="relative bg-background py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <motion.div
          className="container mx-auto px-4 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6"
            >
              No-Contract UK Broadband.{" "}
              <span className="text-accent">Finally.</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-xl md:text-2xl font-bold text-muted-foreground mb-4"
            >
              Broadband from{" "}
              <span className="text-foreground">£22.99/month</span>. No
              contracts, no hidden fees, cancel anytime.
            </motion.p>

            <motion.p
              variants={itemVariants}
              className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              OCCTA offers straightforward UK broadband without the long
              contracts, confusing bundles, or surprise price rises used by big
              providers. If you want broadband that just works — and lets you
              leave whenever you want — you're in the right place.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
            >
              <PostcodeChecker />
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap justify-center gap-4"
            >
              <Link to="/broadband">
                <Button variant="outline" size="lg" className="font-bold">
                  Compare Plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap justify-center gap-4 md:gap-8 mt-12"
            >
              {trustBadges.map((badge, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <badge.icon className="h-5 w-5 text-accent" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Why Switch Section */}
      <section className="py-16 md:py-20 bg-muted/30">
        <motion.div
          className="container mx-auto px-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-black uppercase text-center mb-12"
          >
            Why people are switching to{" "}
            <span className="text-accent">OCCTA</span>
          </motion.h2>

          <div className="max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4">
              {whySwitchReasons.map((reason, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex items-center gap-3 p-4 bg-background border-2 border-border rounded-lg"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                    <Check className="h-5 w-5 text-accent" />
                  </div>
                  <span className="font-semibold">{reason}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 md:py-20">
        <motion.div
          className="container mx-auto px-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-black uppercase text-center mb-4"
          >
            OCCTA vs Big UK Broadband Providers
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto"
          >
            See how we stack up against BT, Sky, TalkTalk, and the rest
          </motion.p>

          <motion.div variants={itemVariants} className="max-w-4xl mx-auto">
            <Card className="border-2 border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-black uppercase">
                      Feature
                    </TableHead>
                    <TableHead className="font-black uppercase text-accent text-center">
                      OCCTA
                    </TableHead>
                    <TableHead className="font-black uppercase text-muted-foreground text-center">
                      BT / Sky / TalkTalk
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-semibold">
                        {row.feature}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Check className="h-5 w-5 text-success" />
                          <span className="font-medium">{row.occta}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <X className="h-5 w-5 text-destructive" />
                          <span className="text-muted-foreground">
                            {row.others}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-accent">
        <motion.div
          className="container mx-auto px-4 text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-black uppercase mb-6 text-accent-foreground"
          >
            Ready to escape contract broadband?
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-lg mb-8 text-accent-foreground/80 max-w-xl mx-auto"
          >
            Check availability at your address and see our plans. No commitment
            required.
          </motion.p>
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/broadband">
              <Button
                size="lg"
                className="bg-background text-foreground hover:bg-background/90 font-bold"
              >
                <Zap className="mr-2 h-5 w-5" />
                View All Plans
              </Button>
            </Link>
            <Link to="/sim-plans">
              <Button
                size="lg"
                variant="outline"
                className="border-accent-foreground text-accent-foreground hover:bg-accent-foreground/10 font-bold"
              >
                Explore SIM Plans
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20 bg-muted/30">
        <motion.div
          className="container mx-auto px-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-black uppercase text-center mb-4"
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto"
          >
            Honest answers to common questions about no-contract broadband
          </motion.p>

          <motion.div variants={itemVariants} className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="bg-background border-2 border-border rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left font-bold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </section>

      {/* Internal Links Section */}
      <section className="py-16 md:py-20">
        <motion.div
          className="container mx-auto px-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-black uppercase text-center mb-12"
          >
            Explore More Services
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <motion.div variants={itemVariants}>
              <Link to="/broadband">
                <Card className="p-6 border-2 border-border hover:border-accent transition-colors group">
                  <Zap className="h-10 w-10 text-accent mb-4" />
                  <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                    Broadband Plans
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Compare all our broadband packages from £22.99/month
                  </p>
                </Card>
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link to="/sim-plans">
                <Card className="p-6 border-2 border-border hover:border-accent transition-colors group">
                  <Phone className="h-10 w-10 text-accent mb-4" />
                  <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                    SIM Plans
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Flexible mobile plans with no contract from £7.99/month
                  </p>
                </Card>
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link to="/landline">
                <Card className="p-6 border-2 border-border hover:border-accent transition-colors group">
                  <MessageCircle className="h-10 w-10 text-accent mb-4" />
                  <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                    Landline
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Keep your number with affordable landline from £7.99/month
                  </p>
                </Card>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </LayoutComponent>
  );
};

export default NoContractBroadband;
