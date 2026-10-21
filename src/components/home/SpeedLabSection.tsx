import { BrandContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import SpeedRace from "@/components/brand/SpeedRace";

const SpeedLabSection = () => (
  <section className="bg-secondary border-y-[3px] border-foreground">
    <BrandContainer className="py-20 md:py-28">
      <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-end">
        <div>
          <SectionEyebrow index="04" label="The download race" />
          <SectionTitle className="mt-5">
            What does a
            <br />
            speed band <span className="bg-primary px-2">feel</span> like?
          </SectionTitle>
        </div>
        <p className="text-lg leading-relaxed text-foreground/70">
          Pick a download and watch all four OCCTA speed bands race for it. Then choose the one that fits your home, not just the biggest number.
        </p>
      </Reveal>

      <div className="mt-12 md:mt-16">
        <SpeedRace />
      </div>
    </BrandContainer>
  </section>
);

export default SpeedLabSection;
