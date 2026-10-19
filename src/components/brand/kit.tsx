import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { revealItem, revealParent } from "@/components/brand/motion";

/* Shared building blocks for the homepage and marketing pages so every section
   reads as one system: the same container width, dark poster heroes,
   black / paper / yellow sections, numbered editorial eyebrows and reveal motion. */

export const BrandContainer = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 md:px-12 ${className}`}>{children}</div>
);

/**
 * Dark poster hero, as on the homepage. `dark` flips the design tokens for
 * everything inside (checkers, cards, alerts) so the stage reads as one black poster.
 */
export const PosterStage = ({
  children,
  ghost,
  className = "",
}: {
  children: ReactNode;
  /** Huge faint display text behind the content on large screens. */
  ghost?: string;
  className?: string;
}) => (
  <section className={`dark hero-stage relative overflow-clip border-b-4 border-primary bg-background text-foreground ${className}`}>
    <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
    {ghost && (
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-0 hidden select-none font-display text-[26rem] leading-[0.8] text-white/[0.025] lg:block"
      >
        {ghost}
      </div>
    )}
    <BrandContainer className="relative z-10 pt-10 pb-14 lg:pt-16 lg:pb-20">{children}</BrandContainer>
  </section>
);

/** Small bordered label with a pulsing yellow dot, used above a poster headline. */
export const HeroKicker = ({ children }: { children: ReactNode }) => (
  <p className="inline-flex max-w-full items-center gap-2.5 border border-white/20 bg-white/[0.04] px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80 sm:text-[11px] sm:tracking-[0.2em]">
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="hero-pulse absolute inline-flex h-full w-full animate-ping bg-primary opacity-70" />
      <span className="relative inline-flex h-2 w-2 bg-primary" />
    </span>
    <span>{children}</span>
  </p>
);

/** Poster headline. Renders without a fade so it paints immediately as the LCP element. */
export const HeroTitle = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <h1
    className={`mt-5 font-display uppercase leading-[0.86] tracking-[-0.01em] text-white text-[3rem] sm:text-[4.25rem] xl:text-[5.5rem] ${className}`}
  >
    {children}
  </h1>
);

/** Offset yellow slab that a card sits on like a printed ticket. */
export const TicketSlab = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`relative ${className}`}>
    <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 bg-primary" />
    <div className="relative">{children}</div>
  </div>
);

const sectionTone: Record<Tone | "paper", string> = {
  light: "bg-background text-foreground",
  paper: "border-t-[3px] border-foreground bg-secondary text-foreground",
  dark: "dark brand-dark bg-background text-foreground",
  yellow: "bg-primary text-black",
};

/** A page section on one of the brand surfaces (paper is the warm off-white); dark flips the design tokens. */
export const BrandSection = ({
  children,
  tone = "light",
  id,
  className = "",
  containerClassName = "",
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  tone?: Tone | "paper";
  id?: string;
  className?: string;
  containerClassName?: string;
  "aria-labelledby"?: string;
}) => (
  <section id={id} aria-labelledby={labelledBy} className={`${sectionTone[tone]} ${className}`}>
    <BrandContainer className={`py-16 md:py-24 ${containerClassName}`}>{children}</BrandContainer>
  </section>
);

/** Editorial link row: big index number, title and line, arrow on hover. */
export const NumberedLinkList = ({
  items,
  tone = "light",
}: {
  items: { title: string; desc: string; path: string }[];
  tone?: Tone;
}) => {
  const line = tone === "dark" ? "border-white/20" : "border-black";
  const muted = tone === "dark" ? "text-white/60" : "text-black/65";
  const num = tone === "dark" ? "text-primary" : "text-black/25 transition-colors group-hover:text-black";
  return (
    <Reveal as="ol" stagger className={`border-t-[3px] ${line}`}>
      {items.map((g, i) => (
        <motion.li key={g.path} variants={revealItem} className={`border-b-[3px] ${line}`}>
          <Link
            to={g.path}
            className="group grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-5 sm:grid-cols-[4.5rem_1fr_auto] md:py-6"
          >
            <span className={`font-display text-4xl leading-none sm:text-5xl ${num}`}>{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block font-display text-2xl uppercase leading-none sm:text-3xl">{g.title}</span>
              <span className={`mt-1.5 block text-sm ${muted}`}>{g.desc}</span>
            </span>
            <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </motion.li>
      ))}
    </Reveal>
  );
};

/** Reveals its children (or a staggered group of `revealItem` children) on first scroll into view. */
export const Reveal = ({
  children,
  className = "",
  stagger = false,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  as?: "div" | "ul" | "ol";
}) => {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger ? revealParent : revealItem}
    >
      {children}
    </Tag>
  );
};

type Tone = "light" | "dark" | "yellow";

const eyebrowTone: Record<Tone, { num: string; rule: string; label: string }> = {
  light: { num: "bg-foreground text-background", rule: "bg-foreground/20", label: "text-foreground/60" },
  dark: { num: "bg-primary text-black", rule: "bg-white/20", label: "text-white/60" },
  yellow: { num: "bg-black text-primary", rule: "bg-black/25", label: "text-black/70" },
};

/** "02 ── The promise" style label that numbers the homepage like a printed brochure. */
export const SectionEyebrow = ({ index, label, tone = "light" }: { index: string; label: string; tone?: Tone }) => {
  const t = eyebrowTone[tone];
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex h-7 min-w-7 items-center justify-center px-1.5 font-display text-sm leading-none ${t.num}`}>
        {index}
      </span>
      <span className={`h-px w-10 ${t.rule}`} aria-hidden />
      <span className={`font-sans text-[11px] font-semibold uppercase tracking-[0.2em] ${t.label}`}>{label}</span>
    </div>
  );
};

/** Big display heading used at the top of each homepage section. */
export const SectionTitle = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <h2
    className={`font-display uppercase leading-[0.9] tracking-[-0.005em] text-[2.75rem] sm:text-6xl lg:text-7xl ${className}`}
  >
    {children}
  </h2>
);
