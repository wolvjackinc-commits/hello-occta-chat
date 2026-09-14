const PHASES: { key: string; label: string; steps: string[] }[] = [
  { key: "address", label: "Address", steps: ["address"] },
  { key: "plan", label: "Plan & equipment", steps: ["plan", "router", "extras"] },
  { key: "details", label: "Your details", steps: ["details"] },
  { key: "setup", label: "Start & billing", steps: ["start_date", "billing"] },
  { key: "contract", label: "Contract", steps: ["contract"] },
  { key: "review", label: "Review", steps: ["review", "complete"] },
];

// After Journey 2 materialises the contract it reuses the shared quote/order
// journey, whose internal stage names differ. Customer-facing progress groups
// those technical stages into six clear phases so mobile customers do not see a
// daunting ten-step checkout.
const STEP_ALIASES: Record<string, string> = {
  quote: "contract",
  agreement: "contract",
  contract_summary: "contract",
  payment: "review",
  submit: "review",
  completed: "complete",
};

export default function Journey2Progress({ current }: { current: string }) {
  const canonical = STEP_ALIASES[current] ?? current;
  const found = PHASES.findIndex((phase) => phase.steps.includes(canonical));
  const idx = found >= 0 ? found : PHASES.findIndex((phase) => phase.key === "contract");
  const pct = canonical === "complete" ? 100 : Math.round(((idx + 1) / PHASES.length) * 100);

  return (
    <div className="mb-4 sm:mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="font-display text-[11px] uppercase tracking-widest text-muted-foreground sm:text-xs">
          Step {idx + 1} of {PHASES.length} · {PHASES[idx]?.label}
        </p>
        <p className="text-[11px] text-muted-foreground sm:text-xs">{pct}%</p>
      </div>
      <div
        className="h-2.5 border-2 border-foreground bg-background sm:h-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Order progress"
      >
        <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{canonical === "complete" ? "Order complete" : idx === 0 ? "First your address, then your plan. Review everything before placing your order." : idx < 4 ? "Your completed steps are saved. Contract and final review come next." : "Take your time to check your contract and final order details."}</p>
      <ol className="mt-3 hidden flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider md:flex">
        {PHASES.map((phase, i) => (
          <li key={phase.key} className={i <= idx ? "font-bold" : "text-muted-foreground"}>
            {i < idx ? "✓ " : ""}{phase.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
