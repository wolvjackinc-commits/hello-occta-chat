import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { revealItem, revealParent } from "@/components/home/homeMotion";

/* Shared building blocks for the homepage so every section reads as one system:
   the same container width, numbered editorial eyebrows and reveal motion. */

export const HomeContainer = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 md:px-12 ${className}`}>{children}</div>
);

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
