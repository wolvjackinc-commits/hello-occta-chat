import {
  CONTRACT_INFORMATION_SECTIONS,
  CONTRACT_INFORMATION_INTRO,
  CONTRACT_INFORMATION_VERSION,
} from "@/lib/legal/contractInformation";

/** Detailed Contract Information provided alongside the concise Contract Summary. */
export default function FullContractTermsBlock({ collapsibleHeading = true }: { collapsibleHeading?: boolean }) {
  const Wrapper = collapsibleHeading ? "details" : "div";
  return (
    <Wrapper className="border-4 border-foreground p-5 bg-background">
      {collapsibleHeading ? (
        <summary className="cursor-pointer font-display uppercase text-sm flex items-center justify-between gap-3">
          <span>Contract Information — detailed terms</span>
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground">v{CONTRACT_INFORMATION_VERSION}</span>
        </summary>
      ) : (
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display uppercase text-sm">Contract Information — detailed terms</h2>
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground">v{CONTRACT_INFORMATION_VERSION}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3 mb-4">{CONTRACT_INFORMATION_INTRO}</p>
      <div className="space-y-5 text-sm leading-relaxed">
        {CONTRACT_INFORMATION_SECTIONS.map((s) => (
          <section key={s.heading}>
            <h3 className="font-display uppercase text-xs mb-2">{s.heading}</h3>
            <div className="space-y-2 text-foreground/90">
              {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </Wrapper>
  );
}
