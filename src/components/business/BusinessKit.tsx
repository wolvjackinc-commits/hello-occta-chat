import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadForm from "@/components/business/LeadForm";
import { BrandSection, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

/* Shared building blocks for the /business pages, on the brand kit. */

/** Product or bundle card: ticket head, price, ticked features and a call to action. */
export const BusinessProductCard = ({
  eyebrow,
  name,
  summary,
  price,
  features,
  ctaTo,
  ctaLabel,
  featured = false,
  badge,
}: {
  eyebrow?: ReactNode;
  name: string;
  summary?: ReactNode;
  price: ReactNode;
  features: string[];
  ctaTo: string;
  ctaLabel: string;
  featured?: boolean;
  badge?: string;
}) => (
  <motion.article
    variants={revealItem}
    className={`relative flex h-full flex-col border-[3px] border-foreground bg-card transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))] ${featured ? "shadow-[8px_8px_0_0_hsl(var(--primary))]" : ""}`}
  >
    {badge && (
      <span className="absolute -top-3 left-4 z-10 border-2 border-black bg-black px-3 py-0.5 font-display text-xs uppercase tracking-wider text-primary">
        {badge}
      </span>
    )}
    <div className={`border-b-[3px] border-foreground px-6 pt-6 pb-5 ${featured ? "bg-primary text-black" : "bg-secondary"}`}>
      {eyebrow && <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] opacity-70">{eyebrow}</div>}
      <h3 className="font-display text-3xl uppercase leading-none">{name}</h3>
      {summary && <p className={`mt-2 text-sm leading-relaxed ${featured ? "text-black/75" : "text-muted-foreground"}`}>{summary}</p>}
    </div>
    <div className="flex flex-1 flex-col p-6">
      {price}
      <ul className="mt-5 flex-1 space-y-2.5 border-t-2 border-foreground/10 pt-5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center bg-foreground text-background" aria-hidden>
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link to={ctaTo} className="mt-6">
        <Button variant={featured ? "hero" : "outline"} className="w-full">
          {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </Link>
    </div>
  </motion.article>
);

/** Quote placeholder used instead of a price where a service is priced per site. */
export const QuoteBlock = ({ title, note }: { title: string; note?: ReactNode }) => (
  <div className="border-[3px] border-dashed border-foreground/40 px-4 py-3">
    <div className="font-display text-2xl uppercase leading-none">{title}</div>
    {note && <div className="mt-1.5 text-xs text-muted-foreground">{note}</div>}
  </div>
);

/** Yellow closing band with the business lead form on a white ticket. */
export const BusinessLeadBand = ({
  index,
  title,
  body,
  children,
}: {
  index: string;
  title: string;
  body?: ReactNode;
  children: ReactNode;
}) => (
  <BrandSection tone="yellow" className="border-t-[3px] border-black">
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      <Reveal className="lg:sticky lg:top-28">
        <SectionEyebrow index={index} label="Talk to a specialist" tone="yellow" />
        <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">{title}</h2>
        {body && <p className="mt-4 max-w-md text-lg text-black/75">{body}</p>}
      </Reveal>
      <div className="relative mr-3 mb-3">
        <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 bg-black" />
        <div className="relative border-[3px] border-black bg-white p-5 text-black sm:p-7">{children}</div>
      </div>
    </div>
  </BrandSection>
);

export { LeadForm };
