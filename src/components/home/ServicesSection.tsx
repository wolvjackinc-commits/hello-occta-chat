import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { getFromPrices } from "@/lib/pricing/engine";
import { BrandContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { RouterArt, SimArt, VoiceArt } from "@/components/brand/illustrations";

const ServicesSection = () => {
  const prices = getFromPrices();

  const services = [
    {
      key: "broadband",
      title: "Broadband",
      subtitle: "Internet that actually works",
      description: "From everyday browsing to full-fibre speeds. Actual speeds depend on your address — confirmed in your Contract Summary.",
      price: `Indicative from £${prices.broadband}/mo`,
      link: "/broadband",
      Art: RouterArt,
      tile: "bg-primary text-black lg:col-span-7 lg:row-span-2",
      art: "w-full max-w-[460px] lg:max-w-[520px]",
      pill: "bg-black text-primary",
      large: true,
    },
    {
      key: "sim",
      title: "SIM Plans",
      subtitle: "Mobile without the mobile drama",
      description: "Unlimited texts, plenty of data, and calls that don't drop mid-sentence. Plan, network and price confirmed in your Contract Summary.",
      price: `Indicative from £${prices.sim}/mo`,
      link: "/sim-plans",
      Art: SimArt,
      tile: "bg-white text-black lg:col-span-5",
      art: "w-44 sm:w-52",
      pill: "bg-primary text-black",
      large: false,
    },
    {
      key: "voice",
      title: "Digital Voice",
      subtitle: "Home Phone over broadband",
      description: "Crystal clear calls through your broadband. Keep your number, use your existing phone. Add-on — requires an active OCCTA broadband connection.",
      price: `Indicative from £${prices.landline}/mo`,
      link: "/landline",
      Art: VoiceArt,
      tile: "bg-accent text-white lg:col-span-5",
      art: "w-44 sm:w-52",
      pill: "bg-black text-white",
      large: false,
    },
  ];

  return (
    <section className="bg-[hsl(0_0%_5%)] text-white">
      <BrandContainer className="py-20 md:py-28">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-end">
          <div>
            <SectionEyebrow index="03" label="What we do" tone="dark" />
            <SectionTitle className="mt-5 text-white">
              Three services.
              <br />
              <span className="text-[hsl(var(--primary))]">Zero nonsense.</span>
            </SectionTitle>
          </div>
          <p className="text-lg leading-relaxed text-white/65">
            UK-wide coverage with straightforward, clear contract options — whether you're after affordable broadband, flexible monthly broadband or a SIM only deal.
          </p>
        </Reveal>

        <Reveal stagger className="mt-12 md:mt-16 grid gap-4 lg:grid-cols-12 lg:grid-rows-2">
          {services.map(({ key, Art, ...s }) => (
            <motion.div key={key} variants={revealItem} className={s.tile}>
              <Link
                to={s.link}
                className={`group relative flex h-full flex-col overflow-hidden border-[3px] border-white/10 p-6 sm:p-8 transition-transform duration-300 hover:-translate-y-1 ${
                  s.large ? "lg:p-10" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`font-display uppercase leading-[0.85] ${s.large ? "text-6xl sm:text-7xl lg:text-8xl" : "text-5xl"}`}>
                      {s.title}
                    </h3>
                    <p className="mt-2 font-sans text-xs font-bold uppercase tracking-[0.18em] opacity-70">{s.subtitle}</p>
                  </div>
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-[3px] border-current transition-all duration-300 group-hover:bg-black group-hover:text-primary group-hover:border-black">
                    <ArrowUpRight className="w-6 h-6 transition-transform duration-300 group-hover:rotate-45" />
                  </span>
                </div>

                <div className={`flex flex-1 items-center justify-center ${s.large ? "py-10 lg:py-6" : "py-6"}`}>
                  <Art className={`${s.art} h-auto transition-transform duration-500 group-hover:scale-[1.04]`} />
                </div>

                <div className={s.large ? "grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end" : "space-y-4"}>
                  <p className={`leading-relaxed opacity-80 ${s.large ? "text-base max-w-[440px]" : "text-sm"}`}>{s.description}</p>
                  <span className={`inline-block self-start px-3 py-2 font-display text-lg leading-none ${s.pill}`}>{s.price}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </Reveal>
      </BrandContainer>
    </section>
  );
};

export default ServicesSection;
