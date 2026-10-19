import { Check } from "lucide-react";
import { BrandContainer, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";

const items = [
  "Router compatibility check",
  "Switching guidance",
  "First bill preview",
  "Contract-end reminder",
  "Annual price review reminder",
  "Speed health checklist",
  "Self-install checklist",
  "Support ticket tracking",
  "Complaint status tracking",
  "Vulnerable customer support route",
  "Digital Voice power-cut guidance",
];

const rows = [items.slice(0, 6), items.slice(6)];

const Ticket = ({ label, dark }: { label: string; dark: boolean }) => (
  <span
    className={`inline-flex flex-shrink-0 items-center gap-3 border-[3px] border-black px-5 py-3 font-display text-2xl md:text-3xl uppercase leading-none ${
      dark ? "bg-black text-primary" : "bg-white text-black"
    }`}
  >
    <span className={`inline-flex h-6 w-6 items-center justify-center ${dark ? "bg-primary text-black" : "bg-black text-primary"}`}>
      <Check className="w-4 h-4" strokeWidth={3.5} />
    </span>
    {label}
  </span>
);

export default function IncludedFreeSection() {
  return (
    <section className="overflow-hidden border-y-[3px] border-black bg-primary text-black">
      <BrandContainer className="pt-16 md:pt-20">
        <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionEyebrow index="04" label="Always with OCCTA" tone="yellow" />
            <SectionTitle className="mt-5 text-black">Included at no extra cost</SectionTitle>
          </div>
          <p className="max-w-[360px] text-base font-medium text-black/70">
            Eleven useful extras that come with OCCTA, from your first bill preview to power-cut guidance.
          </p>
        </Reveal>
      </BrandContainer>

      {/* Accessible, crawlable list; the moving rows below are decorative copies */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div
        aria-hidden
        className="occ-marquee-host mt-10 md:mt-14 space-y-4 pb-16 md:pb-20 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
      >
        {rows.map((row, r) => (
          <div key={r} className="flex">
            <div
              className={`occ-marquee flex w-max gap-4 pr-4 ${r === 1 ? "occ-marquee-reverse" : ""}`}
              style={{ ["--occ-marquee-duration" as string]: r === 0 ? "48s" : "42s" }}
            >
              {[...row, ...row, ...row, ...row].map((label, i) => (
                <Ticket key={`${label}-${i}`} label={label} dark={r === 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
