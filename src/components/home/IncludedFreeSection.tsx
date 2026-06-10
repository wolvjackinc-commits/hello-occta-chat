import { Check } from "lucide-react";

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

export default function IncludedFreeSection() {
  return (
    <section className="bg-foreground text-background py-14 md:py-16">
      <div className="container mx-auto px-4">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-background/60 mb-3">
          Always with OCCTA
        </p>
        <h2 className="font-display text-2xl md:text-4xl uppercase mb-8">
          Included at no extra cost
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm md:text-base">
              <Check className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={3} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}