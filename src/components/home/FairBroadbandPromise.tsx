import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { getFromPrices } from "@/lib/pricing/engine";
import { HomeContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/home/homeKit";
import { revealItem, revealParent } from "@/components/home/homeMotion";

const promises = [
  {
    title: "No confusing mid-contract price rises",
    body: "Choose Price Lock 24 and your monthly broadband price stays fixed for the agreed term.",
  },
  {
    title: "Price Lock or Flex 30",
    body: "Pick a fixed Price Lock plan or a 30-day rolling option where available.",
  },
  {
    title: "No hidden first bill",
    body: "We show your monthly price, router, setup and add-ons before you order.",
  },
  {
    title: "Final price confirmed before order",
    body: "Availability, speed, setup and final price are confirmed before you proceed.",
  },
  {
    title: "Router choice",
    body: "Use your own compatible router for £0, or choose a router only if you need one.",
  },
  {
    title: "No support black hole",
    body: "Track support tickets, complaints and documents in your OCCTA dashboard.",
  },
];

/** Illustrative first-bill receipt: the promise, shown as the thing you actually receive. */
const FirstBillReceipt = () => {
  const price = getFromPrices().broadband;
  const rows: [string, string][] = [
    ["Broadband · Price Lock 24", `£${price}/mo`],
    ["Router · your own compatible", "£0"],
    ["Setup", "Shown before you order"],
    ["Add-ons", "Only if you choose them"],
  ];

  return (
    <div className="relative mx-auto w-full max-w-[400px] pt-6 pb-10">
      <div aria-hidden className="absolute inset-x-4 inset-y-0 bg-primary border-[3px] border-foreground" />
      <motion.div
        className="relative mx-auto w-[86%] -rotate-2"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={revealParent}
        role="img"
        aria-label={`Illustrative first bill preview: broadband on Price Lock 24 from £${price} a month, your own router £0, setup and add-ons shown before you order.`}
      >
        <div className="bg-white border-[3px] border-b-0 border-foreground px-5 pt-5 pb-4 text-black shadow-[0_18px_30px_-18px_rgba(0,0,0,0.45)]">
          <motion.div variants={revealItem} className="flex items-start justify-between">
            <div>
              <p className="font-display text-3xl leading-none">OCCTA</p>
              <p className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black/55">First bill preview</p>
            </div>
            <span className="border-2 border-black px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider">Illustrative</span>
          </motion.div>

          <div className="my-4 border-t-2 border-dashed border-black/30" />

          <div className="space-y-2.5">
            {rows.map(([label, value]) => (
              <motion.div key={label} variants={revealItem} className="flex items-baseline justify-between gap-3 font-mono text-[12px]">
                <span className="text-black/70">{label}</span>
                <span className="text-right font-semibold">{value}</span>
              </motion.div>
            ))}
          </div>

          <div className="my-4 border-t-2 border-dashed border-black/30" />

          <motion.div variants={revealItem} className="flex items-end justify-between">
            <span className="inline-flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em]">
              <Lock className="w-3.5 h-3.5" /> Price fixed for the term
            </span>
            <span className="text-right">
              <span className="block font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-black/55">Monthly from</span>
              <span className="font-display text-4xl leading-none">£{price}</span>
            </span>
          </motion.div>

          <motion.div
            variants={revealItem}
            aria-hidden
            className="mt-5 h-9"
            style={{ background: "repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px,#000 4px 7px,transparent 7px 9px,#000 9px 10px,transparent 10px 13px)" }}
          />
        </div>
        {/* Torn receipt edge */}
        <div
          aria-hidden
          className="h-3"
          style={{
            background:
              "linear-gradient(-45deg, transparent 8px, #fff 0) 0 0 / 16px 16px repeat-x, linear-gradient(45deg, transparent 8px, #fff 0) 0 0 / 16px 16px repeat-x",
          }}
        />

        <motion.div
          aria-hidden
          className="absolute -right-2 sm:-right-7 bottom-3 rotate-[8deg] border-[3px] border-black bg-white/90 px-3 py-1.5 font-display text-lg uppercase leading-none text-black"
          initial={{ opacity: 0, scale: 1.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        >
          Seen before
          <br />
          you order
        </motion.div>
      </motion.div>
    </div>
  );
};

export default function FairBroadbandPromise() {
  return (
    <section className="overflow-x-clip border-t-[3px] border-foreground bg-secondary">
      <HomeContainer className="py-20 md:py-28">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <SectionEyebrow index="02" label="The OCCTA Fair Broadband Promise" />
              <SectionTitle className="mt-5">
                Broadband built
                <br />
                around <span className="relative isolate inline-block">you.<span aria-hidden className="absolute -bottom-1 left-0 h-3 w-full bg-primary -z-10" /></span>
              </SectionTitle>
              <p className="mt-6 max-w-[460px] text-lg leading-relaxed text-foreground/70">
                Choose the plan style that suits you. Price Lock 24 keeps your monthly broadband price fixed for the agreed term. Flex 30 gives you a rolling option where available. We show your first bill before you order.
              </p>
            </Reveal>
            <div className="mt-10">
              <FirstBillReceipt />
            </div>
          </div>

          <Reveal as="ol" stagger className="border-t-[3px] border-foreground">
            {promises.map((p, i) => (
              <motion.li
                key={p.title}
                variants={revealItem}
                className="group relative isolate border-b-[3px] border-foreground"
              >
                <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                <div className="grid grid-cols-[3.5rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-4 px-1 py-7 md:py-9">
                  <span
                    className="font-display text-5xl sm:text-7xl leading-[0.8] text-transparent transition-colors duration-300 group-hover:text-black"
                    style={{ WebkitTextStroke: "2px hsl(var(--foreground))" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl sm:text-3xl uppercase leading-none transition-colors group-hover:text-black">{p.title}</h3>
                    <p className="mt-2 max-w-[520px] text-base leading-relaxed text-foreground/70 transition-colors group-hover:text-black/80">{p.body}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </Reveal>
        </div>
      </HomeContainer>
    </section>
  );
}
