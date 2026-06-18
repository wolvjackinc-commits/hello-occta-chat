import { FULL_CONTRACT_SECTIONS, FULL_CONTRACT_INTRO, FULL_CONTRACT_TERMS_VERSION } from "@/lib/legal/fullContractTerms";

/**
 * Renders the full multi-page Contract Summary terms — designed to mirror what
 * Tier-1 UK telcos (BT/Sky/Virgin/TalkTalk) include in their Ofcom GC C1.3
 * Contract Summaries. Used both inside the journey Agreement step and on the
 * standalone /quote/contract-summary/:token public view.
 */
export default function FullContractTermsBlock({ collapsibleHeading = true }: { collapsibleHeading?: boolean }) {
  const Wrapper = collapsibleHeading ? "details" : "div";
  return (
    <Wrapper className="border-4 border-foreground p-5 bg-background">
      {collapsibleHeading ? (
        <summary className="cursor-pointer font-display uppercase text-sm flex items-center justify-between gap-3">
          <span>Full Contract Summary — all terms</span>
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground">v{FULL_CONTRACT_TERMS_VERSION}</span>
        </summary>
      ) : (
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display uppercase text-sm">Full Contract Summary — all terms</h2>
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground">v{FULL_CONTRACT_TERMS_VERSION}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3 mb-4">{FULL_CONTRACT_INTRO}</p>
      <div className="space-y-5 text-sm leading-relaxed">
        {FULL_CONTRACT_SECTIONS.map((s) => (
          <section key={s.heading}>
            <h3 className="font-display uppercase text-xs mb-2">{s.heading}</h3>
            <div className="space-y-2 text-foreground/90">
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Wrapper>
  );
}