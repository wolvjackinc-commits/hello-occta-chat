import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2, User, Users, Briefcase, PiggyBank } from "lucide-react";
import { BrandContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";

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

const CustomerLoveSection = () => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = reasons[active];

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = (active + keys[e.key] + reasons.length) % reasons.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="bg-[hsl(0_0%_5%)] text-white">
      <BrandContainer className="py-20 md:py-28">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
          <div>
            <SectionEyebrow index="06" label="Find your fit" tone="dark" />
            <SectionTitle className="mt-5 text-white">
              Which kind of
              <br />
              <span className="text-[hsl(var(--primary))]">household</span> are you?
            </SectionTitle>
          </div>
          <p className="text-lg leading-relaxed text-white/65">
            Different households value different things. These are product-fit examples, not customer reviews.
          </p>
        </Reveal>

        <Reveal className="mt-12 md:mt-16 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div role="tablist" aria-label="Household examples" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {reasons.map((r, i) => {
              const selected = i === active;
              return (
                <button
                  key={r.eyebrow}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`fit-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="fit-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={onKeyDown}
                  className={`group flex flex-shrink-0 items-center gap-4 border-[3px] px-4 py-3 text-left transition-colors lg:py-4 ${
                    selected ? "border-primary bg-primary text-black" : "border-white/15 bg-transparent text-white hover:border-white/50"
                  }`}
                >
                  <span className={`font-display text-xl leading-none ${selected ? "text-black/60" : "text-white/35"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-xl sm:text-2xl uppercase leading-none whitespace-nowrap">{r.eyebrow}</span>
                  <span aria-hidden className={`ml-auto hidden lg:block h-[3px] transition-all duration-300 ${selected ? "w-10 bg-black" : "w-0 bg-white"}`} />
                </button>
              );
            })}
          </div>

          <div
            id="fit-panel"
            role="tabpanel"
            aria-labelledby={`fit-tab-${active}`}
            className="relative min-h-[380px] overflow-hidden border-[3px] border-white bg-[hsl(0_0%_9%)] p-6 sm:p-10"
          >
            <span aria-hidden className="pointer-events-none absolute -right-6 -bottom-16 font-display text-[16rem] leading-none text-white/[0.04] select-none">
              {String(active + 1).padStart(2, "0")}
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <span className="relative inline-flex h-16 w-16 items-center justify-center bg-primary text-black">
                  <span aria-hidden className="absolute inset-0 animate-ping bg-primary opacity-20 motion-reduce:animate-none" />
                  <current.icon className="relative w-8 h-8" strokeWidth={2.25} />
                </span>
                <p className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{current.eyebrow}</p>
                <h3 className="mt-2 font-display text-4xl sm:text-5xl uppercase leading-[0.92] text-white max-w-[560px]">{current.heading}</h3>
                <p className="mt-5 max-w-[560px] text-base sm:text-lg leading-relaxed text-white/75">{current.body}</p>
                <p className="mt-8 inline-flex border-l-[3px] border-primary pl-3 text-sm font-medium text-white">{current.caption}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>

        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-white/45">
          Genuine customer reviews should be displayed only when they are sourced and verifiable. Product examples above explain who each option may suit.
        </p>
      </BrandContainer>
    </section>
  );
};

export default CustomerLoveSection;
