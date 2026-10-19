import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, ArrowRight, Search, FileCheck2 } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { BrandContainer, SectionEyebrow } from "@/components/brand/kit";
import { revealItem, revealParent } from "@/components/brand/motion";

/** Sends the visitor back to the hero checker rather than duplicating it (both share one availability state). */
const focusHeroChecker = () => {
  const input = document.getElementById("hero-postcode") as HTMLInputElement | null;
  if (!input) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  input.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  window.setTimeout(() => input.focus({ preventScroll: true }), reduce ? 0 : 450);
};

const CTASection = () => (
  <section className="relative overflow-hidden bg-primary text-black">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    />
    <BrandContainer className="relative py-20 md:py-28">
      <motion.div
        className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={revealParent}
      >
        <div>
          <motion.div variants={revealItem}>
            <SectionEyebrow index="07" label="Ready when you are" tone="yellow" />
          </motion.div>

          <motion.p
            variants={revealItem}
            className="mt-6 inline-flex items-center gap-2 border-[3px] border-black bg-white px-3 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.14em]"
          >
            <FileCheck2 className="w-4 h-4" />
            Quote-led signup — confirmed in your Contract Summary
          </motion.p>

          <motion.h2
            variants={revealItem}
            className="mt-6 font-display uppercase leading-[0.86] text-[3rem] sm:text-7xl lg:text-[6.5rem]"
          >
            Ready to check
            <br />
            your UK broadband
            <br />
            <span className="mt-2 inline-block bg-black px-3 pt-1 text-[hsl(var(--primary))]">&amp; SIM options?</span>
          </motion.h2>

          <motion.p variants={revealItem} className="mt-8 max-w-[560px] text-lg leading-relaxed text-black/75">
            Compare the broadband and SIM options currently available to you. For broadband, Flex 30 and Price Lock 24 are offered where eligible, with customer-specific price, speed information, setup and applicable charges shown before acceptance.
          </motion.p>

          <motion.div variants={revealItem} className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/order"
              className="group inline-flex h-16 items-center justify-center gap-3 border-[3px] border-black bg-black px-8 font-display text-xl uppercase tracking-wide text-primary transition-transform hover:-translate-y-0.5"
            >
              Start your broadband order
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={CONTACT_PHONE_TEL}
              className="inline-flex h-16 items-center justify-center gap-3 border-[3px] border-black bg-transparent px-8 font-display text-xl uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-primary"
            >
              <Phone className="w-5 h-5" />
              Call {CONTACT_PHONE_DISPLAY}
            </a>
          </motion.div>

          <motion.p variants={revealItem} className="mt-5 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">
            Price Lock 24 • Flex 30 where eligible • Customer-specific terms before acceptance
          </motion.p>
        </div>

        {/* Postcode ticket — a big, friendly way back to the checker */}
        <motion.div variants={revealItem} className="relative mx-auto w-full max-w-[440px]">
          <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 border-[3px] border-black bg-white" />
          <button
            type="button"
            onClick={focusHeroChecker}
            className="group relative block w-full rotate-[-2deg] border-[3px] border-black bg-black p-7 text-left text-white transition-transform duration-300 hover:rotate-0"
          >
            <span className="flex items-center justify-between font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              <span>Address check</span>
              <span>Takes 10 seconds</span>
            </span>
            <span className="mt-8 flex items-center gap-3 border-[3px] border-white px-4 py-4">
              <Search className="w-6 h-6 text-primary" />
              <span className="font-display text-4xl tracking-[0.12em] text-white/35">Your postcode</span>
              <span aria-hidden className="occ-blink ml-auto h-9 w-3 bg-primary" />
            </span>
            <span className="mt-4 flex h-14 items-center justify-center gap-2 bg-primary font-display text-xl uppercase tracking-wide text-black transition-colors group-hover:bg-white">
              Check my address
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
            <span className="mt-6 block border-t border-dashed border-white/25 pt-4 font-sans text-xs text-white/55">
              ✓ No commitment &nbsp; ✓ Final service availability validated before provisioning
            </span>
          </button>
        </motion.div>
      </motion.div>
    </BrandContainer>
  </section>
);

export default CTASection;
