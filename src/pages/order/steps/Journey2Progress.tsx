const PHASES: { key: string; label: string; steps: string[] }[] = [
  { key: "choose", label: "Choose", steps: ["address", "plan", "router", "extras"] },
  { key: "setup", label: "Your details", steps: ["details", "start_date"] },
  { key: "agreement", label: "Agreement", steps: ["contract"] },
  { key: "finish", label: "Payment & finish", steps: ["billing", "review", "complete"] },
];

// Internal Journey 2 and quote/order stages stay unchanged. Customer-facing
// progress is intentionally condensed to four simple phases so the checkout
// feels short without weakening any server-side validation or evidence.
const STEP_ALIASES: Record<string, string> = {
  quote: "contract",
  agreement: "contract",
  contract_summary: "contract",
  payment: "billing",
  submit: "review",
  completed: "complete",
};

export default function Journey2Progress({ current }: { current: string }) {
  const canonical = STEP_ALIASES[current] ?? current;
  const found = PHASES.findIndex((phase) => phase.steps.includes(canonical));
  const idx = found >= 0 ? found : 2;
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
      <p className="mt-2 text-xs text-muted-foreground">
        {canonical === "complete"
          ? "Order complete."
          : idx === 0
            ? "Choose your service and options."
            : idx === 1
              ? "Add your details and preferred start date."
              : idx === 2
                ? "Review your documents, verify your mobile and accept."
                : canonical === "billing"
                  ? "Set up Direct Debit after signing, then finish your order."
                  : "One quick final check, then submit your order."}
      </p>
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
