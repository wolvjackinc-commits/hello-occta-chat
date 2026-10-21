import type { ReactNode } from "react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage } from "@/components/brand/kit";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Long-form policy / terms document: poster hero, sticky contents rail, editorial sections. */
export default function PolicyDocument({
  kicker,
  title,
  meta,
  intro,
  sections,
  footer,
}: {
  kicker: string;
  title: ReactNode;
  meta?: ReactNode;
  intro?: ReactNode;
  sections: { heading: string; lines: ReactNode[] }[];
  footer?: ReactNode;
}) {
  return (
    <article>
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: kicker }]} />
        <div className="max-w-4xl">
          <HeroKicker>{kicker}</HeroKicker>
          <HeroTitle size="sm">{title}</HeroTitle>
          {meta && (
            <p className="mt-6 inline-block border-l-[3px] border-primary pl-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{meta}</p>
          )}
          {intro && <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-white/70 sm:text-lg">{intro}</div>}
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <div className="grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-20">
          <aside className="hidden lg:block">
            <nav aria-label="Contents" className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Contents</p>
              <ol className="mt-4 border-t-[3px] border-foreground">
                {sections.map((s, i) => (
                  <li key={s.heading} className="border-b-2 border-foreground/15">
                    <a href={`#${slug(s.heading)}`} className="group flex gap-3 py-2 text-sm font-medium leading-snug">
                      <span className="font-display text-base leading-none text-foreground/30 group-hover:text-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-foreground/75 group-hover:text-foreground">{s.heading.replace(/^\d+\.\s*/, "")}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 max-w-3xl">
            {sections.map((s) => (
              <section key={s.heading} id={slug(s.heading)} className="scroll-mt-28 border-t-[3px] border-foreground pt-6 pb-10 first:border-t-0 first:pt-0">
                <h2 className="font-display text-3xl uppercase leading-[0.95] md:text-4xl">{s.heading}</h2>
                <div className="mt-4 space-y-2 text-base leading-relaxed text-foreground/75">
                  {s.lines.map((line, i) => (line === "" ? <div key={i} className="h-2" aria-hidden /> : <p key={i}>{line}</p>))}
                </div>
              </section>
            ))}
            {footer && <div className="mt-6 border-[3px] border-foreground bg-card p-6 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </BrandSection>
    </article>
  );
}
