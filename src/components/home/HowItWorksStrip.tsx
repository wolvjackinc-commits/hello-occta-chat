import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Search, FileText, CreditCard } from "lucide-react";
import { BrandContainer, SectionEyebrow } from "@/components/brand/kit";
import { revealItem, revealParent } from "@/components/brand/motion";

const steps = [
  { num: "01", title: "Check availability", desc: "Enter your postcode and build your plan", icon: Search },
  { num: "02", title: "Review your Contract Summary", desc: "We send a clear breakdown before anything is confirmed", icon: FileText },
  { num: "03", title: "Confirm and pay securely", desc: "Only pay when you're ready to go ahead", icon: CreditCard },
];

const HowItWorksStrip = () => {
  const [inView, setInView] = useState(false);

  return (
    <section className="bg-background">
      <BrandContainer className="py-14 md:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionEyebrow index="01" label="How it works" />
            <h2 className="mt-4 font-display text-4xl md:text-5xl uppercase leading-[0.9]">
              Three steps. <span className="text-foreground/40">No surprises.</span>
            </h2>
          </div>
          <Link
            to="/order"
            className="group inline-flex items-center gap-2 self-start md:self-auto font-display text-lg uppercase tracking-wide text-foreground"
          >
            <span className="border-b-[3px] border-primary pb-0.5">Start your order</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <motion.ol
          className="relative mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          onViewportEnter={() => setInView(true)}
          variants={revealParent}
        >
          {/* Connector: draws across behind the step markers on desktop */}
          <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-7 hidden md:block h-[3px] bg-foreground/10">
            <div className="occ-draw h-full bg-foreground" data-inview={inView} />
          </div>

          {steps.map((step) => (
            <motion.li key={step.num} variants={revealItem} className="relative flex gap-5 md:block">
              <div className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center border-[3px] border-foreground bg-primary">
                <step.icon className="w-6 h-6 text-black" strokeWidth={2.25} />
              </div>
              <div className="md:mt-6">
                <p className="font-display text-sm tracking-[0.2em] text-foreground/40">STEP {step.num}</p>
                <h3 className="mt-1 font-display text-2xl md:text-3xl uppercase leading-none">{step.title}</h3>
                <p className="mt-2 text-sm md:text-base text-foreground/65 max-w-[300px]">{step.desc}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </BrandContainer>
    </section>
  );
};

export default HowItWorksStrip;
