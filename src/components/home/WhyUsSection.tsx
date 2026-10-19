import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { HomeContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/home/homeKit";
import { revealItem } from "@/components/home/homeMotion";
import { AddressPinArt, ContractDocArt, SupportChatArt, SwitchArt } from "@/components/home/illustrations";

type Tile = {
  title: string;
  description: ReactNode;
  art: ReactNode;
  span: string;
  dark?: boolean;
};

const PlanChips = () => (
  <div className="flex flex-col items-start gap-2" aria-hidden>
    <span className="border-[3px] border-black bg-primary px-3 py-2 font-display text-2xl leading-none text-black">24 mo · fixed price</span>
    <span className="border-[3px] border-black bg-white px-3 py-2 font-display text-2xl leading-none text-black">30 day · rolling</span>
  </div>
);

const tiles: Tile[] = [
  {
    title: "Switching support",
    description:
      "Where One Touch Switch applies, the providers coordinate the switch and we confirm the expected date for your order.",
    art: <SwitchArt />,
    span: "lg:col-span-3",
  },
  {
    title: "UK-based support",
    description: "UK-based customer support with account, ticket and complaint tracking.",
    art: <SupportChatArt />,
    span: "lg:col-span-3",
    dark: true,
  },
  {
    title: "Price Lock 24 or Flex 30",
    description: (
      <>
        Pick a fixed Price Lock plan, or a 30-day rolling option where available. No confusing mid-contract rises — on Price Lock 24 your monthly broadband price stays fixed for the agreed term.
      </>
    ),
    art: <PlanChips />,
    span: "lg:col-span-2",
  },
  {
    title: "Address-specific network",
    description: "The access network and technology available at your address are confirmed before acceptance.",
    art: <AddressPinArt />,
    span: "lg:col-span-2",
  },
  {
    title: "Quote-led sign-up",
    description: "You see a full Contract Summary before any payment is taken.",
    art: <ContractDocArt />,
    span: "lg:col-span-2",
  },
];

const WhyUsSection = () => (
  <section className="bg-background">
    <HomeContainer className="py-20 md:py-28">
      <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-end">
        <div>
          <SectionEyebrow index="05" label="Why switch" />
          <SectionTitle className="mt-5">
            Reasons people
            <br />
            consider OCCTA.
          </SectionTitle>
        </div>
        <p className="text-lg leading-relaxed text-foreground/70">
          Affordable telecom with clear terms. Compare Flex 30 and Price Lock 24 where eligible, with customer-specific price, speed information, setup and applicable charges shown before acceptance.
        </p>
      </Reveal>

      <Reveal stagger className="mt-12 md:mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {tiles.map((t) => (
          <motion.article
            key={t.title}
            variants={revealItem}
            className={`group flex flex-col border-[3px] border-foreground transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))] ${t.span} ${
              t.dark ? "bg-[hsl(0_0%_5%)] text-white" : "bg-white text-black"
            }`}
          >
            <div
              className={`flex min-h-[176px] items-center justify-center border-b-[3px] border-foreground p-6 ${
                t.dark ? "bg-[hsl(0_0%_10%)]" : "bg-secondary"
              }`}
            >
              <div className="w-full max-w-[320px]">{t.art}</div>
            </div>
            <div className="flex-1 p-6">
              <h3 className="font-display text-3xl uppercase leading-none">{t.title}</h3>
              <p className={`mt-3 text-sm leading-relaxed ${t.dark ? "text-white/70" : "text-black/70"}`}>{t.description}</p>
            </div>
          </motion.article>
        ))}
      </Reveal>
    </HomeContainer>
  </section>
);

export default WhyUsSection;
